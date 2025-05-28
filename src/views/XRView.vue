<script lang="ts" setup>
import { onMounted, Ref, ref, toRaw } from 'vue';
import { fetchAllFigmaNodeFromProject, getProjectFromStorage } from "../utils";
import { useRouter } from 'vue-router';
import { createScene } from '../babylon/scenes/scene';
import { FrameImage, ProjectData } from '../definition';
const props = defineProps<{
	projectId: string
}>()

const router = useRouter()
const canvas = ref<HTMLCanvasElement | null>(null);
const project: Ref<ProjectData> = ref({} as ProjectData);
const frames = ref([] as FrameImage[]);
const callToBabylon = ref<(data: FrameImage) => void>(() => {});


async function init() {
	const tmpProject = await getProjectFromStorage(props.projectId)
	if (tmpProject) {
		project.value = tmpProject;
		frames.value = await fetchAllFigmaNodeFromProject(project.value) || []
	}
}

onMounted(async () => {
	if (canvas.value) {
		callToBabylon.value = await createScene(canvas.value)
	}
});


init()

const onPrimaryAction = (data : FrameImage) => {
	console.log("Primary action triggered");
	callToBabylon.value(toRaw(data));
}
</script>

<template>
	<div class="bjs-canvas-container">
		<canvas ref="canvas" />
		<div class="html-ui">
			<ul>
				<template v-for="frame in frames">
					<li v-if="frame.image">
						<mcw-card>
							<mcw-card-primary-action @click="onPrimaryAction(frame)">
								<mcw-card-media :src="frame.image" square></mcw-card-media>
							</mcw-card-primary-action>
							<section>
								<h3>{{ frame.name }}</h3>
							</section>
						</mcw-card>
					</li>
				</template>
			</ul>
			<mcw-button class="button" raised @click="router.go(-1)">&lt; Back</mcw-button>
		</div>
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
	position: relative;
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


.html-ui {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 0;
	display: flex;
}

.html-ui>button {
	position: absolute;
	margin: 1em;
	bottom: -2em;
}

ul {
	display: flex;
	overflow-x: auto;
	padding: 1em;
	flex-direction: row;
	flex-wrap: nowrap;
	align-items: center;
}

li {
	display: flex;
	padding: 0.5em;
}

h3 {
	padding: 0.5em;
	width: 5em;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>