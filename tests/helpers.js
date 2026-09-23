const encode = (events) => events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');

const geminiChunk = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });

/** Respuesta SSE tal como la devuelve Gemini, partida en uno o varios fragmentos. */
export function geminiStream(chunks, { status = 200 } = {}) {
  const texts = Array.isArray(chunks) ? chunks : [chunks];
  return new Response(encode(texts.map(geminiChunk)), {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

/** Respuesta SSE tal como la devuelve nuestra función serverless al frontend. */
export function chatStream(chunks) {
  const texts = Array.isArray(chunks) ? chunks : [chunks];
  return new Response(encode([...texts.map((delta) => ({ delta })), { done: true }]), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function collect(iterable) {
  let text = '';
  for await (const chunk of iterable) text += chunk;
  return text;
}
