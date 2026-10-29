import { ref, shallowRef } from "vue";
import localforage from "localforage";
import type { CatalogItem, ViewportSnapshot } from "./types";
interface Pairing {
  room: string;
  token: string;
  relay: string;
}
export class CompanionBridge {
  items = shallowRef<CatalogItem[]>([]);
  snapshot = shallowRef<ViewportSnapshot | null>(null);
  viewportEpoch = ref(0);
  status = ref("Loading saved catalog…");
  desktop = ref(false);
  storageError = ref("");
  private socket: WebSocket | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private ping: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private pair: Pairing | null = null;
  private db: LocalForage | null = null;
  private revision = 0;
  private writes: Promise<unknown> = Promise.resolve();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  async start() {
    const params = new URLSearchParams(location.hash.slice(1));
    try {
      if (params.has("room") && params.has("token")) {
        const relay = new URL(params.get("relay") || location.origin);
        if (relay.protocol !== "https:")
          throw new Error("Pair with an HTTPS relay.");
        this.pair = {
          room: params.get("room")!,
          token: params.get("token")!,
          relay: relay.origin,
        };
        sessionStorage.setItem("figma-xr-pair", JSON.stringify(this.pair));
        history.replaceState(
          history.state,
          "",
          location.pathname + location.search,
        );
      } else {
        const saved = sessionStorage.getItem("figma-xr-pair");
        if (saved) this.pair = JSON.parse(saved);
      }
      const room =
        this.pair?.room || localStorage.getItem("figma-xr-last-catalog");
      if (room) {
        this.db = localforage.createInstance({
          name: "figma-xr-companion",
          storeName: "catalog",
          description: "Saved Figma plugin assets",
        });
        const saved = await this.db.getItem<CatalogItem[]>(room);
        if (saved) this.items.value = saved;
      }
    } catch (error) {
      this.storageError.value =
        error instanceof Error
          ? error.message
          : "Saved catalog is unavailable.";
    }
    if (this.stopped) return;
    this.status.value = this.pair
      ? "Connecting to plugin…"
      : "Scan the plugin QR to connect. Saved items are ready.";
    if (this.pair) this.connect();
  }
  private persist() {
    const room = this.pair?.room;
    if (!room || !this.db) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const items = [...this.items.value];
      this.writes = this.writes
        .catch(() => {})
        .then(() => this.db!.setItem(room, items))
        .then(() => localStorage.setItem("figma-xr-last-catalog", room))
        .catch(() => {
          this.storageError.value =
            "This browser could not save the catalog. Keep this page open to retain it.";
        });
    }, 250);
  }
  private connect() {
    if (!this.pair || this.stopped) return;
    const url = new URL("/api/pair/socket", this.pair.relay);
    url.protocol = "wss:";
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          type: "join",
          role: "phone",
          room: this.pair!.room,
          token: this.pair!.token,
        }),
      );
    socket.onmessage = (event) => {
      if (this.stopped || socket !== this.socket) return;
      let packet;
      try {
        packet = JSON.parse(event.data);
      } catch {
        return;
      }
      if (packet.type === "joined") {
        this.revision = 0;
        this.status.value = "Connected. Waiting for plugin…";
        this.ping = setInterval(() => this.send({ type: "ping" }), 20_000);
      }
      if (packet.type === "presence") {
        if (this.desktop.value !== packet.desktop) this.viewportEpoch.value++;
        this.desktop.value = packet.desktop;
        this.status.value = packet.desktop
          ? "Plugin connected · catalog updates live"
          : "Plugin offline · saved catalog ready";
        if (!packet.desktop) {
          this.snapshot.value = null;
        }
      }
      if (packet.type === "catalog") {
        const next = new Map(this.items.value.map((item) => [item.id, item]));
        for (const item of packet.items as CatalogItem[]) {
          const previous = next.get(item.id);
          if (!previous || previous.version < item.version)
            next.set(item.id, item);
        }
        this.items.value = [...next.values()];
        this.persist();
      }
      if (packet.type === "catalog-remove") {
        const removed = new Set(packet.ids);
        this.items.value = this.items.value.filter(
          (item) => !removed.has(item.id),
        );
        this.persist();
      }
      if (packet.type === "invalidate" && packet.revision > this.revision) {
        this.revision = packet.revision;
        this.viewportEpoch.value++;
        this.snapshot.value = null;
      }
      if (
        packet.type === "viewport" &&
        packet.snapshot.revision > this.revision
      ) {
        this.revision = packet.snapshot.revision;
        this.snapshot.value = packet.snapshot;
      }
      if (packet.type === "error") this.status.value = packet.message;
    };
    socket.onclose = (event) => {
      if (socket !== this.socket) return;
      if (this.ping) clearInterval(this.ping);
      this.ping = null;
      this.desktop.value = false;
      this.viewportEpoch.value++;
      this.snapshot.value = null;
      this.status.value =
        event.code === 1008
          ? "Pairing ended. Scan a new QR; your saved catalog remains ready."
          : "Disconnected · saved catalog ready";
      if (!this.stopped && event.code !== 1008)
        this.retry = setTimeout(() => this.connect(), 2000);
    };
    socket.onerror = () => {
      this.status.value =
        "Cannot reach the relay. Saved catalog remains ready.";
    };
  }
  send(packet: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(packet));
  }
  dispose() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.ping) clearInterval(this.ping);
    this.socket?.close();
  }
}
