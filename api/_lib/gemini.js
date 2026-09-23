const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Orden por latencia medida: el primer modelo responde en ~2 s y el segundo actúa
 * como respaldo si se agota la cuota o deja de estar disponible.
 */
export const DEFAULT_MODELS = ['gemini-3.1-flash-lite', 'gemini-3-flash-preview'];

const GENERATION_CONFIG = {
  temperature: 0.9,
  topP: 0.95,
  maxOutputTokens: 512,
  thinkingConfig: { thinkingBudget: 0 },
};

const ROLE_MAP = { user: 'user', assistant: 'model' };

const RETRYABLE_STATUSES = new Set([429, 503]);
const RETRY_DELAY_MS = 600;
const FALLBACK_CODES = new Set(['rate_limit', 'unavailable', 'model_not_found', 'empty', 'slow']);

/**
 * La latencia de Gemini es muy variable: el mismo modelo puede tardar 2 s o 35 s en
 * arrancar. Si el modelo elegido no responde en este plazo se lanza el siguiente en
 * paralelo y se usa el primero que entregue texto.
 */
const HEDGE_DELAY_MS = 3500;

export class GeminiError extends Error {
  constructor(message, { status = 502, code = 'unknown' } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.code = code;
  }
}

export function parseModelList(value) {
  const models = (value ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return models.length > 0 ? models : DEFAULT_MODELS;
}

export function toGeminiContents(messages) {
  const firstUserIndex = messages.findIndex((message) => message.role === 'user');
  if (firstUserIndex === -1) return [];

  return messages.slice(firstUserIndex).reduce((contents, message) => {
    const role = ROLE_MAP[message.role];
    const previous = contents.at(-1);

    if (previous?.role === role) {
      previous.parts.push({ text: message.content });
    } else {
      contents.push({ role, parts: [{ text: message.content }] });
    }

    return contents;
  }, []);
}

export function buildGeminiRequest({ systemPrompt, messages }) {
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: toGeminiContents(messages),
    generationConfig: GENERATION_CONFIG,
  };
}

export function extractDelta(payload) {
  if (payload?.promptFeedback?.blockReason) {
    throw new GeminiError('El mensaje fue bloqueado por las políticas de seguridad de la IA.', {
      status: 422,
      code: 'blocked',
    });
  }

  const candidate = payload?.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

  if (!text && candidate?.finishReason === 'SAFETY') {
    throw new GeminiError('El personaje prefirió no responder a eso.', { status: 422, code: 'blocked' });
  }

  return text;
}

function describeHttpError(status) {
  if (status === 429) {
    return new GeminiError(
      'El personaje está recibiendo demasiados mensajes. Espera unos segundos y vuelve a intentar.',
      { status: 429, code: 'rate_limit' }
    );
  }
  if (status === 404) {
    return new GeminiError('El modelo de IA configurado no está disponible. Revisa GEMINI_MODEL en el servidor.', {
      code: 'model_not_found',
    });
  }
  if (status === 400 || status === 401 || status === 403) {
    return new GeminiError('La configuración de la IA no es válida. Revisa la API key en el servidor.', {
      code: 'auth',
    });
  }
  if (status >= 500) {
    return new GeminiError('El servicio de IA no está disponible en este momento.', {
      status: 503,
      code: 'unavailable',
    });
  }
  return new GeminiError('No se pudo obtener una respuesta de la IA.');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openStream({ apiKey, model, body, signal }) {
  const url = `${API_BASE_URL}/${model}:streamGenerateContent?alt=sse`;
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body,
    signal,
  };

  for (let attempt = 0; ; attempt += 1) {
    let response;

    try {
      response = await fetch(url, init);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new GeminiError('No se pudo conectar con el servicio de IA.', { status: 503, code: 'unavailable' });
    }

    if (response.ok) return response;
    if (attempt > 0 || !RETRYABLE_STATUSES.has(response.status)) throw describeHttpError(response.status);

    await sleep(RETRY_DELAY_MS);
  }
}

async function* readServerSentEvents(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;

      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      try {
        yield JSON.parse(data);
      } catch {
        /* fragmento sin JSON válido: lo ignoramos y seguimos leyendo el stream */
      }
    }
  }
}

async function* streamModel({ apiKey, model, body, signal }) {
  const response = await openStream({ apiKey, model, body, signal });

  for await (const payload of readServerSentEvents(response)) {
    const delta = extractDelta(payload);
    if (delta) yield delta;
  }
}

const HEDGE = Symbol('hedge');

function startAttempt({ apiKey, model, body }) {
  const controller = new AbortController();
  const chunks = streamModel({ apiKey, model, body, signal: controller.signal })[Symbol.asyncIterator]();

  const attempt = { controller, chunks };
  attempt.firstChunk = chunks.next().then(
    (result) => ({ attempt, result }),
    (error) => ({ attempt, error })
  );

  return attempt;
}

function hedgeTimer(ms) {
  let id;
  const promise = new Promise((resolve) => {
    id = setTimeout(() => resolve(HEDGE), ms);
  });
  return { promise, cancel: () => clearTimeout(id) };
}

const abortAll = (attempts) => attempts.forEach(({ controller }) => controller.abort());

/**
 * Emite la respuesta del personaje por fragmentos. Si el modelo elegido tarda en
 * arrancar se lanza el siguiente en paralelo y gana el primero que responda, de modo
 * que un modelo saturado no hace esperar al usuario. Una vez empezada la respuesta,
 * cualquier error se propaga al llamador.
 */
export async function* streamReply({ apiKey, models = DEFAULT_MODELS, systemPrompt, messages }) {
  const body = JSON.stringify(buildGeminiRequest({ systemPrompt, messages }));
  const queue = [...models];
  const running = new Set([startAttempt({ apiKey, model: queue.shift(), body })]);
  let lastError;

  try {
    while (running.size > 0) {
      const timer = queue.length > 0 ? hedgeTimer(HEDGE_DELAY_MS) : null;
      const outcome = await Promise.race([
        ...[...running].map((attempt) => attempt.firstChunk),
        ...(timer ? [timer.promise] : []),
      ]);
      timer?.cancel();

      if (outcome === HEDGE) {
        running.add(startAttempt({ apiKey, model: queue.shift(), body }));
        continue;
      }

      const { attempt, result, error } = outcome;
      running.delete(attempt);

      if (error) {
        if (!(error instanceof GeminiError) || !FALLBACK_CODES.has(error.code)) throw error;
        lastError = error;
      } else if (result.done) {
        lastError = new GeminiError('La IA devolvió una respuesta vacía. Intenta reformular tu mensaje.', {
          code: 'empty',
        });
      } else {
        abortAll(running);
        running.clear();

        yield result.value;

        let chunk = await attempt.chunks.next();
        while (!chunk.done) {
          yield chunk.value;
          chunk = await attempt.chunks.next();
        }
        return;
      }

      if (running.size === 0 && queue.length > 0) {
        running.add(startAttempt({ apiKey, model: queue.shift(), body }));
      }
    }
  } finally {
    abortAll(running);
  }

  throw lastError ?? new GeminiError('No se pudo obtener una respuesta de la IA.');
}
