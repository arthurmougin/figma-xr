import type { MatchResult } from "./types";
export class FeatureMatcher {
  constructor(cv: unknown);
  setReference(
    rgba: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
    revision: number,
  ): number;
  match(
    rgba: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
  ): MatchResult | null;
  clear(): void;
  dispose(): void;
}
