<script lang="ts" setup>
import { ref } from 'vue';
import { useRouter } from "vue-router";
import { storeToRefs } from 'pinia';

import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { useProjectStore } from '../store/project.store.ts';

const regex =
	/https:\/\/[\w\.-]+\.?figma.com\/([\w-]+)\/([0-9a-zA-Z]{22,128})([?:\/.*])?/;
const router = useRouter();
const projectStore = useProjectStore();
const { projects } = storeToRefs(projectStore);
const projectUrl = ref("");
const message = ref("");
function onAddProject(url: string | number) {
	if (!url || typeof url !== "string") {
		message.value = "Please enter a valid Figma URL.";
		return;
	}
	const match = url.match(regex);
	if (!match) {
		message.value = "Please enter a valid Figma URL.";
		return;
	}
	message.value = "Loading...";
	projectStore.addProject(url)
		.then(() => {
			message.value = "Project added successfully!";
		})
		.catch((err: any) => {
			message.value = "Error adding project : " + err;
		});
}

</script>

<template>
	<ul class="min-h-full flex flex-wrap p-5 pt-20 justify-center align-center items-center space-x-4 space-y-4">
		<li v-if="projects" v-for="project in projects?.values()">
			<Card>
				<CardContent class="">
					<img :src="project.thumbnailUrl" class="w-50 h-auto"></img>
				</CardContent>
				<CardFooter class="flex-col items-start">
					<p class="font-bold text-2xl ">{{ project.name }}</p>
					<div class="flex justify-between w-full">
						<Button raised
							@click="router.push({ name: 'xrview', params: { projectId: project.id } })">Open</Button>
						<Button outlined @click="projectStore.removeProject(project.id)">Delete </Button>
					</div>
				</CardFooter>
			</Card>
		</li>
		<li id="add" class="flex flex-col text-center align-center justify-center space-y-2 ">
			<a target="_blank" href="https://www.figma.com/files"><Button outlined>Find projects you want to see in
					XR</Button></a>
			<Textarea v-model="projectUrl" placeholder="And paste their link here"
				@update:model-value="onAddProject($event)" />
			<p class="text-sm text-muted-foreground">
				{{ message }}
			</p>
		</li>
	</ul>
</template>

<style scoped></style>