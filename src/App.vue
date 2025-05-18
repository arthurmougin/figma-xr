<script lang="ts" setup>
import ProfileTag from "./components/ProfileTag.vue";
import { ref } from "vue";
import { useStore } from "./store";
const errorMessage = ref("");
const open = ref(false);

const store = useStore();
store.initiateAuth()
</script>

<template>
  <mcw-top-app-bar class="mdc-top-app-bar--fixed">
    <router-link to="/projects"><h1 id="title">Figma XR</h1></router-link>
    <suspense><ProfileTag /></suspense>
  </mcw-top-app-bar>
  <mcw-snackbar
    v-model="open"
    :message="errorMessage"
    :dismissAction="true"
  ></mcw-snackbar>
  <main>
    <router-view></router-view>
  </main>
</template>

<style scoped>
.mdc-top-app-bar.mdc-top-app-bar--fixed {
  flex-direction: row;
  align-items: center;
  padding: 0 1em;
  top: 0;
  position: sticky;
  padding: 0.5em;
}

h1#title {
  font-weight: bold;
  font-size: 2em;
  color: var(--accent);
}

main {
  margin-top: 1em;
}
</style>
