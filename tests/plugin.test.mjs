import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { buildSync } from "esbuild";
const code = buildSync({
  entryPoints: ["plugin/code.ts"],
  bundle: true,
  write: false,
  format: "iife",
  define: { __html__: '""' },
}).outputFiles[0].text;
test("plugin publishes edits and geometry coherently, refreshes offscreen assets and removes its slices", async () => {
  let now = 1000,
    slices = 0,
    removed = 0;
  const messages = [],
    events = new Map();
  const page = {
    id: "page",
    type: "PAGE",
    children: [],
    selection: [],
    parent: { type: "DOCUMENT" },
    loadAsync: async () => {},
    on: (event, fn) => events.set(event, fn),
    off: () => {
      throw new Error("No listener registered yet");
    },
  };
  const make = (id, x) => ({
    id,
    name: id,
    type: "FRAME",
    parent: page,
    visible: true,
    removed: false,
    absoluteBoundingBox: { x, y: 0, width: 100, height: 100 },
    absoluteRenderBounds: { x, y: 0, width: 100, height: 100 },
    absoluteTransform: [
      [1, 0, x],
      [0, 1, 0],
    ],
    exports: 0,
    async exportAsync() {
      this.exports++;
      return new Uint8Array([137, 80, 78, 71]);
    },
  });
  const first = make("one", 0),
    second = make("two", 300);
  page.children = [first, second];
  const slice = () => {
    slices++;
    return {
      id: "slice-" + slices,
      name: "",
      x: 0,
      y: 0,
      resize() {},
      exportAsync: async () => new Uint8Array([137, 80, 78, 71]),
      remove() {
        removed++;
      },
    };
  };
  const figma = {
    currentPage: page,
    viewport: { bounds: { x: 0, y: 0, width: 500, height: 350 }, zoom: 1 },
    showUI() {},
    on() {},
    createSlice: slice,
    getNodeByIdAsync: async (id) =>
      page.children.find((node) => node.id === id) || null,
    ui: {
      postMessage: (m) => messages.push(m),
      getPosition: () => ({
        windowSpace: { x: 0, y: 0 },
        canvasSpace: { x: 0, y: 0 },
      }),
    },
    clientStorage: { getAsync: async () => null, setAsync: async () => {} },
  };
  runInNewContext(code, {
    figma,
    Date: { now: () => now },
    Uint8Array,
    console,
  });
  await Promise.resolve();
  await Promise.resolve();
  const nonce = "0123456789abcdef0123456789abcdef";
  const send = (message) => figma.ui.onmessage({ ...message, nonce });
  await send({ type: "load-settings" });
  assert.equal(messages.at(-1).type, "settings");
  assert.equal(messages.at(-1).nonce, nonce);
  assert.ok(messages.some((message) => message.type === "controller-ready"));
  assert.equal(first.exports, 0);
  await send({ type: "connected" });
  assert.equal(first.exports, 1);
  assert.equal(second.exports, 1);
  assert.equal(slices, removed);
  assert.ok(messages.some((m) => m.type === "viewport-bytes"));
  // Establish the viewport polling key before a content change.
  await send({ type: "poll" });
  now += 500;
  await send({ type: "poll" });
  figma.viewport.bounds = { x: 0, y: 0, width: 200, height: 150 };
  await send({ type: "poll" });
  now += 500;
  await send({ type: "poll" });
  const child = { id: "child", type: "RECTANGLE", parent: second };
  events.get("nodechange")({
    nodeChanges: [
      {
        id: "child",
        node: child,
        type: "PROPERTY_CHANGE",
        properties: ["fills"],
      },
    ],
  });
  assert.equal(messages.at(-1).type, "invalidate");
  now += 500;
  await send({ type: "poll" });
  assert.equal(second.exports, 2);
  assert.equal(first.exports, 1);
  events.get("nodechange")({
    nodeChanges: [
      {
        id: first.id,
        node: first,
        type: "PROPERTY_CHANGE",
        properties: ["x", "y"],
      },
    ],
  });
  now += 500;
  await send({ type: "poll" });
  assert.equal(first.exports, 1);
  page.children = [first];
  events.get("nodechange")({
    nodeChanges: [{ id: second.id, type: "DELETE" }],
  });
  now += 500;
  await send({ type: "poll" });
  assert.ok(
    messages.some((m) => m.type === "catalog-remove" && m.ids.includes("two")),
  );
  assert.equal(slices, removed);
});
