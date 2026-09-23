import { parseStreamBuffer } from '../../utils.js';

export const CHAT_ENDPOINT = '/api/functions';

export class ChatApiError extends Error {
  constructor(message, { status = 0, kind = 'server' } = {}) {
    super(message);
    this.name = 'ChatApiError';
    this.status = status;
    this.kind = kind;
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function describeStatus(status) {
  if (status === 429) return 'Demasiados mensajes seguidos. Espera un momento y vuelve a intentar.';
  if (status >= 500) return 'El servidor tuvo un problema al responder. Intenta nuevamente.';
  return 'No se pudo obtener una respuesta del personaje.';
}

async function postChat(payload, signal) {
  try {
    return await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ChatApiError('No hay conexión con el servidor. Revisa tu red e intenta de nuevo.', {
      kind: 'network',
    });
  }
}

async function* readEvents(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseStreamBuffer(buffer);
    buffer = rest;

    for (const event of events) yield event;
  }
}

/**
 * Envía el historial completo al proxy serverless y va entregando la respuesta
 * del personaje por fragmentos a medida que la IA los genera.
 */
export async function requestReply(payload, { signal, onDelta } = {}) {
  const response = await postChat(payload, signal);

  if (!response.ok) {
    const data = await readJson(response);
    throw new ChatApiError(data?.error ?? describeStatus(response.status), { status: response.status });
  }

  let text = '';

  for await (const event of readEvents(response)) {
    if (event.error) {
      throw new ChatApiError(event.error, { status: response.status, kind: 'stream' });
    }
    if (typeof event.delta === 'string') {
      text += event.delta;
      onDelta?.(text);
    }
  }

  const reply = text.trim();
  if (!reply) {
    throw new ChatApiError('La respuesta del servidor no tiene un formato válido.', {
      status: response.status,
      kind: 'parse',
    });
  }

  return reply;
}
