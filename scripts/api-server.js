import http from 'node:http';
import chatHandler from '../api/functions.js';

const PORT = Number(process.env.API_PORT) || 3000;

const routes = {
  '/api/functions': chatHandler,
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function createVercelResponse(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
      return this;
    },
    json(payload) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(payload));
      return this;
    },
    writeHead(code, headers) {
      res.writeHead(code, headers);
      return this;
    },
    write(chunk) {
      return res.write(chunk);
    },
    end() {
      res.end();
      return this;
    },
  };
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const handler = routes[pathname];
  const response = createVercelResponse(res);

  if (!handler) {
    return response.status(404).json({ error: 'Ruta no encontrada.' });
  }

  try {
    const body = await readJsonBody(req);
    await handler({ method: req.method, headers: req.headers, body }, response);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

server.listen(PORT, () => {
  process.stdout.write(`API local escuchando en http://localhost:${PORT}\n`);
});
