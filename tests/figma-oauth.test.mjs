import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  beginAuthorization, consumeAuthorization, normalizeTokens,
  fetchWithToken, requestTokens,
} from '../src/lib/figma-oauth.ts';

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test('authorization uses granular scopes, strong state and matching S256 PKCE', async () => {
  const store = storage();
  const redirect = 'https://arthurmougin.github.io/figma-xr/?callback';
  const url = new URL(await beginAuthorization('public-client-id', redirect, store));
  assert.equal(url.origin, 'https://www.figma.com');
  assert.equal(url.searchParams.get('redirect_uri'), redirect);
  assert.equal(url.searchParams.get('scope'), 'current_user:read file_content:read');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  const pending = consumeAuthorization(url.searchParams.get('state'), store);
  assert.equal(pending.state.length, 43);
  assert.equal(createHash('sha256').update(pending.verifier).digest('base64url'), url.searchParams.get('code_challenge'));
  assert.throws(() => consumeAuthorization(pending.state, store), /expired or is invalid/);
});

test('missing, wrong, malformed and expired state cannot be exchanged', async () => {
  for (const raw of [null, '{', JSON.stringify({ state: 'valid', verifier: 'v', redirectUri: 'r', createdAt: Date.now() - 600001 })]) {
    const store = storage();
    if (raw) store.setItem('figma-xr:oauth-pending', raw);
    assert.throws(() => consumeAuthorization('valid', store));
  }
  const store = storage();
  await beginAuthorization('id', 'https://example.com/?callback', store);
  assert.throws(() => consumeAuthorization('wrong', store));
  assert.throws(() => consumeAuthorization('', storage()));
});

test('expiry is seconds converted to milliseconds and refresh token is retained', () => {
  const now = Date.now();
  const tokens = normalizeTokens({ access_token: 'new', expires_in: 3600 }, 'existing-refresh');
  assert.equal(tokens.refresh_token, 'existing-refresh');
  assert.ok(tokens.expires_at >= now + 3600000 && tokens.expires_at <= Date.now() + 3600000);
  assert.equal(normalizeTokens({ access_token: 'a', expires_in: 90, refresh_token: 'rotated' }, 'old').refresh_token, 'rotated');
  for (const data of [null, {}, { access_token: '', expires_in: 5 }, { access_token: 'a', expires_in: -1 }, { access_token: 'a', expires_in: 'NaN' }]) {
    assert.throws(() => normalizeTokens(data, 'r'));
  }
});

test('token requests send JSON to the relay and reject HTTP and malformed responses', async () => {
  await requestTokens('https://auth.example.com/api/figma/token', { code: 'test' }, async (url, options) => {
    assert.equal(url.includes('test'), false);
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'omit');
    assert.equal(JSON.parse(options.body).code, 'test');
    return Response.json({ access_token: 'a' });
  });
  for (const status of [400, 401, 429, 502]) {
    await assert.rejects(requestTokens('/token', {}, async () => new Response('secret upstream text', { status })), (error) => error.status === status && !error.message.includes('secret'));
  }
  await assert.rejects(requestTokens('/token', {}, async () => new Response('<html>')), /invalid response/);
});

test('401 refreshes once and retries with the new access token', async () => {
  let token = 'old', refreshed = 0, calls = 0;
  await fetchWithToken('https://api.figma.com/v1/me', async () => token, async () => { refreshed++; token = 'new'; }, async (_url, options) => {
    calls++;
    assert.equal(options.headers.Authorization, `Bearer ${calls === 1 ? 'old' : 'new'}`);
    return new Response('{}', { status: calls === 1 ? 401 : 200 });
  });
  assert.equal(refreshed, 1);
  assert.equal(calls, 2);
});

test('persistent 401 is bounded; permissions, quotas and network errors do not refresh', async () => {
  for (const status of [401, 403, 429, 500]) {
    let refreshed = 0, calls = 0;
    await assert.rejects(fetchWithToken('/me', async () => 'a', async () => { refreshed++; }, async () => { calls++; return new Response('', { status }); }));
    assert.equal(refreshed, status === 401 ? 1 : 0);
    assert.equal(calls, status === 401 ? 2 : 1);
  }
  let refreshed = 0;
  await assert.rejects(fetchWithToken('/me', async () => 'a', async () => { refreshed++; }, async () => { throw new Error('offline'); }));
  assert.equal(refreshed, 0);
});
