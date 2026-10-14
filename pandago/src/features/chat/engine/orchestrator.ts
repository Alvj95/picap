/**
 * Orquestador de la conversación — una máquina de estados pura (reducer) que la
 * pantalla de chat conecta a la red y a las animaciones. Al ser pura se testea
 * sin UI ni red.
 *
 *   ┌────────────┐ start  ┌──────────────┐ reply ┌─────────────┐
 *   │   idle     ├───────►│ tutor_typing ├──────►│ await_user  │◄─┐
 *   └────────────┘        └──────▲───────┘       └──────┬──────┘  │
 *                                │ submit (texto/hueco/voz)│        │ retry voz
 *                                └──────────────────────┘ ┌───────┴──────┐
 *                                    recording ──────────►│  assessing   │
 *                                                         └──────────────┘
 *   Cualquier estado ──(scenario_complete | max_turns)──► finished (XP + cofre)
 */
import type { BaoMood } from '@/components/mascot/types';
import type { LearnerSnapshot, NextTask, Scenario, TutorTurn, TurnRequest, UserInput } from './contract';

export type ChatMessage =
  | { id: string; from: 'tutor'; turn: TutorTurn }
  | { id: string; from: 'user'; text: string; pronunciationScore?: number }
  | { id: string; from: 'system'; text: string };

export interface ChatState {
  phase: 'idle' | 'tutor_typing' | 'await_user' | 'recording' | 'assessing' | 'finished' | 'error';
  scenario: Scenario;
  messages: ChatMessage[];
  task: NextTask | null;
  mood: BaoMood;
  turns: number;
  xpEarned: number;
  /** Fallos consecutivos en la tarea actual → activa pistas proactivas. */
  struggle: number;
}

export type ChatAction =
  | { type: 'start' }
  | { type: 'submit'; input: UserInput; display: string }
  | { type: 'tutor_reply'; turn: TutorTurn }
  | { type: 'record_start' }
  | { type: 'record_stop' }
  | { type: 'fail'; message: string };

let seq = 0;
const id = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export function initChat(scenario: Scenario): ChatState {
  return { phase: 'idle', scenario, messages: [], task: null, mood: 'idle', turns: 0, xpEarned: 0, struggle: 0 };
}

/** XP por turno: base + bonus por calidad, sin castigar los errores (en el chat no se pierden vidas). */
export const xpForTurn = (turn: TutorTurn) => 2 + Math.round(turn.task_score * 3);

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'start':
      return { ...state, phase: 'tutor_typing', mood: 'thinking' };

    case 'submit':
      return {
        ...state,
        phase: 'tutor_typing',
        mood: 'thinking',
        messages: [
          ...state.messages,
          {
            id: id(),
            from: 'user',
            text: action.display,
            pronunciationScore: action.input.kind === 'voice' ? action.input.pronunciation_score : undefined,
          },
        ],
      };

    case 'tutor_reply': {
      const { turn } = action;
      const turns = state.turns + (state.messages.length ? 1 : 0);
      const finished = turn.scenario_complete || turns >= state.scenario.max_turns;
      const struggle = turn.task_score < 0.5 ? state.struggle + 1 : 0;
      return {
        ...state,
        phase: finished ? 'finished' : 'await_user',
        messages: [...state.messages, { id: id(), from: 'tutor', turn }],
        task: finished ? null : turn.next_task,
        mood: finished ? 'celebrate' : turn.bao_mood,
        turns,
        struggle,
        xpEarned: state.xpEarned + (state.messages.length ? xpForTurn(turn) : 0) + (finished ? 10 : 0),
      };
    }

    case 'record_start':
      return { ...state, phase: 'recording', mood: 'talking' };

    case 'record_stop':
      return { ...state, phase: 'assessing', mood: 'thinking' };

    case 'fail':
      return {
        ...state,
        phase: 'error',
        mood: 'encourage',
        messages: [...state.messages, { id: id(), from: 'system', text: action.message }],
      };
  }
}

/**
 * Construye la petición al backend recortando el historial (ventana de 12
 * mensajes) para controlar coste y latencia: el escenario + el snapshot del
 * estudiante ya dan al modelo el contexto de largo plazo.
 */
export function buildTurnRequest(state: ChatState, learner: LearnerSnapshot, input: UserInput | null): TurnRequest {
  const history = state.messages
    .filter((m): m is Exclude<ChatMessage, { from: 'system' }> => m.from !== 'system')
    .slice(-12)
    .map((m) => (m.from === 'tutor' ? { role: 'tutor' as const, text: m.turn.reply.hanzi } : { role: 'user' as const, text: m.text }));
  return { scenario: state.scenario, learner, history, input };
}

/**
 * Corrección local inmediata para huecos: no esperamos a la red para dar
 * feedback de acierto/fallo (latencia percibida = 0 ms). La IA luego responde
 * con la continuación del diálogo.
 */
export function checkGapLocally(task: NextTask, choice: string): boolean | null {
  return task.type === 'fill_gap' ? task.answer === choice : null;
}
