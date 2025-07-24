<script lang="ts" setup>
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import SceneManager from "../babylon/scenes/scene.ts";
import { useProjectStore } from '../store/project.store.ts';
import { Skeleton } from '@/components/ui/skeleton';
import { storeToRefs } from 'pinia';
import { useDebounceFn, useElementVisibility } from '@vueuse/core';
const props = defineProps<{
	projectId: string
}>()

const bjsCanvas = ref<HTMLCanvasElement | null>(null);
const { projects } = storeToRefs(useProjectStore());
const project = computed(() => projects.value.get(props.projectId));
const frames = computed(() => {
	return project.value?.images ? Array.from(project.value?.images.values()).filter(frame => frame.image) : [];
});
const sceneManager = ref<SceneManager | undefined>(undefined);

const skeletonMarker = useTemplateRef("skeletonMarker");
const skeletonMarkerIsVisible = useElementVisibility(skeletonMarker)

const debouncedPopulating = useDebounceFn(async (_source, n) => {
	if (skeletonMarkerIsVisible.value && project.value) {
		await useProjectStore().populateNextMissingImagesFromProject(props.projectId, n);
	}
}, 500)

onMounted(() => {
	if (bjsCanvas.value) {
		sceneManager.value = new SceneManager(bjsCanvas.value);
	}
});

watch(skeletonMarkerIsVisible, async () => {
	debouncedPopulating("skeletonvisible", 5);
});

watch(frames, async () => {
	debouncedPopulating("frames", 5);
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
				<Skeleton v-else class="h-19 w-19 rounded-full" on />
			</li>
			<Skeleton ref="skeletonMarker" v-if="frames.length !== project?.images.size" class="h-19 w-19 rounded-full"
				on />
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