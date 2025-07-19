import { createApp, markRaw } from "vue";
import { createPinia } from "pinia";
import VueMaterialAdapter from "vue-material-adapter";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

import "./style.css";
import App from "./App.vue";
import router from "./router";
import { Router } from "vue-router";

declare module "pinia" {
	export interface PiniaCustomProperties {
		router: Router;
	}
}

const pinia = createPinia();
const app = createApp(App);
app.use(VueMaterialAdapter);
app.use(router);

pinia.use(({ store }) => {
	store.router = markRaw(router);
});
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.mount("#app");
