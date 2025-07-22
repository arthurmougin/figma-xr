<script setup lang="ts">
import { useAuthStore } from '../store/auth.store.ts';
import { LogStateOptions } from '../definition.d';
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem } from '@/components/ui/menubar';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
</script>

<template>
	<MenubarMenu>
		<MenubarTrigger>
			<Avatar>
				<AvatarImage :src="useAuthStore().profile?.img_url || ''" />
			</Avatar>
			<p v-if="useAuthStore().profile?.handle">{{ useAuthStore().profile?.handle }}</p>
			<p v-else>Account</p>
		</MenubarTrigger>
		<MenubarContent>
			<MenubarItem v-if="useAuthStore().state === LogStateOptions['logged in']" @click="useAuthStore().logout">
				Logout
			</MenubarItem>
			<MenubarItem v-else @click="useAuthStore().login">
				Login
			</MenubarItem>

		</MenubarContent>
	</MenubarMenu>
</template>

<style scoped></style>