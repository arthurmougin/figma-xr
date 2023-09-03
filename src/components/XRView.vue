<script lang="ts" setup>
import {onMounted, ref, toRaw } from 'vue'
import myScene from "../babylon/scenes/scene.ts";

const props = defineProps<{
	currentProject: any
}>();

const bjsCanvas = ref<HTMLCanvasElement|null>(null);
const canvasSize = ref({width: 200, height: 200})
const frames = ref(props.currentProject.document.children[0].children as any[]);
myScene.setFrames(frames.value)


onMounted(async () => {
	if (bjsCanvas.value) {
		await myScene.createScene(bjsCanvas.value);
		updateSize()
	}
});

async function fetchAllFigmaNodeFromProject() {
	const headers = new Headers({
		'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
	})
	let ids = "";
	frames.value.forEach((frame: any) => {
		ids += frame.id + ','
	})
	ids = ids.slice(0, -1);
	const data = await fetch(`https://api.figma.com/v1/images/${props.currentProject.id}?ids=${ids}&format=png&scale=1`, {
		method: 'get',
		headers,
	})
	const json = await data.json();
	if (json.err) {
		console.log(json.err)
	} else {
		frames.value.forEach((frame: any) => {
			frame.image = json.images[frame.id]
		})
		myScene.setFrames(toRaw(frames.value))
	}
}

async function updateSize(){
	//get bjsCanvas parent size
	const parent = bjsCanvas.value?.parentElement
	if (parent) {
		canvasSize.value.width = parent.clientWidth
		canvasSize.value.height = parent.clientHeight-1
	}
	myScene?.Engine?.resize()
}

window.addEventListener('resize', updateSize)
fetchAllFigmaNodeFromProject()
</script>

<template>
	<canvas ref="bjsCanvas" :width="canvasSize.width" :height="canvasSize.height"/>
</template>

<style scoped>
	canvas {
		width: 100%;
		height: 100%;
	}
</style>