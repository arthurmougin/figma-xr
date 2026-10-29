import QRCode from "qrcode";
const $ = (id: string) => document.getElementById(id)!;
const website = $("website") as HTMLInputElement,
  relay = $("relay") as HTMLInputElement;
let socket: WebSocket | null = null,
  room: { room: string; desktopToken: string; phoneToken: string } | null =
    null,
  stopped = false;
const tell = (message: unknown) =>
  parent.postMessage({ pluginMessage: message }, "*");
const status = (text: string) => {
  $("status").textContent = text;
};
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
function connect() {
  if (!room || stopped) return;
  const url = new URL("/api/pair/socket", relay.value);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(url);
  socket.onopen = () =>
    send({
      type: "join",
      role: "desktop",
      room: room!.room,
      token: room!.desktopToken,
    });
  socket.onmessage = (event) => {
    let packet;
    try {
      packet = JSON.parse(event.data);
    } catch {
      return;
    }
    if (packet.type === "joined") tell({ type: "connected" });
    if (packet.type === "presence")
      $("connection").textContent = packet.phone
        ? "Phone connected"
        : "Waiting for phone";
    if (packet.type === "request-sync") tell({ type: "sync" });
    if (packet.type === "highlight") {
      $("connection").textContent = "Item cloned on phone";
    }
    if (packet.type === "error") status(packet.message);
  };
  socket.onclose = (event) => {
    status(
      event.code === 1008
        ? "Pairing expired or already in use. Create a new session."
        : "Disconnected. Reconnecting…",
    );
    if (event.code !== 1008 && !stopped) setTimeout(connect, 1500);
  };
  socket.onerror = () =>
    status("Cannot reach the relay. Check its HTTPS address and certificate.");
}
$("pair").onclick = async () => {
  try {
    const site = new URL(website.value);
    if (site.protocol !== "https:")
      throw new Error("Use an HTTPS companion website address.");
    if (!relay.value) relay.value = site.origin;
    const relayUrl = new URL(relay.value);
    if (relayUrl.protocol !== "https:")
      throw new Error("Use an HTTPS relay address.");
    stopped = true;
    socket?.close();
    room = null;
    const response = await fetch(new URL("/api/pair/rooms", relayUrl), {
      method: "POST",
    });
    if (!response.ok)
      throw new Error(`Pairing service unavailable (${response.status}).`);
    room = await response.json();
    stopped = false;
    const companion = new URL(
      site.pathname.replace(/\/$/, "") + "/companion",
      site.origin,
    );
    companion.hash = new URLSearchParams({
      room: room!.room,
      token: room!.phoneToken,
      relay: relayUrl.origin,
    }).toString();
    ($("link") as HTMLAnchorElement).href = companion.href;
    $("link").textContent = "Open companion";
    await QRCode.toCanvas($("qr") as HTMLCanvasElement, companion.href, {
      width: 240,
      margin: 2,
    });
    tell({
      type: "settings",
      settings: { website: website.value, relay: relay.value },
    });
    connect();
    status("Scan this QR with your phone. Use an address the phone can reach.");
  } catch (error) {
    status(
      error instanceof Error ? error.message : "Could not create pairing.",
    );
  }
};
$("sync").onclick = () => tell({ type: "sync" });
$("selection").onclick = () => tell({ type: "selection" });
setInterval(() => tell({ type: "poll" }), 400);
setInterval(() => send({ type: "ping" }), 20_000);
window.onmessage = (event) => {
  if (event.source !== parent) return;
  const message = event.data?.pluginMessage;
  if (!message) return;
  if (message.type === "settings" && message.settings) {
    website.value = message.settings.website || website.value;
    relay.value = message.settings.relay || "";
  }
  if (message.type === "catalog-bytes")
    for (const item of message.items)
      send({ type: "catalog", items: [{ ...item, image: png(item.image) }] });
  if (message.type === "viewport-bytes")
    send({
      type: "viewport",
      snapshot: { ...message.snapshot, image: png(message.snapshot.image) },
    });
  if (message.type === "invalidate" || message.type === "catalog-remove")
    send(message);
  if (message.type === "status") status(message.message);
};
