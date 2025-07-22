<script setup lang="ts">
import { useAuthStore } from '../store/auth.store.ts';
import { LogStateOptions } from '../definition.d';

console.log('ProfileTag mounted', useAuthStore().state);
</script>

<template>
	<img v-if="useAuthStore().profile" v-bind:src="useAuthStore().profile?.img_url">
	<p v-if="useAuthStore().profile?.handle">{{ useAuthStore().profile?.handle }}</p>
	<mcw-button raised v-if="useAuthStore().state === LogStateOptions['logged in']"
		@click="useAuthStore().logout">Logout</mcw-button>
	<mcw-button id="login" raised v-else @click="useAuthStore().login">Login</mcw-button>
</template>

<style scoped>
div {
	display: flex;
	flex-direction: row;
	align-items: center;
	flex-wrap: wrap;
	align-content: center;
	justify-content: flex-end;
	color: var(--text)
}

div * {
	margin: 0 0.5em;
}

img {
	width: 3em;
	height: 3em;
	border-radius: 3px;
}

#login {
	background-color: var(--mdc-theme-secondary);
	color: white;
}
</style>