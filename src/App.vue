<script lang="ts" setup>
import ProfileTag from "./components/ProfileTag.vue";
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, Menubar } from '@/components/ui/menubar';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from './store/auth.store.ts';
import { LogStateOptions } from './definition.d';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
//login check
if (!location.pathname.endsWith("/companion")) authStore.checkLogin();

</script>

<template>
  <Menubar v-if="route.name !== 'companion'" class="absolute top-0 p-0 left-0 right-0 z-50 w-full inline-flex justify-between box-border ">
    <MenubarMenu>
      <MenubarTrigger>
        <router-link :to="{ name: 'projects' }">
          <h1 id="title">Figma XR</h1>
        </router-link>
      </MenubarTrigger>
    </MenubarMenu>

    <MenubarMenu>
      <MenubarTrigger class="flex items-center space-x-2">
        <ProfileTag />
      </MenubarTrigger>
      <MenubarContent>
        <MenubarItem v-if="route.name == 'xrview'" @click="router.push({ name: 'projects' })">
          Projects
        </MenubarItem>
        <MenubarItem v-if="authStore.state === LogStateOptions['logged in']" @click="authStore.logout">
          Logout
        </MenubarItem>
        <MenubarItem v-else @click="authStore.login">
          Login
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  </Menubar>
  <main class="min-h-dvh">
    <p v-if="authStore.error && route.name !== 'companion'" role="alert" class="relative mt-16 p-4 text-destructive bg-background">{{ authStore.error }}</p>
    <router-view></router-view>
  </main>
</template>

<style scoped></style>
