<script setup lang="ts">
import { LogStateOptions } from "../definition.d";
import { useAuthStore } from '../store/auth.store';
const oauthStore = useAuthStore();
</script>

<template>
	<div>
		<img v-if="oauthStore.profile?.img_url" v-bind:src="oauthStore.profile?.img_url">
		<p v-if="oauthStore.profile?.handle">{{ oauthStore.profile?.handle }}</p>
		<mcw-button id="login" raised v-if="oauthStore.state != LogStateOptions['logged in']"
			@click="oauthStore.login">Login</mcw-button>
		<mcw-button raised v-if="oauthStore.state == LogStateOptions['logged in']"
			@click="oauthStore.logout">Logout</mcw-button>
	</div>
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