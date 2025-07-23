<script lang="ts" setup>
import ProfileTag from "./components/ProfileTag.vue";
import { Menubar, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar';
</script>

<template>
  <Menubar class="absolute top-0 p-0 left-0 right-0 z-50 w-full inline-flex justify-between box-border ">
    <MenubarMenu>
      <MenubarTrigger>
        <router-link :to="{ name: 'projects' }">
          <h1 id="title">Figma XR</h1>
        </router-link>
      </MenubarTrigger>
    </MenubarMenu>
    <ProfileTag />
  </Menubar>
  <main class="min-h-dvh">
    <router-view></router-view>
  </main>
</template>

<style scoped></style>
