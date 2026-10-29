import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import WebSocket from "ws";
import { attachPairing } from "../server/pairing.mjs";
const origin = "https://companion.example";
async function fixture(t) {
  let pairing;
  const server = createServer((req, res) => {
    if (!pairing.handle(req, res)) {
      res.writeHead(404);
      res.end();
    }
  });
  pairing = attachPairing(server, { origins: [origin], maxRooms: 4 });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  const clients = [];
  t.after(async () => {
    for (const client of clients) client.terminate();
    pairing.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  async function join(room, role, token) {
    const socket = new WebSocket(
      url.replace("http:", "ws:") + "/api/pair/socket",
      { origin },
    );
    clients.push(socket);
    const queue = [],
      waiters = [];
    socket.on("message", (raw) => {
      const data = JSON.parse(raw);
      const i = waiters.findIndex((w) => w.type === data.type);
      if (i >= 0) waiters.splice(i, 1)[0].resolve(data);
      else queue.push(data);
    });
    socket.on("error", () => {});
    await once(socket, "open");
    socket.send(JSON.stringify({ type: "join", room, role, token }));
    return {
      socket,
      send: (data) => socket.send(JSON.stringify(data)),
      next: (type) => {
        const index = queue.findIndex((p) => p.type === type);
        if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error(`Missing ${type}`)),
            2000,
          );
          waiters.push({
            type,
            resolve: (data) => {
              clearTimeout(timer);
              resolve(data);
            },
          });
        });
      },
    };
  }
  const create = async (o = origin) =>
    fetch(url + "/api/pair/rooms", { method: "POST", headers: { Origin: o } });
  return { create, join, pairing };
}
const item = {
  id: "1:2",
  name: "Card",
  pageId: "page",
  version: 1,
  width: 200,
  height: 100,
  updatedAt: 1,
  image: "data:image/png;base64,AAAA",
};
const snapshot = (revision) => ({
  revision,
  pageId: "page",
  bounds: { x: 0, y: 0, width: 1000, height: 700 },
  zoom: 1,
  pixelWidth: 1000,
  pixelHeight: 700,
  layoutKey: "layout",
  image: item.image,
  items: [
    {
      id: item.id,
      bounds: { x: 20, y: 20, width: 200, height: 100 },
      z: 0,
      version: 1,
    },
  ],
});
test("pairing checks origins and capability tokens; phone cannot publish document data", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.create("https://attacker.example")).status, 403);
  assert.equal((await f.create("null")).status, 201);
  const pair = await (await f.create()).json();
  assert.notEqual(pair.desktopToken, pair.phoneToken);
  const unicode = await f.join(
    pair.room,
    "desktop",
    "é".repeat(pair.desktopToken.length),
  );
  assert.equal((await once(unicode.socket, "close"))[0], 1008);
  const wrong = await f.join(pair.room, "desktop", pair.phoneToken);
  assert.equal((await once(wrong.socket, "close"))[0], 1008);
  const desktop = await f.join(pair.room, "desktop", pair.desktopToken);
  await desktop.next("joined");
  const phone = await f.join(pair.room, "phone", pair.phoneToken);
  await phone.next("joined");
  phone.send({ type: "catalog", items: [item] });
  assert.equal((await once(phone.socket, "close"))[0], 1008);
});
test("catalog replays after reconnect, edits replace assets, invalidation rejects stale viewports", async (t) => {
  const f = await fixture(t),
    pair = await (await f.create()).json(),
    desktop = await f.join(pair.room, "desktop", pair.desktopToken);
  await desktop.next("joined");
  desktop.send({ type: "catalog", items: [item] });
  desktop.send({ type: "viewport", snapshot: snapshot(1) });
  const phone = await f.join(pair.room, "phone", pair.phoneToken);
  await phone.next("joined");
  assert.equal((await phone.next("catalog")).items[0].name, "Card");
  assert.equal((await phone.next("viewport")).snapshot.revision, 1);
  desktop.send({ type: "invalidate", revision: 2 });
  await phone.next("invalidate");
  desktop.send({ type: "viewport", snapshot: snapshot(1) });
  desktop.send({ type: "ping" });
  await desktop.next("pong");
  assert.equal(f.pairing.rooms.get(pair.room).snapshot, null);
  desktop.send({
    type: "catalog",
    items: [{ ...item, version: 2, name: "Edited card" }],
  });
  assert.equal((await phone.next("catalog")).items[0].name, "Edited card");
  desktop.send({ type: "viewport", snapshot: snapshot(3) });
  assert.equal((await phone.next("viewport")).snapshot.revision, 3);
  phone.send({ type: "highlight", id: item.id });
  assert.equal((await desktop.next("highlight")).id, item.id);
  phone.socket.close();
  await once(phone.socket, "close");
  const again = await f.join(pair.room, "phone", pair.phoneToken);
  await again.next("joined");
  assert.equal((await again.next("catalog")).items[0].version, 2);
  desktop.send({ type: "catalog-remove", ids: [item.id] });
  await again.next("catalog-remove");
  assert.equal(f.pairing.rooms.get(pair.room).catalog.size, 0);
});
