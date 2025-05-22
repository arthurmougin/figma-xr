<script setup lang="ts">
import { watch} from 'vue';
import { useStore } from '../store';
import { storeToRefs } from 'pinia';

const store = useStore();


const { isLoggedIn } = storeToRefs(store)
watch(isLoggedIn, () => {
	if (store.isLoggedIn && store.profile == null) {
		store.getProfile()
	}
})

</script>

<template>
	<img v-if="store.isLoggedIn" v-bind:src="store.profile?.img_url">
	<p v-if="store.profile?.handle">{{store.profile?.handle}}</p>
	<mcw-button id="login" raised v-if="!store.isLoggedIn" @click="store.login">Login</mcw-button>
	<mcw-button raised v-if="store.isLoggedIn" @click="store.logout">Logout</mcw-button>
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