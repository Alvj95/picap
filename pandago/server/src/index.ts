import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { TurnRequest } from '../../src/features/chat/engine/contract.ts';
import { runTutorTurn, TutorRefusedError } from './tutor.ts';

const app = new Hono();

// En producción: middleware de auth (JWT de la app), rate-limit por usuario
// (p.ej. 60 turnos/hora en plan gratuito) y registro de métricas por turno.
app.post('/v1/tutor/turn', async (c) => {
  const parsed = TurnRequest.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'bad_request', issues: parsed.error.issues }, 400);
  try {
    return c.json(await runTutorTurn(parsed.data));
  } catch (err) {
    if (err instanceof TutorRefusedError) return c.json({ error: 'refused' }, 422);
    console.error(err);
    return c.json({ error: 'tutor_unavailable' }, 502);
  }
});

app.get('/health', (c) => c.text('ok'));

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8787) });
