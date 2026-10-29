import { randomBytes, timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
const PNG = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;
const finite = (v) => typeof v === "number" && Number.isFinite(v);
const rect = (r) =>
  r &&
  ["x", "y", "width", "height"].every((k) => finite(r[k])) &&
  r.width > 0 &&
  r.height > 0;
export function validatePublish(packet) {
  if (packet?.type === "catalog-remove")
    return (
      Array.isArray(packet.ids) &&
      packet.ids.length <= 256 &&
      packet.ids.every((id) => typeof id === "string" && id.length < 200)
    );
  if (packet?.type === "catalog")
    return (
      Array.isArray(packet.items) &&
      packet.items.length <= 64 &&
      packet.items.every(
        (i) =>
          i &&
          typeof i.id === "string" &&
          i.id.length < 200 &&
          typeof i.name === "string" &&
          i.name.length <= 300 &&
          typeof i.pageId === "string" &&
          Number.isSafeInteger(i.version) &&
          i.version > 0 &&
          finite(i.updatedAt) &&
          finite(i.width) &&
          finite(i.height) &&
          i.width > 0 &&
          i.height > 0 &&
          typeof i.image === "string" &&
          i.image.length < 4_000_000 &&
          PNG.test(i.image),
      )
    );
  if (packet?.type === "viewport") {
    const s = packet.snapshot;
    return (
      s &&
      Number.isSafeInteger(s.revision) &&
      s.revision > 0 &&
      typeof s.pageId === "string" &&
      typeof s.layoutKey === "string" &&
      rect(s.bounds) &&
      finite(s.zoom) &&
      s.zoom > 0 &&
      Number.isInteger(s.pixelWidth) &&
      s.pixelWidth >= 32 &&
      s.pixelWidth <= 1600 &&
      Number.isInteger(s.pixelHeight) &&
      s.pixelHeight >= 32 &&
      s.pixelHeight <= 1600 &&
      typeof s.image === "string" &&
      s.image.length < 6_000_000 &&
      PNG.test(s.image) &&
      Array.isArray(s.items) &&
      s.items.length <= 256 &&
      s.items.every(
        (i) =>
          i &&
          typeof i.id === "string" &&
          rect(i.bounds) &&
          finite(i.z) &&
          Number.isSafeInteger(i.version),
      )
    );
  }
  if (packet?.type === "invalidate")
    return Number.isSafeInteger(packet.revision) && packet.revision > 0;
  return false;
}
const secret = () => randomBytes(24).toString("base64url");
function same(a, b) {
  if (typeof a !== "string") return false;
  const provided = Buffer.from(a),
    expected = Buffer.from(b);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
export function attachPairing(
  server,
  { origins = [], ttlMs = 60 * 60 * 1000, maxRooms = 32 } = {},
) {
  const rooms = new Map();
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024 * 1024,
    perMessageDeflate: false,
  });
  const allowed = (origin) => origin === "null" || origins.includes(origin);
  const send = (socket, data) => {
    if (socket.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > 20 * 1024 * 1024)
        return socket.close(1013, "Connection too slow");
      socket.send(JSON.stringify(data));
    }
  };
  const broadcast = (room, data, role) => {
    for (const client of room.clients)
      if (!role || client.role === role) send(client.socket, data);
  };
  const removeRoom = (id, room) => {
    for (const client of room.clients)
      client.socket.close(1001, "Session expired");
    rooms.delete(id);
  };
  const timer = setInterval(() => {
    for (const [id, room] of rooms)
      if (Date.now() - room.touched > ttlMs) removeRoom(id, room);
  }, 30_000);
  timer.unref();
  function handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/api/pair/rooms") return false;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Vary", "Origin");
    const origin = req.headers.origin;
    const reply = (status, data) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (!allowed(origin)) {
      reply(403, { error: "origin_not_allowed" });
      return true;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.writeHead(204);
      res.end();
      return true;
    }
    if (req.method !== "POST") {
      reply(405, { error: "method_not_allowed" });
      return true;
    }
    if (rooms.size >= maxRooms) {
      reply(503, { error: "session_limit" });
      return true;
    }
    const id = secret(),
      room = {
        desktopToken: secret(),
        phoneToken: secret(),
        clients: new Set(),
        catalog: new Map(),
        snapshot: null,
        revision: 0,
        touched: Date.now(),
      };
    rooms.set(id, room);
    reply(201, {
      room: id,
      desktopToken: room.desktopToken,
      phoneToken: room.phoneToken,
      expiresIn: ttlMs / 1000,
    });
    return true;
  }
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/api/pair/socket" || !allowed(req.headers.origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    // Credentials are sent as the first WebSocket message, never in request URLs.
    wss.handleUpgrade(req, socket, head, (ws) => {
      let client, room;
      const authTimer = setTimeout(
        () => ws.close(1008, "Authentication required"),
        5000,
      );
      authTimer.unref();
      ws.on("error", () => {});
      ws.on("message", (raw) => {
        let data;
        try {
          data = JSON.parse(raw.toString());
        } catch {
          ws.close(1008, "Invalid message");
          return;
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          ws.close(1008, "Invalid message");
          return;
        }
        if (!client) {
          room = rooms.get(data.room);
          const token =
            data.role === "desktop" ? room?.desktopToken : room?.phoneToken;
          if (
            data.type !== "join" ||
            !room ||
            !["desktop", "phone"].includes(data.role) ||
            !same(data.token, token || "")
          ) {
            ws.close(1008, "Invalid session");
            return;
          }
          if ([...room.clients].some((c) => c.role === data.role)) {
            ws.close(1008, "This session already has a device");
            return;
          }
          client = { socket: ws, role: data.role, roomId: data.room };
          room.clients.add(client);
          room.touched = Date.now();
          clearTimeout(authTimer);
          send(ws, { type: "joined", role: client.role });
          // Send bounded chunks rather than a single unbounded catalog response.
          for (const item of room.catalog.values())
            send(ws, { type: "catalog", items: [item] });
          if (room.snapshot)
            send(ws, { type: "viewport", snapshot: room.snapshot });
          broadcast(room, {
            type: "presence",
            desktop: [...room.clients].some((c) => c.role === "desktop"),
            phone: [...room.clients].some((c) => c.role === "phone"),
          });
          return;
        }
        room.touched = Date.now();
        if (data.type === "ping") {
          send(ws, { type: "pong" });
          return;
        }
        if (client.role === "phone") {
          if (
            data.type === "highlight" &&
            typeof data.id === "string" &&
            room.catalog.has(data.id)
          )
            broadcast(room, { type: "highlight", id: data.id }, "desktop");
          else if (data.type === "request-sync")
            broadcast(room, { type: "request-sync" }, "desktop");
          else ws.close(1008, "Not permitted");
          return;
        }
        if (!validatePublish(data)) {
          ws.close(1008, "Invalid publication");
          return;
        }
        if (data.type === "catalog") {
          const next = new Map(room.catalog);
          for (const item of data.items) {
            const previous = next.get(item.id);
            if (!previous || item.version > previous.version)
              next.set(item.id, item);
          }
          if (
            next.size > 256 ||
            [...next.values()].reduce((n, i) => n + i.image.length, 0) >
              60_000_000
          ) {
            send(ws, {
              type: "error",
              message: "Catalog is full. Create a new pairing session.",
            });
            return;
          }
          room.catalog = next;
        } else if (data.type === "catalog-remove") {
          for (const id of data.ids) room.catalog.delete(id);
        } else if (data.type === "invalidate") {
          if (data.revision <= room.revision) return;
          room.revision = data.revision;
          room.snapshot = null;
        } else if (data.snapshot.revision > room.revision) {
          room.revision = data.snapshot.revision;
          room.snapshot = data.snapshot;
        } else return;
        broadcast(room, data, "phone");
      });
      ws.on("close", () => {
        clearTimeout(authTimer);
        if (room && client) {
          room.clients.delete(client);
          if (!room.clients.size && !room.catalog.size && !room.snapshot)
            rooms.delete(client.roomId);
          broadcast(room, {
            type: "presence",
            desktop: [...room.clients].some((c) => c.role === "desktop"),
            phone: [...room.clients].some((c) => c.role === "phone"),
          });
        }
      });
    });
  });
  function close() {
    clearInterval(timer);
    for (const [id, room] of rooms) removeRoom(id, room);
    wss.close();
  }
  return { handle, close, rooms };
}
