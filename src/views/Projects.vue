<script lang="ts" setup>
import { ref } from 'vue';
import { useRouter } from "vue-router";
import { useProjectStore } from '../store/project.store.ts';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CardHeader from '@/components/ui/card/CardHeader.vue';

const router = useRouter();
const projectUrl = ref("");
const message = ref("");

function onAddProject() {
	if (!projectUrl.value) {
		message.value = "Please enter a valid Figma URL.";
		return;
	}
	message.value = "Loading...";
	useProjectStore().addProject(projectUrl.value)
		.then(() => {
			message.value = "Project added successfully!";
			projectUrl.value = "";
		})
		.catch((err: any) => {
			message.value = "Error adding project : " + err;
		});
}

</script>

<template>
	<ul>
		<li v-if="useProjectStore().projects" v-for="project in useProjectStore().projects?.values()">
			<Card>
				<CardHeader>{{ project.name }}</CardHeader>
				<CardContent>
					<img :src="project.thumbnailUrl" wide></img>
				</CardContent>
				<CardFooter>
					<Button raised
						@click="router.push({ name: 'xrview', params: { projectId: project.id } })">Open</Button>
					<Button outlined @click="useProjectStore().removeProject(project.id)">Delete </Button>
				</CardFooter>
			</Card>
		</li>
		<li id="add">
			<a target="_blank" href="https://www.figma.com/files"><Button outlined>Find projects you want to see in
					XR</Button></a>
			<TextArea v-model="projectUrl" :placeholder="message ? message : 'And paste their link here'"
				@input="(event: Event) => { projectUrl = (event.target as HTMLInputElement).value; onAddProject() }" />
		</li>
	</ul>

</template>

<style scoped>
ul {
	list-style: none;
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	align-content: center;
	justify-content: center;
	align-items: center;
	margin: 0;
	padding: 0;
}

li {
	margin: 1em;
}

.mdc-card__action-buttons>*:first-child {
	margin-right: 0.5em;
}

#add {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

#add>* {
	margin: 0.5em;
}

.mdc-button--outlined {
	padding: 0.5em;
	position: relative;
	box-sizing: content-box;
}
</style>