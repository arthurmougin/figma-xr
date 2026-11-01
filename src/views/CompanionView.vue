<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { CompanionBridge } from "../companion/bridge";
import type { CompanionScene } from "../companion/scene";
import type { CatalogItem } from "../companion/types";
import { demoCatalog } from "../companion/demo";
import { catalogFile, parseCatalogFile, CATALOG_FILE_MAX_BYTES } from "../companion/catalog-file.mjs";
const demo = useRoute().query.demo === "1";
const build = __APP_BUILD__;
const showCatalog = ref(true), showGuide = ref(true), arAvailable = ref<boolean | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const guideKey = `figma-xr-guide-v1-${demo ? "demo" : "live"}`;
const bridge = new CompanionBridge();
const { items, status, desktop, storageError } = bridge;
const canvas = ref<HTMLCanvasElement | null>(null),
  overlay = ref<HTMLElement | null>(null),
  header = ref<HTMLElement | null>(null), controls = ref<HTMLElement | null>(null);
const inXR = ref(false),
  sceneReady = ref(false),
  sceneError = ref(false),
  pending = ref(0),
  message = ref("Your Figma catalog, ready to place in space."),
  query = ref("");
let scene: CompanionScene | null = null;
let disposed = false;
let preparing = false;
const filtered = computed(() =>
  items.value.filter((item) =>
    item.name.toLowerCase().includes(query.value.toLowerCase()),
  ),
);
const diagnosticUrl = computed(() => import.meta.env.BASE_URL + "phone-check.html?" +
  new URLSearchParams(demo ? { mode: "demo" } : bridge.relay.value ? { relay: bridge.relay.value } : {}));
