<script setup lang="ts">
import { ref, watch} from 'vue'
import {logStateOptions,ProfileType} from "../definition.d";
import { isLoggedIn, login, logout } from "../utils";
import { useRouter,useRoute } from "vue-router";

const logState = ref(isLoggedIn() ? logStateOptions['logged in'] : logStateOptions['not logged in'])
const profile = ref<ProfileType | null>(null)
const router = useRouter()
const route = useRoute()

async function getProfile (){
	console.log("getting profile")
	const headers = new Headers({
		'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
	})
	let data:any = {}

	try{
		data = await fetch('https://api.figma.com/v1/me', {
			method: 'get',
			headers
		})
	}
	catch(e) {
		console.log(e)
		logout(router);
	}
	finally {
		const json = await data.json();
		profile.value = json;
	}

}


watch (logState, async (newVal) => {
	if (newVal == logStateOptions['logged in']) {
		console.log("logged in, getting profile")
		await getProfile()
	} else {
		profile.value = null
	}
})


watch (route, e=> {
	console.log("route changed", e)
	if (isLoggedIn()) {
		logState.value = logStateOptions['logged in']
	}
	else {
		logState.value = logStateOptions['not logged in']
	}
})


function locLogOut() {
	logState.value = logStateOptions['not logged in']
	logout(router)
}

if (logState.value === logStateOptions['logged in']) {
	console.log("logged in, getting profile")
	getProfile()
}

</script>

<template>
	<div>
	    <img v-if="logState == logStateOptions['logged in']" v-bind:src="profile?.img_url">
	    <p v-if="profile?.handle">{{profile?.handle}}</p>
	    <mcw-button id="login" raised v-if="logState != logStateOptions['logged in']" @click="login">Login</mcw-button>
	    <mcw-button raised v-if="logState == logStateOptions['logged in']" @click="locLogOut">Logout</mcw-button>
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