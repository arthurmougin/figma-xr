import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export function loadConfig(env = process.env) {
  const list = (value) => (value || '').split(',').map((item) => item.trim()).filter(Boolean);
  const config = {
    clientId: env.FIGMA_CLIENT_ID,
    clientSecret: env.FIGMA_CLIENT_SECRET,
    origins: list(env.FIGMA_ALLOWED_ORIGINS),
    redirectUris: list(env.FIGMA_REDIRECT_URIS),
  };
  if (!config.clientId || !config.clientSecret || !config.origins.length || !config.redirectUris.length) {
    throw new Error('Set FIGMA_CLIENT_ID, FIGMA_CLIENT_SECRET, FIGMA_ALLOWED_ORIGINS and FIGMA_REDIRECT_URIS on the auth server.');
  }
  for (const origin of config.origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['https:', 'http:'].includes(url.protocol) ||
      (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname))) {
      throw new Error('Allowed origins must be exact HTTPS origins (HTTP is only allowed on localhost).');
    }
  }
  for (const redirect of config.redirectUris) {
    const url = new URL(redirect);
    if (!config.origins.includes(url.origin) || url.hash || url.username || url.password) {
      throw new Error('Each callback must belong to an allowed origin and have no fragment or credentials.');
    }
  }
  return config;
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 8192) throw new Error('Request too large');
  }
  const data = JSON.parse(body);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid JSON');
  return data;
}

export function createAuthHandler(config, fetcher = fetch) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && pathname === '/health') return send(200, { ok: true });
    if (!['/api/figma/token', '/api/figma/refresh'].includes(pathname)) {
      return send(404, { error: 'not_found' });
    }
    const origin = req.headers.origin;
    res.setHeader('Vary', 'Origin');
    if (!config.origins.includes(origin)) return send(403, { error: 'origin_not_allowed' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.writeHead(204);
      return res.end();
    }
    if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' });
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
      return send(415, { error: 'expected_json' });
    }
    let input;
    try { input = await readJson(req); } catch { return send(400, { error: 'invalid_request' }); }
    const isString = (value) => typeof value === 'string' && value.length > 0 && value.length <= 4096;
    const body = new URLSearchParams();
    let endpoint;
    if (pathname === '/api/figma/token') {
      if (!isString(input.code) || !config.redirectUris.includes(input.redirect_uri) ||
        typeof input.code_verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(input.code_verifier)) {
        return send(400, { error: 'invalid_request' });
      }
      endpoint = 'https://api.figma.com/v1/oauth/token';
      body.set('grant_type', 'authorization_code');
      body.set('redirect_uri', input.redirect_uri);
      body.set('code', input.code);
      body.set('code_verifier', input.code_verifier);
    } else {
      if (!isString(input.refresh_token)) return send(400, { error: 'invalid_request' });
      endpoint = 'https://api.figma.com/v1/oauth/token';
      body.set('grant_type', 'refresh_token');
      body.set('refresh_token', input.refresh_token);
    }
    try {
      const response = await fetcher(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(), signal: AbortSignal.timeout(15_000), redirect: 'error',
      });
      if (!response.ok) {
        // Never echo upstream payloads, credentials, codes or tokens into errors/logs.
        const status = [400, 401, 429].includes(response.status) ? response.status : 502;
        if (response.status === 429 && response.headers.get('retry-after')) {
          res.setHeader('Retry-After', response.headers.get('retry-after'));
        }
        return send(status, { error: 'figma_authorization_failed' });
      }
      const data = await response.json();
      if (!isString(data?.access_token) || !Number.isFinite(Number(data.expires_in)) ||
        Number(data.expires_in) <= 0 ||
        (pathname.endsWith('/token') && !isString(data.refresh_token)) ||
        (data.refresh_token !== undefined && !isString(data.refresh_token))) {
        return send(502, { error: 'invalid_figma_response' });
      }
      return send(200, {
        access_token: data.access_token, expires_in: Number(data.expires_in),
        ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
      });
    } catch {
      return send(502, { error: 'figma_unavailable' });
    }
  };
}

export function createAuthServer(config, fetcher = fetch) {
  return createServer(createAuthHandler(config, fetcher));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();
  const port = Number(process.env.PORT || 8787);
  const host = process.env.AUTH_HOST || '127.0.0.1';
  createAuthServer(config).listen(port, host, () => {
    console.log(`Figma auth server listening on ${host}:${port}`);
  });
}
