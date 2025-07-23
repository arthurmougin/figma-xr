<script setup lang="ts">
import { useAuthStore } from '../store/auth.store.ts';
import { LogStateOptions } from '../definition.d';
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem } from '@/components/ui/menubar';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
</script>

<template>
	<MenubarMenu>
		<MenubarTrigger class="flex items-center space-x-2">
			<Avatar v-if="authStore.profile?.img_url">
				<AvatarImage :src="authStore.profile?.img_url || ''" />
			</Avatar>
			<p>{{ authStore.profile?.handle || "Account" }}</p>
		</MenubarTrigger>
		<MenubarContent>
			<MenubarItem v-if="route.name !== 'projects'" @click="router.push({ name: 'projects' })">
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
</template>

<style scoped></style>