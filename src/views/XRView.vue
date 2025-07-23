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

project.value = useProjectStore().projects.get(props.projectId);
frames.value = project.value?.document.children[0].children as TwickedFrameNode[];

watch(project, async (project: PurgedProject | undefined) => {
	if (project) {
		frames.value = await useProjectStore().fetchAllFigmaNodeFromProject(project.id);
		updateSize
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

</script>

<template>
	<canvas ref="bjsCanvas" class="w-full h-dvh" :width="canvasSize.width * 2" :height="canvasSize.height * 2"
		touch-action="none" />
	<section id="ui-container" class="flex absolute w-full bottom-0 overflow-x-auto overflow-y-hidden">
		<ul class="frames-parent flex flex-nowrap gap-4 px-4 py-2 items-center justify-center">
			<li class="frames" v-for="frame in frames" :key="frame.id">
				<button class="w-max" @click="() => sceneManager?.Spawn(frame)">
					<img :src="frame.image || ''">
				</button>
			</li>
		</ul>
	</section>

</template>

<style scoped>
.frames img {
	max-width: 75px;
	max-height: 75px;
	min-width: 20px;
	min-height: 20px;
}
</style>