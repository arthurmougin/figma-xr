import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import localforage from 'localforage';

function makeStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test('auth store completes callback, hydrates a session, shares refreshes and rejects invalid callbacks', async (t) => {
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage, fetch: globalThis.fetch };
  const originalGetItem = localforage.getItem;
  const originalSetItem = localforage.setItem;
  let destination;
  globalThis.window = { location: { origin: 'https://localhost:5173', assign: (url) => { destination = url; } } };
  globalThis.sessionStorage = makeStorage();
  globalThis.localStorage = makeStorage();
  localStorage.setItem('auth', 'legacy credentials');
  localforage.getItem = async () => null;
  localforage.setItem = async (_key, value) => value;
  const vite = await createServer({ configFile: false, base: '/figma-xr/', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true },
    define: { 'import.meta.env.VITE_ID': JSON.stringify('test-client') } });
  t.after(async () => {
    await vite.close();
    Object.assign(globalThis, previous);
    localforage.getItem = originalGetItem;
    localforage.setItem = originalSetItem;
  });
  const { useAuthStore } = await vite.ssrLoadModule('/src/store/auth.store.ts');
  assert.equal(localStorage.getItem('auth'), null);
  function newStore() {
    const pinia = createPinia();
    pinia.use(piniaPluginPersistedstate);
    pinia.use(({ store }) => { store.router = { push: async () => {} }; });
    createApp({}).use(pinia);
    setActivePinia(pinia);
    return useAuthStore(pinia);
  }
  const store = newStore();
  let exchanged = 0, refreshed = 0;
  globalThis.fetch = async (url, options) => {
    if (url === '/api/figma/token') {
      const body = JSON.parse(options.body);
      assert.equal(body.code_verifier.length, 43);
      assert.equal(body.redirect_uri, 'https://localhost:5173/figma-xr/?callback');
      exchanged++;
      return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 });
    }
    if (url === '/api/figma/refresh') {
      refreshed++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Response.json({ access_token: 'renewed', expires_in: 3600 });
    }
    assert.equal(url, 'https://api.figma.com/v1/me');
    return Response.json({ id: 'user', handle: 'Arthur', email: 'test@example.invalid', img_url: '' });
  };
  await store.login();
  assert.equal(await store.initCallbackRoute({ query: { code: 'code', state: new URL(destination).searchParams.get('state') } }), true);
  assert.equal(store.profile.handle, 'Arthur');
  assert.equal(exchanged, 1);
  assert.equal(localStorage.getItem('auth'), null);
  const hydrated = newStore();
  assert.equal(hydrated.access_token, 'access');
  assert.ok(hydrated.expires_at > Date.now());
  hydrated.expires_at = 1;
  const tokens = await Promise.all([hydrated.ensureValidToken(), hydrated.ensureValidToken(), hydrated.ensureValidToken()]);
  assert.deepEqual(tokens, ['renewed', 'renewed', 'renewed']);
  assert.equal(refreshed, 1);
  assert.equal(hydrated.refresh_token, 'refresh');
  assert.equal(await hydrated.initCallbackRoute({ query: { code: 'replay', state: 'invalid' } }), false);
  assert.equal(exchanged, 1);
  assert.equal(hydrated.access_token, null);
  assert.match(hydrated.error, /expired or is invalid/);
});
