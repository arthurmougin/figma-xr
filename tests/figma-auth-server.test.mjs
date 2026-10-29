import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthServer, loadConfig } from '../server/figma-auth.mjs';

const origin = 'https://arthurmougin.github.io';
const redirect = `${origin}/figma-xr/?callback`;
const config = { clientId: 'client-id', clientSecret: 'server-only-secret', origins: [origin], redirectUris: [redirect] };
async function withServer(t, upstream) {
  const server = createAuthServer(config, upstream);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return (path, body, headers = {}) => fetch(base + path, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}
const grant = { code: 'code-with+special&characters', redirect_uri: redirect, code_verifier: 'a'.repeat(43) };

test('code exchange uses Basic auth, form body, current endpoint and PKCE', async (t) => {
  const post = await withServer(t, async (url, options) => {
    assert.equal(url, 'https://api.figma.com/v1/oauth/token');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Basic ${Buffer.from('client-id:server-only-secret').toString('base64')}`);
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('code'), grant.code);
    assert.equal(body.get('redirect_uri'), redirect);
    assert.equal(body.get('code_verifier'), grant.code_verifier);
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.has('client_secret'), false);
    return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, ignored: 'not forwarded' });
  });
  const response = await post('/api/figma/token', grant);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.deepEqual(await response.json(), { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 });
});

test('refresh uses /oauth/refresh and does not require a replacement refresh token', async (t) => {
  const post = await withServer(t, async (url, options) => {
    assert.equal(url, 'https://api.figma.com/v1/oauth/refresh');
    assert.equal(new URL(url).search, '');
    assert.equal(new URLSearchParams(options.body).get('refresh_token'), 'refresh+token');
    return Response.json({ access_token: 'new', expires_in: 3600 });
  });
  const response = await post('/api/figma/refresh', { refresh_token: 'refresh+token' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { access_token: 'new', expires_in: 3600 });
});

test('invalid origins, callback URLs, verifiers, payloads and routes never call Figma', async (t) => {
  let calls = 0;
  const post = await withServer(t, async () => { calls++; throw new Error('must not call'); });
  for (const [path, body, headers, status] of [
    ['/api/figma/token', grant, { Origin: 'https://attacker.example' }, 403],
    ['/api/figma/token', grant, { Origin: '' }, 403],
    ['/api/figma/token', { ...grant, redirect_uri: 'https://attacker.example' }, {}, 400],
    ['/api/figma/token', { ...grant, code_verifier: 'short' }, {}, 400],
    ['/api/figma/token', { ...grant, code: '' }, {}, 400],
    ['/api/figma/token', grant, { 'Content-Type': 'text/plain' }, 415],
    ['/api/figma/refresh', {}, {}, 400],
    ['/unknown', grant, {}, 404],
  ]) assert.equal((await post(path, body, headers)).status, status);
  assert.equal(calls, 0);
});

test('upstream errors and malformed successes never expose tokens or secrets', async (t) => {
  let upstream = new Response('server-only-secret + access token', { status: 400 });
  const post = await withServer(t, async () => upstream);
  const response = await post('/api/figma/token', grant);
  assert.equal(response.status, 400);
  assert.equal((await response.text()).includes('server-only-secret'), false);
  upstream = Response.json({ access_token: 'bad' });
  assert.equal((await post('/api/figma/token', grant)).status, 502);
  upstream = new Response('quota', { status: 429, headers: { 'Retry-After': '60' } });
  const quota = await post('/api/figma/token', grant);
  assert.equal(quota.status, 429);
  assert.equal(quota.headers.get('retry-after'), '60');
});

test('server configuration fails closed and validates exact HTTPS origins', () => {
  assert.throws(() => loadConfig({}), /Set FIGMA_CLIENT_ID/);
  const env = { FIGMA_CLIENT_ID: 'id', FIGMA_CLIENT_SECRET: 'secret', FIGMA_ALLOWED_ORIGINS: origin, FIGMA_REDIRECT_URIS: redirect };
  assert.deepEqual(loadConfig(env).redirectUris, [redirect]);
  assert.throws(() => loadConfig({ ...env, FIGMA_ALLOWED_ORIGINS: '*' }));
  assert.throws(() => loadConfig({ ...env, FIGMA_ALLOWED_ORIGINS: 'http://example.com' }));
  assert.throws(() => loadConfig({ ...env, FIGMA_REDIRECT_URIS: 'https://elsewhere.example/callback' }));
});
