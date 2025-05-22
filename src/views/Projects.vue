<script lang="ts" setup>
	import {ref} from 'vue';
	import {useRouter} from "vue-router";
	import {deleteProject, getAllProjects, storeProject, updateProject} from "../utils";
	import localForage from 'localforage';

	const router = useRouter();
	const projects = ref([] as any[]);
	const projectUrl = ref("");
	const message = ref("");
	const regex = /https:\/\/([\w\.-]+\.)?figma.com\/(file|proto|design)\/([0-9a-zA-Z]{22,128})(?:\/.*)?$/;


	async function onAddProject() {
		const url = projectUrl.value
		//test si regex marche, si oui ajoute projet, sinon attend
		const match = url.match(regex)
		if (match) {
			message.value = "Project being imported locally..."
			const fileId = url.split("/")[4];
			const fileData = await fetchProject(fileId)
			console.log(fileData)
			await storeProject(fileData)
			projects.value = await getAllProjects();
			message.value = "";
			projectUrl.value = ""
		} else {
			if (projectUrl.value != "") message.value = "not recognized as project url."
			else message.value = ""
		}
	}

	async function removeProject(id: string) {
		await deleteProject(id);
		projects.value = await getAllProjects();
	}

	async function fetchProject(id: string) {
		console.log("fetching project with id: " + id + "...")
		if(id == null) return null;
		try{
			const headers = new Headers({
				'Authorization': `Bearer ${await localForage.getItem('access_token') || ''}`
			})
			const data = await fetch(`https://api.figma.com/v1/files/${id}`, {
				method: 'get',
				headers
			})
			const project = await data.json()
			console.log(project)
			if (project.status == 404) {
				throw new Error("Project not found")
			}
			project.id = id;
			return project;
		}
		catch (e) {
			console.log(e)
			return null
		}
	}

	async function refreshOnLoad() {
		projects.value = await getAllProjects();
		const allProjects = projects.value;
		for(let i = 0; i < allProjects.length; i++) {
			const project = allProjects[i];
			const fileData = await fetchProject(project.id)
			if (fileData == null) {
				await deleteProject(project.id);
				allProjects.splice(i, 1);
				i--;
				continue;
			}
			projects.value[i] = fileData;
			updateProject(fileData);
		}
		console.log(projects.value)
	}

	refreshOnLoad()
</script>

<template>
	<ul>
		<li v-for="project in projects">
			<mcw-card>
				<mcw-card-primary-action @click="router.push({ name: 'xrview', params: {projectId: project.id}})">
					<mcw-card-media :src="project.thumbnailUrl" wide></mcw-card-media>
				</mcw-card-primary-action>
				<section>
					<h2>{{ project.name }}</h2>
				</section>
				<mcw-card-actions>
					<mcw-card-action-buttons>
						<mcw-button raised @click="router.push({ name: 'xrview', params: {projectId: project.id}})">Open</mcw-button>
						<mcw-button outlined @click="removeProject(project.id)">Remove</mcw-button>
					</mcw-card-action-buttons>
				</mcw-card-actions>
			</mcw-card>
		</li>
		<li id="add">
			<a target="_blank" href="https://www.figma.com/files">Find projects you want to see in XR...</a>
			<mcw-textfield
				v-model="projectUrl"
				:label="message ? message : 'And paste their link here'"
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

	#add {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	#add > * {
		margin: 0.5em;
	}

	.mdc-button--outlined {
		padding: 0.5em;
		position: relative;
		box-sizing: content-box;
	}

</style>