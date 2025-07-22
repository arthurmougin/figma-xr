<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';
import SceneManager from "../babylon/scenes/scene.ts";
import { useProjectStore } from '../store/project.store.ts';
import { TwickedFrameNode, PurgedProject } from '../definition';
import { Button } from '@/components/ui/button';
const props = defineProps<{
	projectId: string
}>()

const bjsCanvas = ref<HTMLCanvasElement | null>(null);
const canvasSize = ref({ width: 200, height: 200 })
const project = ref(undefined as PurgedProject | undefined);
const frames = ref([] as TwickedFrameNode[]);
const sceneManager = ref(undefined as SceneManager | undefined);

watch(project, async (project: PurgedProject | undefined) => {
	if (project) {
		frames.value = await useProjectStore().fetchAllFigmaNodeFromProject(project.id);
		//sceneManager.value?.setFrames(frames.value);
	}
})

onMounted(async () => {
	if (bjsCanvas.value) {
		sceneManager.value = new SceneManager(bjsCanvas.value);
		updateSize()
	}
});


async function updateSize() {
	const parent = bjsCanvas.value?.parentElement
	if (parent) {
		canvasSize.value.width = parent.clientWidth
		canvasSize.value.height = parent.clientHeight - 1
	}
	sceneManager.value?.engine?.resize(true)
}

window.addEventListener('resize', updateSize)

project.value = useProjectStore().projects.get(props.projectId);
</script>

<template>
	<div class="bjs-canvas-container">
		<canvas ref="bjsCanvas" :width="canvasSize.width * 2" :height="canvasSize.height * 2" touch-action="none" />
		<section id="ui-container">
			<ul class="frames-parent">
				<li class="frames" v-for="frame in frames" :key="frame.id"><Button
						@click="() => sceneManager?.Spawn(frame)"><img :src="frame.image || ''"></Button></li>
			</ul>
		</section>
	</div>

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

#ui-container {
	position: absolute;
	bottom: 0;
	width: 100%;
	overflow-x: scroll;
	overflow-y: hidden;
	display: flex;
	align-items: flex-end;
}

.frames-parent {
	padding: 1em;
	display: flex;
	flex-wrap: nowrap;
	gap: 8px;
}

.frames img {
	width: 75px;
	height: 75px;
}
</style>