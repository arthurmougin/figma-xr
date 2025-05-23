<script lang="ts" setup>
	import {Ref, ref} from 'vue';
	import {useRouter} from "vue-router";
	import {deleteProjectFromStorage, getAllProjectsInStorage, saveProjectToStorage, updateProjectInStorage} from "../utils";
	import localForage from 'localforage';
import { ProjectData } from '../definition';

	const router = useRouter();
	const projects : Ref<ProjectData[]> = ref([]);
	const projectUrl = ref("");
	const message = ref("");
	const regex = /https:\/\/([\w\.-]+\.)?figma.com\/(file|proto|design)\/([0-9a-zA-Z]{22,128})(?:\/.*)?$/;


	async function addProject() {
		const url = projectUrl.value
		//test si regex marche, si oui ajoute projet, sinon attend
		const match = url.match(regex)


		if (!match) {
			if (projectUrl.value != "") message.value = "not recognized as project url."
			else message.value = ""
			return;
		}

		message.value = "Project being imported locally..."
		const fileId = url.split("/")[4];
		const fileData : ProjectData | undefined = await fetchProject(fileId)

		if(!fileData){
			message.value = "failed to import project."
			return;
		}
		
		console.log(fileData)
		await saveProjectToStorage(fileData)
		projects.value = await getAllProjectsInStorage();
		message.value = "";
		projectUrl.value = ""
		
	}

	async function removeProject(id: string) {
		await deleteProjectFromStorage(id);
		projects.value = await getAllProjectsInStorage();
	}

	async function fetchProject(id: string) : Promise<ProjectData | undefined>{
		console.log("fetching project with id: " + id + "...")
		if(id == null) return undefined;
		try{
			const headers = new Headers({
				'Authorization': `Bearer ${await localForage.getItem('access_token') || ''}`
			})
			const data = await fetch(`https://api.figma.com/v1/files/${id}`, {
				method: 'get',
				headers
			})
			const project : ProjectData = await data.json()
			
			project.id = id;
			console.log(project)
			return project;
		}
		catch (e) {
			console.log(e)
			return undefined
		}
	}

	async function refreshOnLoad() {
		projects.value = await getAllProjectsInStorage();
		const allProjects = projects.value;
		for(let i = 0; i < allProjects.length; i++) {
			const project = allProjects[i];
			const fileData = await fetchProject(project.id)
			if (fileData == null) {
				await deleteProjectFromStorage(project.id);
				allProjects.splice(i, 1);
				i--;
				continue;
			}
			projects.value[i] = fileData;
			updateProjectInStorage(fileData);
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
			         projectUrl = (event.target as HTMLInputElement).value; 
					 addProject()
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