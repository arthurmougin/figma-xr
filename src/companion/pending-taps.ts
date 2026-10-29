import { intersectScreen, pickItem } from "./geometry.ts";
import type {
  CatalogItem,
  Point,
  Ray,
  ScreenPlane,
  ViewportItem,
  ViewportSnapshot,
} from "./types.ts";

export interface PendingTap {
  id: number;
  ray: Ray;
  createdAt: number;
  revision: number | null;
}
export type TapFailure =
  | "expired"
  | "canvas-changed"
  | "reset"
  | "cancelled"
  | "empty"
  | "capacity";
export type TapOutcome =
  | {
      type: "resolved";
      tap: PendingTap;
      item: CatalogItem;
      entry: ViewportItem;
      uv: Point;
      plane: ScreenPlane;
    }
  | { type: "failed"; tap: PendingTap; reason: TapFailure };
const copyRay = (ray: Ray): Ray => ({
  origin: [...ray.origin],
  direction: [...ray.direction],
});

// Input intent is independent of tracking readiness. Every tap is retained in
// its original XR space, and consumed exactly once after resolution or failure.
export class PendingTaps {
  private serial = 0;
  private reference: ViewportSnapshot | null = null;
  private epoch = 0;
  private jobs: PendingTap[] = [];
  readonly timeoutMs: number;
  readonly maxPending: number;
  constructor(timeoutMs = 8000, maxPending = 12) {
    this.timeoutMs = timeoutMs;
    this.maxPending = maxPending;
  }
  get pending(): readonly PendingTap[] {
    return this.jobs;
  }
  setReference(
    reference: ViewportSnapshot | null,
    epoch: number,
  ): TapOutcome[] {
    const changed =
      epoch !== this.epoch ||
      (this.reference !== null &&
        reference?.revision !== this.reference.revision);
    const cancelled = changed ? this.cancel("canvas-changed") : [];
    this.reference = reference;
    this.epoch = epoch;
    // A tap during initial/reference loading binds to the first publication in
    // that same canvas epoch. Another invalidation cancels it instead.
    if (reference)
      for (const job of this.jobs)
        if (job.revision === null) job.revision = reference.revision;
    return cancelled;
  }
  enqueue(ray: Ray, now: number): { tap: PendingTap; outcomes: TapOutcome[] } {
    const outcomes: TapOutcome[] = [];
    if (this.jobs.length >= this.maxPending)
      outcomes.push({
        type: "failed",
        tap: this.jobs.shift()!,
        reason: "capacity",
      });
    const tap: PendingTap = {
      id: ++this.serial,
      ray: copyRay(ray),
      createdAt: now,
      revision: this.reference?.revision ?? null,
    };
    this.jobs.push(tap);
    return { tap, outcomes };
  }
  updateRay(id: number, ray: Ray) {
    const job = this.jobs.find((job) => job.id === id);
    if (job) job.ray = copyRay(ray);
  }
  cancel(reason: TapFailure = "cancelled"): TapOutcome[] {
    return this.jobs.splice(0).map((tap) => ({ type: "failed", tap, reason }));
  }
  pump(
    now: number,
    plane: ScreenPlane | null,
    matchedAt: number,
    catalog: ReadonlyMap<string, CatalogItem>,
  ): TapOutcome[] {
    const outcomes: TapOutcome[] = [],
      reference = this.reference,
      remaining: PendingTap[] = [];
    for (const tap of this.jobs) {
      if (now - tap.createdAt >= this.timeoutMs) {
        outcomes.push({ type: "failed", tap, reason: "expired" });
        continue;
      }
      if (!reference || !plane || matchedAt <= 0 || now - matchedAt > 900) {
        remaining.push(tap);
        continue;
      }
      if (tap.revision !== reference.revision) {
        outcomes.push({ type: "failed", tap, reason: "canvas-changed" });
        continue;
      }
      const uv = intersectScreen(tap.ray, plane);
      if (!uv || uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) {
        outcomes.push({ type: "failed", tap, reason: "empty" });
        continue;
      }
      const point = {
        x: reference.bounds.x + uv.x * reference.bounds.width,
        y: reference.bounds.y + uv.y * reference.bounds.height,
      };
      const entry = pickItem(reference.items, point);
      if (!entry) {
        outcomes.push({ type: "failed", tap, reason: "empty" });
        continue;
      }
      const item = catalog.get(entry.id);
      // Catalog packets may arrive after the viewport. Wait for the exact asset
      // rather than cloning a different version or dropping the input.
      if (!item || item.version !== entry.version) {
        remaining.push(tap);
        continue;
      }
      outcomes.push({
        type: "resolved",
        tap,
        item: { ...item },
        entry,
        uv,
        plane,
      });
    }
    this.jobs = remaining;
    return outcomes;
  }
}
