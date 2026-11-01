const MAX_ITEMS = 256, MAX_BYTES = 60 * 1024 * 1024;
export const CATALOG_FILE_MAX_BYTES = MAX_BYTES;
// Whitelist fields so a backup cannot contain pairing credentials or UI state.
export function catalogFile(items) {
  return { format: "figma-xr-catalog", version: 1, items: validate(items) };
}
export function parseCatalogFile(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_BYTES)
    throw new Error("Catalog backups must be under 60 MB.");
  const data = JSON.parse(text);
  if (data?.format !== "figma-xr-catalog" || data.version !== 1)
    throw new Error("Choose a Figma XR catalog backup (version 1).");
  return validate(data.items);
}
function validate(items) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS)
    throw new Error("A catalog can contain at most 256 items.");
  let bytes = 0;
  const ids = new Set();
  return items.map(item => {
    if (!item || typeof item.id !== "string" || !item.id || item.id.length > 200 ||
      ids.has(item.id) || typeof item.name !== "string" || item.name.length > 300 ||
      typeof item.pageId !== "string" || item.pageId.length > 200 ||
      !Number.isSafeInteger(item.version) || item.version < 1 ||
      ![item.width, item.height].every(n => Number.isFinite(n) && n > 0 && n <= 32768) ||
      !Number.isFinite(item.updatedAt) || typeof item.image !== "string" ||
      item.image.length > 4_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(item.image))
      throw new Error("This backup contains an invalid or duplicate catalog item.");
    bytes += item.image.length;
    if (bytes > MAX_BYTES) throw new Error("Catalog backups must be under 60 MB.");
    ids.add(item.id);
    return {
      id: item.id, name: item.name, pageId: item.pageId, version: item.version,
      width: item.width, height: item.height, updatedAt: item.updatedAt, image: item.image,
    };
  });
}
