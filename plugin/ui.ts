import QRCode from "qrcode";
import {
  chooseConnection,
  connectionKey,
  normalizeConnection,
  type Connection,
} from "./connection.mjs";
declare const __COMPANION_CONNECTION__: Connection;
const built = __COMPANION_CONNECTION__;
const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
  byte.toString(16).padStart(2, "0"),
).join("");
const $ = (id: string) => document.getElementById(id)!;
const website = $("website") as HTMLInputElement,
  relay = $("relay") as HTMLInputElement,
  desktopRelay = $("desktop-relay") as HTMLInputElement;
const advanced = $("advanced") as HTMLDetailsElement;
let socket: WebSocket | null = null,
  room: { room: string; desktopToken: string; phoneToken: string } | null =
    null;
let connection: Connection | null = null,
  manual = false,
  linked = false,
  initialized = false,
  generation = 0;
let retry: ReturnType<typeof setTimeout> | null = null,
  request: AbortController | null = null;
let startupTimeout: ReturnType<typeof setTimeout> | null = null,
  startupRetry: ReturnType<typeof setInterval> | null = null,
  controllerReady = false;
const tell = (message: unknown) =>
  parent.postMessage({ pluginMessage: { ...(message as object), nonce } }, "*");
const status = (text: string) => {
  $("status").textContent = text;
};
const showQR = (visible: boolean) => {
  ($("qr") as HTMLCanvasElement).hidden = !visible;
  $("link").hidden = !visible;
};
function setInputs(config: Connection) {
  website.value = config.website;
  relay.value = config.relay;
  desktopRelay.value = config.desktopRelay;
}
function png(bytes: Uint8Array | number[]) {
  const data = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < data.length; i += 8192)
    binary += String.fromCharCode(...data.subarray(i, i + 8192));
  return "data:image/png;base64," + btoa(binary);
}
function send(packet: unknown) {
  if (socket?.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify(packet));
}
function unlinked() {
  if (linked) tell({ type: "disconnected" });
  linked = false;
  $("connection").textContent = "Waiting for phone";
}
function connect() {
  if (
    !room ||
    !connection ||
    socket?.readyState === WebSocket.OPEN ||
    socket?.readyState === WebSocket.CONNECTING
  )
    return;
  const credentials = room,
    url = new URL("/api/pair/socket", connection.desktopRelay);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const active = new WebSocket(url);
  socket = active;
  const connectTimeout = setTimeout(() => {
    if (active === socket) {
      active.close();
      status(
        "The pairing server did not finish connecting. Use Retry connection.",
      );
    }
  }, 8000);
  active.onopen = () => {
    if (active === socket)
      active.send(
        JSON.stringify({
          type: "join",
          role: "desktop",
          room: credentials.room,
          token: credentials.desktopToken,
        }),
      );
  };
  active.onmessage = (event) => {
    if (active !== socket) return;
    let packet;
    try {
      packet = JSON.parse(event.data);
    } catch {
      return;
    }
    if (packet.type === "joined") {
      clearTimeout(connectTimeout);
      showQR(true);
      $("pair").textContent = "New QR";
      status(
        "Scan to connect your phone. Your catalog will sync after pairing.",
      );
    }
    if (packet.type === "presence") {
      $("connection").textContent = packet.phone
        ? "Phone connected"
        : "Waiting for phone";
      if (packet.phone && !linked) {
        linked = true;
        tell({ type: "connected" });
      }
      if (!packet.phone) unlinked();
    }
    if (packet.type === "request-sync" && linked) tell({ type: "sync" });
    if (packet.type === "highlight")
      $("connection").textContent = "Item copied on phone";
    if (packet.type === "error") status(packet.message);
  };
  active.onclose = (event) => {
    clearTimeout(connectTimeout);
    if (active !== socket) return;
    socket = null;
    showQR(false);
    unlinked();
    status(
      event.code === 1008
        ? "Pairing ended. Click New QR to reconnect."
        : "Waiting for the pairing server…",
    );
    if (event.code !== 1008) retry = setTimeout(connect, 2000);
  };
  active.onerror = () => {
    if (active === socket)
      status("Cannot reach the pairing server. Check Connection settings.");
  };
}
async function pair(attempt = 0) {
  if (!connection) return;
  const current = ++generation;
  if (retry) clearTimeout(retry);
  request?.abort();
  socket?.close();
  socket = null;
  room = null;
  unlinked();
  showQR(false);
  $("pair").textContent = "Retry connection";
  status("Preparing your phone connection…");
  const controller = new AbortController();
  request = controller;
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      new URL("/api/pair/rooms", connection.desktopRelay),
      { method: "POST", signal: controller.signal },
    );
    if (!response.ok)
      throw new Error(`Pairing service unavailable (${response.status}).`);
    const result = await response.json();
    if (current !== generation) return;
    if (
      !["room", "desktopToken", "phoneToken"].every(
        (key) => typeof result[key] === "string",
      )
    )
      throw new Error("Invalid pairing response.");
    room = result;
    const companion = new URL(connection.website + "companion");
    companion.hash = new URLSearchParams({
      room: room!.room,
      token: room!.phoneToken,
      relay: connection.relay,
    }).toString();
    const link = $("link") as HTMLAnchorElement;
    link.href = companion.href;
    link.textContent = "Open companion";
    await QRCode.toCanvas($("qr") as HTMLCanvasElement, companion.href, {
      width: 240,
      margin: 2,
    });
    if (current !== generation) return;
    tell({
      type: "settings",
      settings: { ...connection, manual, buildKey: connectionKey(built) },
    });
    connect();
  } catch (error) {
    if (current !== generation) return;
    status(
      (error instanceof Error && error.name !== "AbortError"
        ? error.message
        : "Cannot reach the pairing server.") +
        " Start the server, then retry. Connection settings are available below.",
    );
    if (attempt < 2)
      retry = setTimeout(() => void pair(attempt + 1), 2000 * (attempt + 1));
  } finally {
    clearTimeout(timeout);
  }
}
$("pair").onclick = () => {
  if (initialized) void pair();
  else requestSettings();
};
$("apply").onclick = () => {
  try {
    connection = normalizeConnection({
      website: website.value,
      relay: relay.value,
      desktopRelay: desktopRelay.value,
    });
    manual = true;
    setInputs(connection);
    advanced.open = false;
    void pair();
  } catch (error) {
    status(
      error instanceof Error ? error.message : "Invalid connection settings.",
    );
  }
};
$("sync").onclick = () => {
  if (linked) tell({ type: "sync" });
  else status("Scan the QR to connect your phone first.");
};
$("selection").onclick = () => {
  if (linked) tell({ type: "selection" });
  else status("Scan the QR to connect your phone first.");
};
setInterval(() => tell({ type: "poll" }), 400);
setInterval(() => send({ type: "ping" }), 20_000);
window.onmessage = (event) => {
  // Figma's native bridge does not guarantee a parent WindowProxy as source.
  // Correlate replies to this launch instead of rejecting valid SDK messages.
  const message = event.data?.pluginMessage;
  if (!message || message.nonce !== nonce) return;
  if (message.type === "controller-ready") {
    controllerReady = true;
    if (!initialized) {
      $("connection").textContent = "Figma connected";
      status("Loading connection preferences…");
    }
  }
  if (message.type === "controller-error") {
    status(message.message);
    return;
  }
  if (message.type === "settings" && !initialized) {
    initialized = true;
    if (startupTimeout) clearTimeout(startupTimeout);
    if (startupRetry) clearInterval(startupRetry);
    const selected = chooseConnection(built, message.settings);
    connection = selected.connection;
    manual = selected.manual;
    if (connection) {
      setInputs(connection);
      void pair();
    } else {
      advanced.open = true;
      status(
        "This build has no companion address. Set it in Connection settings or rebuild with your hosted URLs.",
      );
    }
  }
  // Preparing a QR creates an empty room. Figma exports start only after a
  // phone has joined, including when the room is hosted remotely.
  if (linked && message.type === "catalog-bytes")
    for (const item of message.items)
      send({ type: "catalog", items: [{ ...item, image: png(item.image) }] });
  if (linked && message.type === "viewport-bytes")
    send({
      type: "viewport",
      snapshot: { ...message.snapshot, image: png(message.snapshot.image) },
    });
  if (
    linked &&
    (message.type === "invalidate" || message.type === "catalog-remove")
  )
    send(
      message.type === "invalidate"
        ? { type: "invalidate", revision: message.revision }
        : { type: "catalog-remove", ids: message.ids },
    );
  if (linked && message.type === "status") status(message.message);
};
function requestSettings() {
  if (startupTimeout) clearTimeout(startupTimeout);
  if (startupRetry) clearInterval(startupRetry);
  controllerReady = false;
  $("connection").textContent = "Connecting to Figma";
  status("Loading your connection configuration…");
  let attempts = 0;
  startupTimeout = setTimeout(() => {
    if (!initialized)
      status(
        controllerReady
          ? "Figma did not finish loading the connection settings. Use Retry connection or reopen the plugin."
          : "The Figma plugin controller did not respond. Close and reopen the plugin, then use Retry connection if needed.",
      );
  }, 5000);
  startupRetry = setInterval(() => {
    if (initialized || ++attempts > 3) {
      if (startupRetry) clearInterval(startupRetry);
      return;
    }
    tell({ type: "load-settings" });
  }, 750);
  tell({ type: "load-settings" });
}
try {
  setInputs(normalizeConnection(built));
} catch {}
requestSettings();
