<script lang="ts" setup>
import Profile from "./Profile.vue";
</script>

<template>
  <mcw-top-app-bar class="mdc-top-app-bar--fixed">
    <router-link to="/projects"><h1 id="title">Figma XR</h1></router-link>
    <suspense><Profile /></suspense>
  </mcw-top-app-bar>
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
