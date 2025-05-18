import { createApp, markRaw } from 'vue'
import './style.css'
import App from './App.vue'
import VueMaterialAdapter from 'vue-material-adapter'
import router from './router';
import { createPinia } from 'pinia';
import { Router } from 'vue-router';

declare module 'pinia' {
  export interface PiniaCustomProperties {
    router: Router;
  }
}

const app = createApp(App)
const pinia = createPinia();
pinia.use(({ store }) => {
  store.router = markRaw(router);
});
app.use(VueMaterialAdapter)
app.use(router)
app.use(pinia);
app.mount('#app')