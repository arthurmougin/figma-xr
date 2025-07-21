<script lang="ts" setup>
import { ref } from 'vue';
import { useRouter } from "vue-router";
import { useProjectStore } from '../store/project.store.ts';

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
			<mcw-card>
				<mcw-card-primary-action @click="router.push({ name: 'xrview', params: { projectId: project.id } })">
					<mcw-card-media :src="project.thumbnailUrl" wide></mcw-card-media>
				</mcw-card-primary-action>
				<section>
					<h2>{{ project.name }}</h2>
				</section>
				<mcw-card-actions>
					<mcw-card-action-buttons>
						<mcw-button raised
							@click="router.push({ name: 'xrview', params: { projectId: project.id } })">Open</mcw-button>
						<mcw-button outlined @click="useProjectStore().removeProject(project.id)">Delete </mcw-button>
					</mcw-card-action-buttons>
				</mcw-card-actions>
			</mcw-card>
		</li>
		<li id="add">
			<a target="_blank" href="https://www.figma.com/files"><mcw-button outlined>Find projects you want to see in
					XR</mcw-button></a>
			<mcw-textfield v-model="projectUrl" :label="message ? message : 'And paste their link here'"
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