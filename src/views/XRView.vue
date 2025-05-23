<script lang="ts" setup>
import { onMounted, Ref, ref } from 'vue';
import { fetchAllFigmaNodeFromProject, getProjectFromStorage } from "../utils";
import { useRouter } from 'vue-router';
import { createScene } from '../babylon/scenes/scene';
import { FrameImage, ProjectData } from '../definition';
const props = defineProps<{
	projectId: string
}>()

const router = useRouter()
const canvas = ref<HTMLCanvasElement | null>(null);
const project : Ref<ProjectData> = ref({} as ProjectData);
const frames = ref([] as FrameImage[]);


async function init(){
	const tmpProject = await getProjectFromStorage(props.projectId)
	if (tmpProject){
		project.value = tmpProject;
		frames.value = await fetchAllFigmaNodeFromProject(project.value) || []
		console.log(project.value,frames.value)
	}
}

onMounted(async () => {
	if (canvas.value) {
		createScene(canvas.value)
	}
});


init()
</script>

<template>
	<div class="bjs-canvas-container">
		<canvas ref="canvas"/>
		<div class="html-ui">
			<mcw-button class="button" raised @click="router.go(-1)">&lt; Back</mcw-button>
			<ul>
				<template v-for="frame in frames">
					<li v-if="frame.image">
						<mcw-button class="md-icon-button"><img :src="frame.image" :alt="`image of node ${frame.id} of type ${frame.nodeType}`"></mcw-button>
					</li>
				</template>
			</ul>
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
	display: flex;
}

.html-ui > button {
	margin: 1em;

}

ul {
	display: flex;
	overflow-x: auto;
	margin: 1em;
}

li {
	display: flex;
}

ul li img {
	height: 3em;
}
</style>