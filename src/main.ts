import { createApp, markRaw } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

import "./styles/style.css";
import App from "./App.vue";
import router from "./router";
import "./definition.d";

const pinia = createPinia();
const app = createApp(App);
app.use(router);

pinia.use(({ store }) => {
	store.router = markRaw(router);
});
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.mount("#app");

const path = localStorage.getItem("path");
if (path) {
	localStorage.removeItem("path");
	router.push(path);
}
