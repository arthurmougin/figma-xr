<script setup lang="ts">
import Figma from './components/Figma.vue'
</script>

<template>
  <Figma/>
</template>

<style >
	#app {
		display: grid;
		grid-template-rows: auto 10fr;
		grid-template-areas:
			"header"
			"main";
		height: 100vh;
		width: 100%;
		box-sizing: border-box;
	}
</style>
