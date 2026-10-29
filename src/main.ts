import { createApp, markRaw } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

import "./styles/style.css";
import App from "./App.vue";
import router from "./router";
import "./definition.d";

const pinia = createPinia();
const app = createApp(App);

pinia.use(({ store }) => {
	store.router = markRaw(router);
});
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.use(router);
const restored = sessionStorage.getItem("figma-xr-route");
sessionStorage.removeItem("figma-xr-route");
localStorage.removeItem("path"); // Retire the old Pages fallback.
async function mount() {
  if (restored?.startsWith("/") && !restored.startsWith("//")) await router.replace(restored);
  await router.isReady();
  app.mount("#app");
}
void mount();
