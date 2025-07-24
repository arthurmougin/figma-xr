<script setup lang="ts">
import { useAuthStore } from '../store/auth.store.ts';
import { Avatar, AvatarImage } from '@/components/ui/avatar';

const authStore = useAuthStore();
</script>

<template>
	<Avatar v-if="authStore.profile?.img_url">
		<AvatarImage :src="authStore.profile?.img_url || ''" />
	</Avatar>
	<p>{{ authStore.profile?.handle || "Account" }}</p>

</template>

<style scoped></style>