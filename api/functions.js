import { validateChatRequest } from './_lib/validation.js';
import { streamReply, parseModelList, GeminiError } from './_lib/gemini.js';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

const sendEvent = (res, payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

function toErrorResponse(error) {
  if (error instanceof GeminiError) {
    return { status: error.status, message: error.message };
  }
  return { status: 500, message: 'Ocurrió un error inesperado al generar la respuesta.' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'El servidor no tiene configurada la API key de Gemini.' });
  }

  const validation = validateChatRequest(req.body);
  if (!validation.ok) {
    return res.status(validation.status).json({ error: validation.error });
  }

  const { systemPrompt, messages } = validation.value;
  const chunks = streamReply({
    apiKey,
    models: parseModelList(process.env.GEMINI_MODEL),
    systemPrompt,
    messages,
  });

  let streaming = false;

  try {
    for await (const delta of chunks) {
      if (!streaming) {
        streaming = true;
        res.writeHead(200, SSE_HEADERS);
      }
      sendEvent(res, { delta });
    }
  } catch (error) {
    const { status, message } = toErrorResponse(error);

    if (!streaming) {
      return res.status(status).json({ error: message });
    }

    sendEvent(res, { error: message });
    return res.end();
  }

  if (!streaming) {
    return res.status(502).json({ error: 'La IA no devolvió ninguna respuesta. Intenta de nuevo.' });
  }

  sendEvent(res, { done: true });
  return res.end();
}