function dismissGuide() {
  showGuide.value = false;
  try { localStorage.setItem(guideKey, "done"); } catch { /* Help remains dismissible in memory. */ }
}
function place(item: CatalogItem) {
  const top = header.value?.getBoundingClientRect().bottom || 0,
    bottom = controls.value?.getBoundingClientRect().top || innerHeight;
  scene?.place(item, { x: 12, y: top + 12, width: innerWidth - 24, height: bottom - top - 24 });
}
function exportCatalog() {
  try {
    const url = URL.createObjectURL(new Blob([JSON.stringify(catalogFile(items.value))], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "figma-xr-catalog.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    message.value = "Catalog backup downloaded. It contains design images; keep it private.";
  } catch (error) { message.value = error instanceof Error ? error.message : "Could not export the catalog."; }
}
async function importCatalog(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > CATALOG_FILE_MAX_BYTES) throw new Error("Catalog backups must be under 60 MB.");
    const imported = parseCatalogFile(await file.text());
    if (disposed) return;
    await bridge.importCatalog(imported);
    showCatalog.value = true;
    message.value = `Imported ${imported.length} items. Your catalog is ready without a desktop.`;
  } catch (error) { message.value = error instanceof Error ? error.message : "Could not import this catalog."; }
  finally { input.value = ""; }
}
watch(items, (value) => scene?.updateCatalog(value));
watch([bridge.snapshot, bridge.viewportEpoch], ([value, epoch]) =>
  scene?.updateSnapshot(value, epoch),
);
async function enterAR() {
  if (!scene || !overlay.value) return;
  try {
    await scene.enterXR(overlay.value);
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : "Could not enter AR.";
  }
}
async function prepareScene() {
  if (preparing || scene || disposed) return;
  preparing = true;
  sceneError.value = false;
  message.value = "Preparing 3D… Your catalog can connect while it loads.";
  try {
    const { CompanionScene } = await import("../companion/scene");
    if (disposed || !canvas.value) return;
    scene = new CompanionScene(canvas.value);
    scene.onStatus = (value) => (message.value = value);
    scene.onXR = (active) => {
      inXR.value = active;
      if (!active) pending.value = 0;
    };
    scene.onClone = (id) => bridge.send({ type: "highlight", id });
    scene.onPending = (count) => (pending.value = count);
    scene.updateCatalog(items.value);
    scene.updateSnapshot(bridge.snapshot.value, bridge.viewportEpoch.value);
    sceneReady.value = true;
    message.value = "Your Figma catalog, ready to place in space.";
  } catch {
    if (disposed) return;
    sceneError.value = true;
    message.value = "Could not prepare 3D. Your catalog can still connect. Retry or check the phone connection.";
  } finally {
    preparing = false;
  }
}
onMounted(() => {
  // Pairing and the catalog must not wait for the XR engine download or WebGL.
  try { showGuide.value = localStorage.getItem(guideKey) !== "done"; } catch { /* Storage is optional. */ }
  if (demo) {
    items.value = demoCatalog();
    status.value = "Demo catalog · no desktop required";
  } else void bridge.start();
  if (!navigator.xr) arAvailable.value = false;
  else void navigator.xr.isSessionSupported("immersive-ar")
    .then((available) => { if (!disposed) arAvailable.value = available; })
    .catch(() => { if (!disposed) arAvailable.value = false; });
  void prepareScene();
});
onBeforeUnmount(() => {
  disposed = true;
  bridge.dispose();
  scene?.dispose();
});
</script>
<template>
  <div class="companion">
    <canvas ref="canvas" aria-label="Figma XR scene" />
    <div ref="overlay" class="companion-overlay">
      <header ref="header" class="panel top" @beforexrselect.prevent>
        <div>
          <strong>Figma XR</strong
          ><span class="connection" :class="{ live: desktop }">{{
            status
          }}</span>
          <span v-if="demo" class="mode-label">Mobile lab · sample designs</span>
        </div>
        <details class="menu">
          <summary>Menu</summary>
          <nav aria-label="Companion menu">
            <button @click="showGuide = true">Show onboarding</button>
            <router-link v-if="!demo" to="/lab">Try sample designs</router-link>
            <router-link v-else :to="{ name: 'companion' }">Open my saved catalog</router-link>
            <button v-if="!demo" @click="fileInput?.click()">Import catalog backup</button>
            <button :disabled="!items.length" @click="exportCatalog">Export catalog backup</button>
            <a :href="diagnosticUrl">Check phone connection</a>
            <router-link :to="{ name: 'landingpage' }">Home</router-link>
            <small>{{ build.channel }} · {{ build.revision.slice(0, 7) }}</small>
          </nav>
        </details>
        <input ref="fileInput" class="file-input" type="file" accept=".json,application/json" aria-label="Import catalog backup file" @change="importCatalog">
      </header>
      <div ref="controls" class="controls panel" @beforexrselect.prevent>
        <section v-if="showGuide" class="onboarding" aria-label="Getting started">
          <h1>{{ demo ? 'Explore on your phone' : 'Your designs, within reach' }}</h1>
          <p>{{ demo ? 'Start with a sample below. Place it in the 3D preview, or enter AR on a supported phone.' : 'Pick an item from your catalog and place it as often as you like. Saved items work without returning to your desktop.' }}</p>
          <p v-if="demo">Sample designs stay separate from your saved Figma catalog. Screen copying needs a live desktop plugin.</p>
          <button @click="dismissGuide">Got it</button>
        </section>
        <p role="status">{{ message }}</p>
        <p v-if="pending" class="pending" aria-live="polite">
          <span class="pending-pulse" aria-hidden="true"></span>{{ pending }}
          {{ pending === 1 ? "tap saved" : "taps saved" }} · copying when
          located
        </p>
        <p v-if="storageError" role="alert">{{ storageError }}</p>
        <div class="actions">
          <button v-if="!inXR" class="primary" :disabled="!sceneReady || arAvailable === false" @click="enterAR">
            Enter AR
          </button>
          <button v-else @click="scene?.recalibrate()">
            Recalibrate screen
          </button>
          <button v-if="pending" @click="scene?.cancelPending()">
            Cancel {{ pending }} pending {{ pending === 1 ? "copy" : "copies" }}
          </button>
          <button v-if="sceneError" @click="prepareScene">Retry 3D</button>
          <a v-if="sceneError" :href="diagnosticUrl">Check phone connection</a>
          <button :disabled="!sceneReady" @click="scene?.clear()">Clear placed items</button>
          <button v-if="desktop" @click="bridge.send({ type: 'request-sync' })">
            Refresh catalog
          </button>
          <button :aria-expanded="showCatalog" aria-controls="catalog-panel" @click="showCatalog = !showCatalog">{{ showCatalog ? 'Hide catalog' : 'Show catalog' }}</button>
        </div>
        <p v-if="!inXR && arAvailable === false" class="ar-hint">3D preview is available. This browser does not provide AR.</p>
        <div v-show="showCatalog" id="catalog-panel">
        <label class="search"
          >Catalog · {{ items.length }} items<input
            v-model="query"
            placeholder="Find an item"
            aria-label="Find a catalog item"
        /></label>
        <ul v-if="filtered.length" class="catalog" aria-label="Item catalog">
          <li v-for="item in filtered" :key="item.id">
            <button
              :aria-label="'Place ' + item.name"
              :disabled="!sceneReady"
              @click="place(item)"
            >
              <img :src="item.image" alt="" /><span>{{ item.name }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="empty">
          {{
            items.length
              ? "No matching items."
              : "Open the Figma XR plugin and scan its pairing QR. Your catalog will appear here and remain available after disconnecting."
          }}
        </p>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.companion {
  position: fixed;
  inset: 0;
  background: #09101a;
  color: #eef2fa;
  font-family: Inter, system-ui, sans-serif;
}
.companion canvas {
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}
.companion-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: max(12px, env(safe-area-inset-top)) 12px
    max(12px, env(safe-area-inset-bottom));
  gap: 12px;
}
.panel {
  pointer-events: auto;
  background: rgba(15, 23, 38, 0.94);
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 8px 30px #0004;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mode-label { display:block; color:#c3b6ff; font-size:12px; margin-top:4px; }
.menu { position:relative; flex-shrink:0; }
.menu summary { cursor:pointer; padding:10px; min-height:44px; box-sizing:border-box; }
.menu nav { position:absolute; right:0; top:100%; z-index:2; width:min(260px,75vw); max-height:65dvh; overflow:auto; padding:10px; display:flex; flex-direction:column; gap:6px; border:1px solid #475569; background:#0f1726; border-radius:12px; box-shadow:0 8px 30px #0008; }
.menu nav a, .menu nav button { text-align:left; padding:12px; min-height:44px; box-sizing:border-box; }
.menu small { color:#acbcd4; padding:8px; overflow-wrap:anywhere; }
.file-input { display:none; }
.onboarding { border-bottom:1px solid #334155; padding-bottom:14px; margin-bottom:14px; }
.onboarding h1 { font-size:20px; margin:0 0 8px; line-height:1.3; }
.controls .ar-hint { margin:12px 0 0; color:#acbcd4; }
.top strong {
  font-size: 18px;
}
.connection {
  display: block;
  font-size: 12px;
  color: #b2bfd2;
  margin-top: 3px;
}
.connection.live {
  color: #92e4c1;
}
.top a {
  color: #c5cfff;
  font-size: 13px;
}
.controls {
  max-width: 820px;
  width: 100%;
  align-self: center;
  max-height: min(68dvh, 600px);
  overflow-y: auto;
  box-sizing: border-box;
}
.controls p {
  font-size: 13px;
  margin: 0 0 12px;
  color: #d2dceb;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
button {
  cursor: pointer;
  border: 1px solid #475569;
  border-radius: 9px;
  padding: 9px 12px;
  background: #1d2a40;
  color: #fff;
  font-size: 13px;
  min-height: 44px;
}
.primary {
  background: #6560e8;
  border-color: #8f8bff;
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.actions a {
  color: #c5cfff;
  align-self: center;
  font-size: 13px;
}
.search {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #acbcd4;
  margin: 14px 0 8px;
}
.search input {
  max-width: 55%;
  background: #0e1726;
  border: 1px solid #34445d;
  border-radius: 7px;
  padding: 6px 9px;
  color: white;
}
.catalog {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  list-style: none;
  padding: 0 0 4px;
  margin: 0;
}
.catalog li {
  flex: 0 0 110px;
}
.catalog button {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 110px;
  height: 114px;
  padding: 8px;
  gap: 7px;
}
.catalog img {
  height: 70px;
  width: 90px;
  object-fit: contain;
  background: repeating-conic-gradient(#334155 0% 25%, #263348 0% 50%) 50%/12px
    12px;
  border-radius: 4px;
}
.catalog span {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 92px;
}
.empty {
  padding: 8px 0;
  line-height: 1.5;
}
@media (orientation: landscape) and (max-height: 500px) {
  .controls { max-height: 50dvh; }
}
</style>

<style scoped>
.pending {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #c3b6ff !important;
}
.pending-pulse {
  width: 8px;
  height: 8px;
  background: #b8a5ff;
  border-radius: 50%;
  animation: pending-pulse 1s ease-in-out infinite;
}
@keyframes pending-pulse {
  50% {
    opacity: 0.35;
    transform: scale(1.35);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pending-pulse {
    animation: none;
  }
}
</style>
