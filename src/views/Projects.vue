<script lang="ts" setup>
import { ref } from 'vue';
import { useRouter } from "vue-router";
import { useProjectStore } from '../store/project.store.ts';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const router = useRouter();
const projectStore = useProjectStore();
const projectUrl = ref("");
const message = ref("");

function onAddProject() {
	if (!projectUrl.value) {
		message.value = "Please enter a valid Figma URL.";
		return;
	}
	message.value = "Loading...";
	projectStore.addProject(projectUrl.value)
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
	<ul class="min-h-full flex flex-wrap p-5 pt-20 justify-center align-center items-center space-x-4 space-y-4">
		<li v-if="projectStore.projects" v-for="project in projectStore.projects?.values()">
			<Card>
				<CardContent class="">
					<img :src="project.thumbnailUrl" class="w-50 h-auto"></img>
				</CardContent>
				<CardFooter class="flex-col items-start">
					<p class="font-bold text-2xl ">{{ project.name }}</p>
					<div class="flex justify-between w-full">
						<Button raised
							@click=" router.push({ name: 'xrview', params: { projectId: project.id } })">Open</Button>
						<Button outlined @click="projectStore.removeProject(project.id)">Delete </Button>
					</div>
				</CardFooter>
			</Card>
		</li>
		<li id="add" class="flex flex-col text-center align-center justify-center space-y-2 ">
			<a target="_blank" href="https://www.figma.com/files"><Button outlined>Find projects you want to see in
					XR</Button></a>
			<Textarea v-model="projectUrl" :placeholder="message ? message : 'And paste their link here'"
				@input="(event: Event) => { projectUrl = (event.target as HTMLInputElement).value; onAddProject() }" />
		</li>
	</ul>
</template>

<style scoped></style>