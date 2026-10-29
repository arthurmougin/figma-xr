import type { MatchResult, ViewportSnapshot } from "./types";
export class ViewportTracker {
  private worker = new Worker(new URL("./tracker.worker.ts", import.meta.url), {
    type: "module",
  });
  private pending: {
    id: number;
    resolve: (match: MatchResult | null) => void;
  } | null = null;
  private serial = 0;
  private revision = -1;
  private disposed = false;
  onStatus: (message: string) => void = () => {};
  constructor() {
    this.worker.onmessage = (event) => {
      const data = event.data;
      if (data.type === "reference" && data.revision === this.revision)
        this.onStatus(
          data.count < 40
            ? "The canvas needs more distinct visual detail."
            : "Aim at the canvas and move the phone slightly sideways.",
        );
      if (
        (data.type === "match" || data.type === "error") &&
        this.pending &&
        this.pending.id === data.id
      ) {
        const p = this.pending;
        this.pending = null;
        p.resolve(data.revision === this.revision ? data.match || null : null);
      }
      if (data.type === "error") this.onStatus(data.message);
    };
    this.worker.onerror = () => {
      this.onStatus("Image tracker could not start. Reload to retry.");
      this.pending?.resolve(null);
      this.pending = null;
    };
  }
  async setReference(snapshot: ViewportSnapshot) {
    this.clear();
    this.revision = snapshot.revision;
    const response = await fetch(snapshot.image),
      bitmap = await createImageBitmap(await response.blob());
    try {
      if (this.disposed || this.revision !== snapshot.revision) return;
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 800 / bitmap.width);
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#e5e5e5";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      this.worker.postMessage(
        {
          type: "reference",
          revision: this.revision,
          width: canvas.width,
          height: canvas.height,
          originalWidth: snapshot.pixelWidth,
          originalHeight: snapshot.pixelHeight,
          pixels: pixels.buffer,
        },
        [pixels.buffer],
      );
    } finally {
      bitmap.close();
    }
  }
  clear() {
    this.revision = -1;
    this.worker.postMessage({ type: "clear" });
    this.pending?.resolve(null);
    this.pending = null;
  }
  match(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
  ): Promise<MatchResult | null> {
    if (this.pending || this.revision < 0 || this.disposed)
      return Promise.resolve(null);
    const id = ++this.serial;
    return new Promise((resolve) => {
      this.pending = { id, resolve };
      this.worker.postMessage(
        {
          type: "frame",
          id,
          revision: this.revision,
          width,
          height,
          pixels: pixels.buffer,
        },
        [pixels.buffer],
      );
    });
  }
  dispose() {
    this.disposed = true;
    this.pending?.resolve(null);
    this.pending = null;
    this.worker.terminate();
  }
}
