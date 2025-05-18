<script setup lang="ts">
import { ref, watch} from 'vue'
import {logStateOptions} from "../definition.d";
import { useStore } from '../store';

const store = useStore();

const logState = ref(store.isLoggedIn ? logStateOptions['logged in'] : logStateOptions['not logged in'])
const profile = store.profile
if (logState.value === logStateOptions['logged in'] && profile == null) {
	store.getProfile()
}

watch (store, async ()=> {
	if (store.isLoggedIn ) {
		logState.value = logStateOptions['logged in']
	}
	else {
		logState.value = logStateOptions['not logged in']
	}
})

</script>

<template>
	<img v-if="logState == logStateOptions['logged in']" v-bind:src="profile?.img_url">
	<p v-if="profile?.handle">{{profile?.handle}}</p>
	<mcw-button id="login" raised v-if="logState != logStateOptions['logged in']" @click="store.login">Login</mcw-button>
	<mcw-button raised v-if="logState == logStateOptions['logged in']" @click="store.logout">Logout</mcw-button>
</template>

<style scoped>
	div {
		display: flex;
		flex-direction: row;
		align-items: center;
		flex-wrap: wrap;
		align-content: center;
		justify-content: flex-end;
		color:var(--text)
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