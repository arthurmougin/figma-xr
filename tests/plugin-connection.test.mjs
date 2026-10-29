import test from "node:test";
import assert from "node:assert/strict";
import { companionConnection } from "../scripts/companion-connection.mjs";
import {
  chooseConnection,
  connectionKey,
  normalizeConnection,
} from "../plugin/connection.mjs";
const interfaces = {
  "vEthernet (WSL)": [
    { family: "IPv4", address: "172.20.0.1", internal: false },
  ],
  Ethernet: [{ family: "IPv4", address: "10.0.0.4", internal: false }],
  WiFi: [{ family: "IPv4", address: "192.168.1.24", internal: false }],
  Loopback: [{ family: "IPv4", address: "127.0.0.1", internal: true }],
};
test("local build chooses physical WiFi and separates the desktop transport from phone URLs", () => {
  const c = companionConnection({ env: {}, interfaces });
  assert.equal(c.website, "https://192.168.1.24:5173/figma-xr/");
  assert.equal(c.relay, "https://192.168.1.24:5173");
  assert.equal(c.desktopRelay, "http://127.0.0.1:8787");
  assert.equal(c.kind, "lan");
});
test("public configuration wins; CI and production never bake their private runner address into a plugin", () => {
  const env = {
    FIGMA_XR_COMPANION_URL: "https://app.example/figma-xr",
    FIGMA_XR_RELAY_URL: "https://relay.example",
    FIGMA_CLIENT_SECRET: "never-bundle-this",
  };
  const c = companionConnection({ env, interfaces });
  assert.equal(c.website, "https://app.example/figma-xr/");
  assert.equal(c.desktopRelay, "https://relay.example");
  assert.equal(JSON.stringify(c).includes(env.FIGMA_CLIENT_SECRET), false);
  for (const env of [{ CI: "true" }, { NODE_ENV: "production" }])
    assert.equal(companionConnection({ env, interfaces }).website, "");
  assert.equal(
    companionConnection({
      env: {},
      interfaces: { docker0: interfaces["vEthernet (WSL)"] },
    }).website,
    "",
  );
});
test("new build defaults migrate legacy localhost settings and stale manual endpoints", () => {
  const built = companionConnection({ env: {}, interfaces }),
    old = {
      website: "https://localhost:5173/figma-xr/",
      relay: "https://localhost:5173",
    };
  assert.deepEqual(chooseConnection(built, old), {
    connection: built,
    manual: false,
  });
  const manual = {
    website: "https://other.example/",
    relay: "https://other.example",
    manual: true,
    buildKey: connectionKey(built),
  };
  assert.equal(
    chooseConnection(built, manual).connection.website,
    manual.website,
  );
  const changed = { ...built, website: "https://192.168.1.30:5173/figma-xr/" };
  assert.equal(
    chooseConnection(changed, manual).connection.website,
    changed.website,
  );
  assert.equal(chooseConnection({}, old).connection.website, old.website);
});
test("advanced endpoints reject credentials and insecure remote transports", () => {
  for (const c of [
    { website: "http://app.example" },
    { website: "https://user:password@app.example" },
    { website: "https://app.example", relay: "http://relay.example" },
    { website: "https://app.example", desktopRelay: "http://192.168.1.2:8787" },
  ])
    assert.throws(() => normalizeConnection(c));
  assert.equal(
    normalizeConnection({
      website: "https://app.example/companion",
      desktopRelay: "http://localhost:8787",
    }).website,
    "https://app.example/",
  );
});
