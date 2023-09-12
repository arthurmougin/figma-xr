<script setup lang="ts">
import {logStateOptions,ProfileType} from "../definition.d";
defineProps<{
  logState:logStateOptions,
  login:()=>void,
  logout:()=>void,
  profile:ProfileType|null,
}>()

</script>

<template>
	<div>
	    <img v-if="logState == logStateOptions['logged in']" v-bind:src="profile?.img_url">
	    <p v-if="profile?.handle">{{profile?.handle}}</p>
	    <mcw-button id="login" raised v-if="logState != logStateOptions['logged in']" @click="login">Login</mcw-button>
	    <mcw-button raised v-if="logState == logStateOptions['logged in']" @click="logout">Logout</mcw-button>
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