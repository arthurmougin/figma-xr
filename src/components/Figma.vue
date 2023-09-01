<script lang="ts" setup>
import {ref} from 'vue'
import {logStateOptions, ProfileType} from "../definition.d";
import Projects from "./Projects.vue";
import XRView from "./XRView.vue";
import Profile from "./Profile.vue";

const logState = ref(logStateOptions['not logged in'])
const currentUrl = new URL(window.location.href);
const profileData = ref<ProfileType | null>(null)
const currentProject = ref<any|null>(null)

function login() {
	const state = Math.random().toString(36).substring(7);
	localStorage.setItem('figmaState', state)
	const url = new URL(`https://www.figma.com/oauth?client_id=${import.meta.env.VITE_ID}&redirect_uri=${encodeURI(currentUrl.toString())}?callback&scope=file_read&state=${state}&response_type=code`)
	window.location.replace(url.toString())
}

function logout() {
	localStorage.removeItem('access_token')
	localStorage.removeItem('expires_in')
	localStorage.removeItem('refresh_token')
	logState.value = logStateOptions['not logged in']
	currentUrl.searchParams.delete('callback')
	currentUrl.searchParams.delete('code')
	currentUrl.searchParams.delete('state')
	window.location.replace(currentUrl.toString())
}

function isLoggedIn() {
	const access_token = localStorage.getItem('access_token')
	const expires_in = localStorage.getItem('expires_in')
	if (access_token === null || expires_in === null) {
		return false
	}
	if (Date.now() > parseInt(expires_in)) {
		return false
	}
	return true
}

async function fetchProfile() {
	const headers = new Headers({
		'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
	})
	const data = await fetch('https://api.figma.com/v1/me', {
		method: 'get',
		headers
	})
	const json = await data.json();
	profileData.value = json;
}

async function init() {
	if (isLoggedIn()) {
		logState.value = logStateOptions['logged in']
		fetchProfile()
	} else if (currentUrl.searchParams.has('callback')) {
		if (currentUrl.searchParams.get('state') == localStorage.getItem('figmaState')) {
			logState.value = logStateOptions['logging in']
			const getTokenUrl = `https://www.figma.com/api/oauth/token?client_id=${import.meta.env.VITE_ID}&client_secret=${import.meta.env.VITE_SECRET}&redirect_uri=${currentUrl}?callback&code=${currentUrl.searchParams.get('code') || ''}&grant_type=authorization_code`;
			const data = await fetch(getTokenUrl, {
				method: 'post'
			})
			const json = await data.json();
			localStorage.setItem('access_token', json.access_token)
			localStorage.setItem('expires_in', ((parseInt(json.expires_in) * 24 * 60 * 60) + Date.now()).toString())
			localStorage.setItem('refresh_token', json.refresh_token)

			currentUrl.searchParams.delete('callback')
			currentUrl.searchParams.delete('code')
			currentUrl.searchParams.delete('state')
			window.location.replace(currentUrl.toString())
		} else {
			console.error('state mismatch')
			logState.value = logStateOptions['error']
		}
	}
}

init()

</script>

<template>
	<mcw-top-app-bar class="mdc-top-app-bar--fixed">
		<button @click="currentProject = null"><h1>Figma XR {{ currentProject ? ` | ${currentProject.name}`:''}}</h1></button>
		<Profile
			:logState="logState"
			:login="login"
			:logout="logout"
			:profile="profileData"
		/>
	</mcw-top-app-bar>
	<main>
		<Projects
			v-if="logState == logStateOptions['logged in'] && currentProject == null"
			:open-project="(data:any)=> { currentProject = data; }"
			:profile="profileData" />
		<XRView
			v-else-if="logState == logStateOptions['logged in'] && currentProject != null"
			:currentProject="currentProject"
		/>
		<div v-else>
			<ol>
				<li>Login to Figma to get Started</li>
				<li>Add your projects by grabbing their url</li>
				<li>Open the project of your choice in XR</li>
				<li>Enjoy!</li>
			</ol>

		</div>
	</main>
</template>

<style scoped>
	.mdc-top-app-bar.mdc-top-app-bar--fixed {
		grid-area: header;
		flex-direction: row;
		align-items: center;
		position: relative;
		padding: 0 1em;
		top: 0;
	}
	main {
		grid-area: main;
		overflow: hidden;
	}

	button {
		background: none;
		border: none;
		color: white;
	}


</style>
