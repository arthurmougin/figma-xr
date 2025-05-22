<script lang="ts" setup>
	import {onMounted, ref, toRaw, watch } from 'vue';
	import myScene from "../babylon/scenes/scene.ts";
	import {getProject, updateProject} from "../utils";
	import localForage from 'localforage';
import { useRouter } from 'vue-router';
	const props = defineProps<{ 
		projectId: string 
	}>()

	const bjsCanvas = ref<HTMLCanvasElement|null>(null);
	const canvasSize = ref({width: 200, height: 200})
	const project = ref({} as any);
	const frames = ref([] as any[]);

	watch( project,(project:any) => {
		frames.value = project.document.children[0].children as any[]
		fetchAllFigmaNodeFromProject()
	})


	onMounted(async () => {
		if (bjsCanvas.value) {
			await myScene.createScene(bjsCanvas.value);
			updateSize()
		}
		
	});

	async function fetchAllFigmaNodeFromProject() {
		const headers = new Headers({
			'Authorization': `Bearer ${await localForage.getItem('access_token') || ''}`
		})
		let ids = "";
		frames.value.forEach((frame: any) => {
			ids += frame.id + ','
		})
	
		ids = ids.slice(0, -1);
		const data = await fetch(`https://api.figma.com/v1/images/${project.value.id}?ids=${ids}&format=png&scale=1`, {
			method: 'get',
			headers,
		})
		const json = await data.json();
		if (json.err) {
			console.error(json.err)
		} else {
			frames.value.forEach((frame: any) => {
				//console.log("found for frame",json.images[frame.id])
				if (json.images[frame.id]) frame.image = json.images[frame.id]
			})
			project.value.document.children[0].children = frames.value
			updateProject(toRaw(project.value));

			myScene.setFrames(toRaw(frames.value))
		}
	}

	async function updateSize(){
		//console.log("resize")
		//get bjsCanvas parent size
		const parent = bjsCanvas.value?.parentElement
		if (parent) {
			canvasSize.value.width = parent.clientWidth
			canvasSize.value.height = parent.clientHeight-1
			//console.log(canvasSize.value)
		}
		myScene?.Engine?.resize(true)
	}

	window.addEventListener('resize', updateSize)
	async function init () {
		const tmpProject = await getProject(props.projectId)
		if (tmpProject)
			project.value = tmpProject;
	}
	init()
	
	const router = useRouter()
</script>

<template>
	<div class="bjs-canvas-container">
		<canvas ref="bjsCanvas" :width="canvasSize.width * 2" :height="canvasSize.height * 2" touch-action="none"/>
	</div>
	
    <mcw-button @click="router.go(-1)">&lt; Back</mcw-button>
</template>

<style scoped>
	canvas {
		width: 100%;
		height: 100%;
		touch-action: none;
    	-webkit-tap-highlight-color: transparent;
    	user-select: none;
	}

	.bjs-canvas-container {
		width: 95%;
		max-width: 70em;
		height: 75vh;
		height: 78dvh;
		max-height: 50em;
		margin: auto;
		box-sizing: content-box;
		box-shadow: 0px 0px 10px #0000005c;
		touch-action: none;
    	-webkit-tap-highlight-color: transparent;
	}
	
</style>