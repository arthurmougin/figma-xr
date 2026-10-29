<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { CompanionBridge } from "../companion/bridge";
import { CompanionScene } from "../companion/scene";
const bridge = new CompanionBridge();
const { items, status, desktop, storageError } = bridge;
const canvas = ref<HTMLCanvasElement | null>(null),
  overlay = ref<HTMLElement | null>(null);
const inXR = ref(false),
  scanning = ref(false),
  message = ref("Your Figma catalog, ready to place in space."),
  query = ref("");
let scene: CompanionScene | null = null;
const filtered = computed(() =>
  items.value.filter((item) =>
    item.name.toLowerCase().includes(query.value.toLowerCase()),
  ),
);
watch(items, (value) => scene?.updateCatalog(value));
watch(bridge.snapshot, (value) => scene?.updateSnapshot(value));
async function enterAR() {
  if (!scene || !overlay.value) return;
  try {
    await scene.enterXR(overlay.value);
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : "Could not enter AR.";
  }
}
function scan() {
  scanning.value = !scanning.value;
  scene?.setScanning(scanning.value);
}
onMounted(async () => {
  if (canvas.value) {
    scene = new CompanionScene(canvas.value);
    scene.onStatus = (value) => (message.value = value);
    scene.onXR = (active) => {
      inXR.value = active;
      if (!active) scanning.value = false;
    };
    scene.onClone = (id) => bridge.send({ type: "highlight", id });
  }
  await bridge.start();
  scene?.updateCatalog(items.value);
  scene?.updateSnapshot(bridge.snapshot.value);
});
onBeforeUnmount(() => {
  bridge.dispose();
  scene?.dispose();
});
</script>
<template>
  <div class="companion">
    <canvas ref="canvas" aria-label="Figma XR scene" />
    <div ref="overlay" class="companion-overlay">
      <header class="panel top" @beforexrselect.prevent>
        <div>
          <strong>Figma XR</strong
          ><span class="connection" :class="{ live: desktop }">{{
            status
          }}</span>
        </div>
        <router-link :to="{ name: 'landingpage' }" aria-label="Back to home"
          >Home</router-link
        >
      </header>
      <div class="controls panel" @beforexrselect.prevent>
        <p role="status">{{ message }}</p>
        <p v-if="storageError" role="alert">{{ storageError }}</p>
        <div class="actions">
          <button v-if="!inXR" class="primary" @click="enterAR">
            Enter AR
          </button>
          <button
            v-else
            :class="{ primary: scanning }"
            :aria-pressed="scanning"
            @click="scan"
          >
            {{ scanning ? "Stop scanning" : "Scan desktop" }}
          </button>
          <button @click="scene?.clear()">Clear placed items</button>
          <button v-if="desktop" @click="bridge.send({ type: 'request-sync' })">
            Refresh catalog
          </button>
        </div>
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
              @click="scene?.place(item)"
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
}
.primary {
  background: #6560e8;
  border-color: #8f8bff;
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
</style>
