import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import VueMaterialAdapter from 'vue-material-adapter'

const app = createApp(App)
app.use(VueMaterialAdapter)
app.mount('#app')

