import type { CatalogItem } from "./types";
export const CATALOG_FILE_MAX_BYTES: number;
export function catalogFile(items: CatalogItem[]): { format: string; version: number; items: CatalogItem[] };
export function parseCatalogFile(text: string): CatalogItem[];
