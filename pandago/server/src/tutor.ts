import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { TutorTurn, type TurnRequest } from '../../src/features/chat/engine/contract.ts';
import { MAX_OUT_OF_LEVEL, outOfLevelRatio } from './levelGuard.ts';
import { buildSystemPrompt, buildUserTurn } from './promptBuilder.ts';

const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno del servidor

const MODEL = 'claude-opus-5-5';

export class TutorRefusedError extends Error {}

async function callModel(req: TurnRequest, extraInstruction?: string): Promise<TutorTurn> {
  const userContent = buildUserTurn(req) + (extraInstruction ? `\n\n## Nota del sistema\n${extraInstruction}` : '');

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    // Chat en tiempo real: esfuerzo bajo = menor latencia; el razonamiento difícil
    // (evaluar tonos, planificar niveles) lo hace código determinista, no el LLM.
    output_config: { effort: 'low', format: betaZodOutputFormat(TutorTurn) },
    // Si el filtro de seguridad rechaza un turno, la API lo reintenta en un modelo alternativo.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(req.scenario.persona, req.learner.hsk_level, req.learner.native_language),
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ],
    messages: [{ role: 'user', content: userContent }],
  });

  if (response.stop_reason === 'refusal') throw new TutorRefusedError(response.stop_details?.category ?? 'refusal');
  if (!response.parsed_output) throw new Error(`Salida no válida (stop_reason=${response.stop_reason})`);
  return response.parsed_output;
}

export async function runTutorTurn(req: TurnRequest): Promise<TutorTurn> {
  const turn = await callModel(req);

  const { ratio, unknown } = outOfLevelRatio(turn.reply.hanzi, req.learner.hsk_level);
  if (ratio <= MAX_OUT_OF_LEVEL) return turn;

  // Un único reintento con instrucción explícita; si vuelve a pasarse, se acepta
  // (la UI muestra glosas en las palabras desconocidas).
  return callModel(
    req,
    `Tu respuesta anterior usó caracteres fuera del nivel HSK ${req.learner.hsk_level}: ${unknown.join(' ')}. Reescribe el turno usando solo vocabulario permitido.`,
  );
}
