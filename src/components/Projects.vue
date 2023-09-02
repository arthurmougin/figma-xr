<script lang="ts" setup>
import {ref} from 'vue';
import {ProfileType} from "../definition.d";

defineProps<{
	profile: ProfileType | null,
	openProject: (data: any) => void
}>()
const projects = ref(localStorage.getItem("projects") ? JSON.parse(localStorage.getItem("projects") as string) : []);
const projectUrl = ref("");
const message = ref("");
const regex = /https:\/\/([\w\.-]+\.)?figma.com\/(file|proto)\/([0-9a-zA-Z]{22,128})(?:\/.*)?$/

async function onAddProject() {
	const url = projectUrl.value
	//test si regex marche, si oui ajoute projet, sinon attend
	const match = url.match(regex)
	if (match) {
		message.value = "Project being imported locally..."
		const fileId = url.split("/")[4];
		const fileData = await fetchProject(fileId)
		projects.value.push(fileData);
		localStorage.setItem("projects", JSON.stringify(projects.value))
		message.value = "";
		projectUrl.value = ""
	} else {
		if (projectUrl.value != "") message.value = "not recognized as project url."
		else message.value = ""
	}
}

async function removeProject(id: string) {
	projects.value.splice(projects.value.findIndex((project: any) => project.id == id), 1);
	localStorage.setItem("projects", JSON.stringify(projects.value))
}

async function fetchProject(id: string) {
	console.log("fetching project")
	const headers = new Headers({
		'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
	})
	const data = await fetch(`https://api.figma.com/v1/files/${id}`, {
		method: 'get',
		headers
	})
	const project = await data.json()
	project.id = id;
	return project;
}

async function refreshOnLoad() {
	console.log("refreshing projects")
	const allProjects = projects.value;
	projects.value = []
	for (const project of allProjects) {
		const fileData = await fetchProject(project.id)
		projects.value.push(fileData);
		localStorage.setItem("projects", JSON.stringify(projects.value))
	}
}

refreshOnLoad()
</script>

<template>
	<ul>
		<li v-for="project in projects">
			<mcw-card>
				<mcw-card-primary-action @click="openProject(project)">
					<mcw-card-media :src="project.thumbnailUrl" wide></mcw-card-media>
				</mcw-card-primary-action>
				<section>
					<h2>{{ project.name }}</h2>
				</section>
				<mcw-card-actions>
					<mcw-card-action-buttons>
						<mcw-button raised @click="openProject(project)">Open</mcw-button>
						<mcw-button outlined @click="removeProject(project.id)">Delete </mcw-button>
					</mcw-card-action-buttons>
				</mcw-card-actions>
			</mcw-card>
		</li>
		<li>
			<mcw-textfield
				v-model="projectUrl"
				:label="message ? message : 'Paste a project url here'"
				@input="(event:Event) => {
			         projectUrl = (event.target as HTMLInputElement).value; onAddProject()
			       }"
			/>
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
	.mdc-card__action-buttons > *:first-child {
		margin-right: 0.5em;
	}
</style>