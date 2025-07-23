import { defineStore } from "pinia";
import { TwickedFrameNode, Project, PurgedProject } from "../definition.d";
import { useAuthStore } from "./auth.store";
import { GetImagesResponse } from "@figma/rest-api-spec";
import { ref, watch } from "vue";
import localforage from "localforage";
const regex =
	/https:\/\/[\w\.-]+\.?figma.com\/([\w-]+)\/([0-9a-zA-Z]{22,128})(?:\/.*)?$/;

export const useProjectStore = defineStore("project", () => {
	const projects = ref(new Map<string, PurgedProject>([]));

	localforage.getItem<string>("projectStore").then((storedData) => {
		if (storedData) {
			const newProjectState = {
				projects: new Map(
					Object.entries(JSON.parse(storedData).projects)
				),
			};
			useProjectStore().$patch(newProjectState);
		}
	});

	const addProject = async (url: string): Promise<PurgedProject> => {
		return new Promise<PurgedProject>(async (resolve, reject) => {
			const match = url.match(regex);
			if (!match) return reject("Invalid Figma URL");
			const fileId = url.split("/")[4];
			const project = await fetchProject(fileId);
			if (!project) return reject("Failed to fetch project");

			project.id = fileId;
			projects.value.set(project.id, project);
			resolve(project);
		});
	};

	function removeProject(id: string) {
		projects.value.delete(id);
	}
	function updateProject(project: PurgedProject) {
		projects.value.set(project.id, project);
	}
	function refreshOnLoad() {
		projects.value.forEach((element) => {
			fetchProject(element.id).then((data) => {
				if (data) {
					updateProject(data);
				} else {
					removeProject(element.id);
				}
			});
		});
	}
	async function fetchAllFigmaNodeFromProject(projectId: string) {
		return new Promise<TwickedFrameNode[]>(async (resolve, reject) => {
			const project: PurgedProject | undefined =
				projects.value.get(projectId);
			if (!project) return reject("Project not found");

			const frames = project.document.children[0].children;

			const headers = new Headers({
				Authorization: `Bearer ${await useAuthStore().access_token}`,
			});

			//list all ids as a string split by commas
			let ids = frames.map((frame) => frame.id).join(",");
			const response = await fetch(
				`https://api.figma.com/v1/images/${project.id}?ids=${ids}&format=png&scale=1`,
				{
					method: "get",
					headers,
				}
			);
			const imageResponse: GetImagesResponse = await response.json();

			if (imageResponse.err) return reject(imageResponse.err);

			try {
				await Promise.all(
					frames.map(async (frame) => {
						const image = imageResponse.images[frame.id];
						if (image) {
							frame.image = await imgUrltoBase64(image);
						}
					})
				);
			} catch (e) {
				console.error(e);
				return reject("Failed to fetch images:" + e);
			}

			project.document.children[0].children = frames;
			updateProject(project);

			resolve(frames);
		});
	}

	watch(
		projects,
		() => {
			localforage.setItem(
				"projectStore",
				JSON.stringify({
					projects: Object.fromEntries(projects.value),
				})
			);
		},
		{ flush: "post", deep: true }
	);

	return {
		projects,
		addProject,
		removeProject,
		updateProject,
		refreshOnLoad,
		fetchAllFigmaNodeFromProject,
	};
});

async function fetchProject(id: string): Promise<PurgedProject | null> {
	if (id == null) return null;
	try {
		const headers = new Headers({
			Authorization: `Bearer ${useAuthStore().access_token || ""}`,
		});

		const response: Response = await fetch(
			`https://api.figma.com/v1/files/${id}?depth=3`,
			{
				method: "get",
				headers,
			}
		);

		if (!response.ok) {
			console.error("Failed to fetch project:", response.statusText);
			return null;
		}

		const project: Project = await response.json();
		project.id = id;

		const purgedProject: PurgedProject = {
			name: project.name,
			lastModified: project.lastModified,
			thumbnailUrl: project.thumbnailUrl,
			version: project.version,
			id: project.id,
			document: {
				children: project.document.children.map((child) => ({
					id: child.id,
					children: child.children.map((grandchild) => ({
						id: grandchild.id,
						image: null,
					})),
				})),
			},
		};
		return purgedProject;
	} catch (e) {
		return null;
	}
}

async function imgUrltoBase64(url: string): Promise<string | null> {
	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error("Failed to fetch image");

		const blob = await response.blob();
		const reader = new FileReader();
		reader.readAsDataURL(blob);
		return new Promise((resolve) => {
			reader.onloadend = () => {
				resolve(reader.result as string);
			};
		});
	} catch (e) {
		console.error(e);
		return null;
	}
}
