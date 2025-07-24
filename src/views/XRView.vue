<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import SceneManager from "../babylon/scenes/scene.ts";
import { useProjectStore } from '../store/project.store.ts';
import { Skeleton } from '@/components/ui/skeleton';
import { storeToRefs } from 'pinia';
const props = defineProps<{
	projectId: string
}>()

const bjsCanvas = ref<HTMLCanvasElement | null>(null);
const { projects } = storeToRefs(useProjectStore());
const project = computed(() => projects.value.get(props.projectId));
const frames = computed(() => project.value?.images ? Array.from(project.value?.images.values()) : []);

const sceneManager = ref<SceneManager | undefined>(undefined);

if ((!frames.value || !frames.value[0] || !frames.value[0].image) && project.value?.id) {
	console.log("fetching images on first load");
	useProjectStore().populateAllImagesFromProject(project.value.id);
}

//if( project changed)
watch(project, async (value, oldValue) => {
	console.log("Project changed");
	if (value?.id && value.id !== oldValue?.id) {
		console.log("Fetching frames for project:", value.id);
		await useProjectStore().populateAllImagesFromProject(value.id);
	}
});

onMounted(() => {
	if (bjsCanvas.value) {
		sceneManager.value = new SceneManager(bjsCanvas.value);
	}
});

</script>

<template>
	<canvas ref="bjsCanvas" class="w-full h-dvh" touch-action="none" />
	<section id="ui-container" class="flex absolute w-full bottom-0 overflow-x-auto overflow-y-hidden">
		<ul class="frames-parent flex flex-nowrap gap-4 px-4 py-2 items-center justify-center">
			<li class="frames" v-for="frame in frames" :key="frame.id">
				<button v-if="frame.image" class="w-max" @click="() => sceneManager?.Spawn(frame)">
					<img :src="frame.image || ''">
				</button>
				<Skeleton v-else class="h-19 w-19 rounded-full" />
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