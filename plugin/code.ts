// Figma's document sandbox. Browser/network work lives in ui.ts.
figma.showUI(__html__, { width: 360, height: 570, themeColors: true });
const assets = new Map<
  string,
  {
    version: number;
    image: Uint8Array;
    name: string;
    width: number;
    height: number;
    pageId: string;
    updatedAt: number;
  }
>();
const dirty = new Set<string>();
const owned = new Set<string>();
let serial = 0,
  revision = 0,
  busy = false,
  queued = false,
  connected = false,
  page = figma.currentPage;
let lastViewport = "",
  lastChange = Date.now(),
  contentEpoch = 0;
const notify = (message: unknown) => figma.ui.postMessage(message);
const bounds = () => ({ ...figma.viewport.bounds });
function visible(node: SceneNode): boolean {
  let n: BaseNode | null = node;
  while (n && n.type !== "DOCUMENT") {
    if ("visible" in n && !n.visible) return false;
    n = n.parent;
  }
  return true;
}
function overlap(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
function eligible(node: SceneNode) {
  return (
    ["FRAME", "COMPONENT", "INSTANCE", "GROUP"].includes(node.type) &&
    visible(node)
  );
}
function candidates() {
  const viewport = bounds();
  // Top-level compositions plus explicitly selected nested elements. This avoids
  // exporting every tiny layout frame as a separate mobile catalog item.
  const roots: SceneNode[] = [];
  const visit = (children: readonly SceneNode[]) => {
    for (const n of children) {
      if (n.type === "SECTION") visit(n.children);
      else if (eligible(n)) roots.push(n);
    }
  };
  visit(page.children);
  const selected = page.selection.filter(
    (n) => "exportAsync" in n && n.type !== "SLICE" && visible(n),
  );
  return [...new Map([...roots, ...selected].map((n) => [n.id, n])).values()]
    .filter(
      (n) =>
        "absoluteRenderBounds" in n &&
        n.absoluteRenderBounds &&
        overlap(n.absoluteRenderBounds, viewport),
    )
    .slice(0, 48);
}
function markChanged(event: NodeChangeEvent) {
  let changed = false;
  for (const change of event.nodeChanges) {
    if (owned.has(change.id)) continue;
    changed = true;
    // Refresh an exported ancestor when one of its descendants changes.
    let node: BaseNode | null =
      "node" in change && "parent" in change.node ? change.node : null;
    const moveOnly =
      change.type === "PROPERTY_CHANGE" &&
      change.properties.every((p) => ["x", "y"].includes(p));
    if (!node) {
      for (const id of assets.keys()) dirty.add(id);
    }
    while (node) {
      if (assets.has(node.id) && !(moveOnly && node.id === change.id))
        dirty.add(node.id);
      node = node.parent;
    }
  }
  if (changed) {
    contentEpoch++;
    lastChange = Date.now();
    queued = true;
    if (connected) notify({ type: "invalidate", revision: ++revision });
  }
}
function attachPage() {
  page.off("nodechange", markChanged);
  page = figma.currentPage;
  const loading = page;
  loading.loadAsync().then(() => {
    if (page !== loading) return;
    page.on("nodechange", markChanged);
    lastViewport = "";
    queued = true;
  });
}
figma.on("currentpagechange", attachPage);
figma.on("selectionchange", () => {
  queued = true;
  lastChange = Date.now();
});
attachPage();
async function publish(selectionOnly = false) {
  if (busy) {
    queued = true;
    return;
  }
  busy = true;
  queued = false;
  try {
    const epoch = contentEpoch;
    const nodes = selectionOnly
      ? page.selection
          .filter((n) => "exportAsync" in n && n.type !== "SLICE" && visible(n))
          .slice(0, 48)
      : candidates();
    const updated = [];
    const missing = [];
    const exportNodes = new Map(nodes.map((n) => [n.id, n]));
    for (const id of dirty) {
      if (exportNodes.has(id)) continue;
      const node = await figma.getNodeByIdAsync(id);
      if (node && "exportAsync" in node && node.type !== "PAGE")
        exportNodes.set(id, node as SceneNode);
      else {
        assets.delete(id);
        dirty.delete(id);
        missing.push(id);
      }
    }
    if (missing.length) notify({ type: "catalog-remove", ids: missing });
    for (const node of exportNodes.values()) {
      if (!("exportAsync" in node)) continue;
      let asset = assets.get(node.id);
      if (!asset || dirty.has(node.id) || asset.name !== node.name) {
        const r =
          ("absoluteRenderBounds" in node ? node.absoluteRenderBounds : null) ||
          node.absoluteBoundingBox;
        if (!r || r.width <= 0 || r.height <= 0) continue;
        if (!assets.has(node.id) && assets.size >= 256) continue;
        const itemEpoch = contentEpoch;
        const image = await node.exportAsync({
          format: "PNG",
          constraint: {
            type: "SCALE",
            value: Math.min(1, 1024 / Math.max(r.width, r.height)),
          },
        });
        asset = {
          version: ++serial,
          image,
          name: node.name,
          width: r.width,
          height: r.height,
          pageId: page.id,
          updatedAt: Date.now(),
        };
        assets.set(node.id, asset);
        if (contentEpoch === itemEpoch) dirty.delete(node.id);
        else queued = true;
        updated.push({ id: node.id, ...asset });
      }
    }
    if (updated.length) notify({ type: "catalog-bytes", items: updated });
    if (selectionOnly) return;
    const view = bounds(),
      zoom = figma.viewport.zoom;
    const pixelWidth = Math.max(
      32,
      Math.min(1280, Math.round(view.width * zoom)),
    );
    const pixelHeight = Math.max(
      32,
      Math.round((pixelWidth * view.height) / view.width),
    );
    if (pixelHeight > 1600) {
      notify({
        type: "status",
        message: "Resize the Figma window to a landscape view for scanning.",
      });
      return;
    }
    const slice = figma.createSlice();
    owned.add(slice.id);
    slice.name = "Figma XR temporary viewport export";
    if (owned.size > 512) owned.delete(owned.values().next().value!);
    slice.x = view.x;
    slice.y = view.y;
    slice.resize(view.width, view.height);
    let image: Uint8Array;
    try {
      image = await slice.exportAsync({
        format: "PNG",
        constraint: { type: "WIDTH", value: pixelWidth },
        contentsOnly: false,
      });
    } finally {
      slice.remove();
    }
    // Geometry and bytes must describe the same viewport revision.
    if (
      JSON.stringify(bounds()) !== JSON.stringify(view) ||
      contentEpoch !== epoch
    ) {
      queued = true;
      return;
    }
    const pos = figma.ui.getPosition();
    const originX =
      pos.windowSpace.x - pos.canvasSpace.x * zoom + view.x * zoom;
    const originY =
      pos.windowSpace.y - pos.canvasSpace.y * zoom + view.y * zoom;
    const items = nodes
      .filter(
        (n) =>
          assets.has(n.id) &&
          !n.removed &&
          "absoluteRenderBounds" in n &&
          n.absoluteRenderBounds &&
          Math.abs(n.absoluteTransform[0][1]) < 0.001 &&
          Math.abs(n.absoluteTransform[1][0]) < 0.001,
      )
      .map((n, z) => ({
        id: n.id,
        bounds: {
          ...("absoluteRenderBounds" in n
            ? n.absoluteRenderBounds!
            : n.absoluteBoundingBox!),
        },
        version: assets.get(n.id)!.version,
        z,
      }));
    notify({
      type: "viewport-bytes",
      snapshot: {
        revision: ++revision,
        pageId: page.id,
        bounds: view,
        zoom,
        pixelWidth,
        pixelHeight,
        image,
        layoutKey: [
          Math.round(view.width * zoom),
          Math.round(view.height * zoom),
          Math.round(originX),
          Math.round(originY),
        ].join(":"),
        items,
      },
    });
    notify({
      type: "status",
      message: `${assets.size} catalog items · ${items.length} visible for scanning`,
    });
  } catch (error) {
    notify({
      type: "status",
      message:
        error instanceof Error
          ? error.message
          : "Could not export the current view.",
    });
  } finally {
    busy = false;
  }
}
figma.ui.onmessage = async (message) => {
  if (message?.type === "load-settings") {
    let settings;
    try {
      settings = await figma.clientStorage.getAsync(
        "figma-xr-companion-settings",
      );
    } catch {}
    notify({ type: "settings", settings });
  }
  if (message?.type === "disconnected") connected = false;
  if (message?.type === "connected") {
    connected = true;
    notify({
      type: "catalog-bytes",
      items: [...assets].map(([id, asset]) => ({ id, ...asset })),
    });
    queued = true;
    await publish();
  }
  if (message?.type === "poll" && connected) {
    const key = JSON.stringify({ view: bounds(), zoom: figma.viewport.zoom });
    if (key !== lastViewport) {
      lastViewport = key;
      queued = true;
      lastChange = Date.now();
      notify({ type: "invalidate", revision: ++revision });
    }
    if (queued && Date.now() - lastChange >= 350) await publish();
  }
  if (message?.type === "sync" && connected) {
    for (const id of assets.keys()) dirty.add(id);
    await publish();
  }
  if (message?.type === "selection" && connected) await publish(true);
  if (message?.type === "settings")
    await figma.clientStorage.setAsync(
      "figma-xr-companion-settings",
      message.settings,
    );
};
