<script lang="ts" setup>
import ProfileTag from "./components/ProfileTag.vue";
import { Menubar, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar';
</script>

<template>
  <Menubar class="mdc-top-app-bar--fixed">
    <MenubarMenu>
      <MenubarTrigger>
        <router-link :to="{ name: 'projects' }">
          <h1 id="title">Figma XR</h1>
        </router-link>
      </MenubarTrigger>
    </MenubarMenu>
    <ProfileTag />
  </Menubar>
  <main>
    <router-view></router-view>
  </main>
</template>

<style scoped>
main {
  margin-top: 1em;
}
</style>
