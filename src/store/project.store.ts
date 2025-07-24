import { defineStore } from "pinia";
import { TwickedFrameNode, Project, PurgedProject } from "../definition.d";
import { useAuthStore } from "./auth.store";
import { GetImagesResponse } from "@figma/rest-api-spec";
import { ref, watch } from "vue";
import localforage from "localforage";

export const useProjectStore = defineStore("project", () => {
	const projects = ref(new Map<string, PurgedProject>([]));

	localforage.getItem<string>("projectStore").then((storedData) => {
		if (storedData) {
			const newProjectList = new Map<string, PurgedProject>(
				Object.entries(JSON.parse(storedData).projects)
			);
			useProjectStore().projects = newProjectList;
			refreshOnLoad();
		}
	});

	const addProject = async (url: string): Promise<PurgedProject> => {
		return new Promise<PurgedProject>(async (resolve, reject) => {
			try {
				const fileId = url.split("/")[4].split("?")[0];

				const project = await fetchProject(fileId);
				if (!project) return reject("Failed to fetch project");

				project.id = fileId;
				projects.value.set(project.id, project);
				resolve(project);
			} catch (error) {
				reject(error);
			}
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
	async function fetchAllFigmaNodeFromProject(
		projectId: string
	): Promise<TwickedFrameNode[]> {
		console.log("init fetchAllFigmaNodeFromProject");
		const project: PurgedProject | undefined =
			projects.value.get(projectId);
		if (!project) throw new Error("Project not found");

		const frames = project.document.children[0].children;

		const headers = new Headers({
			Authorization: `Bearer ${await useAuthStore().access_token}`,
		});

		let imageResponse: GetImagesResponse;
		console.log(
			"Fetching images url for frames:",
			frames.map((frame) => frame.id)
		);
		try {
			//list all ids as a string split by commas
			let ids = frames.map((frame) => frame.id).join(",");
			const response = await fetch(
				`https://api.figma.com/v1/images/${project.id}?ids=${ids}&format=png&scale=1`,
				{
					method: "get",
					headers,
				}
			);
			imageResponse = await response.json();

			if (imageResponse.err) throw new Error(imageResponse.err);
		} catch (e) {
			console.error(e);
			return await useAuthStore().refreshTokenAndRetry(
				fetchAllFigmaNodeFromProject,
				project.id
			);
		}
		console.log(
			"Fetched images url for frames:",
			frames.map((frame) => frame.id)
		);

		await Promise.all(
			frames.map(async (frame) => {
				const image = imageResponse.images[frame.id];
				if (image) {
					frame.image = await imgUrltoBase64(image);
					console.log("converted image for frame:", frame.id);
				}
			})
		);
		project.document.children[0].children = frames;
		updateProject(project);

		return frames;
	}

	async function clearAllProjects() {
		projects.value.clear();
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
		fetchAllFigmaNodeFromProject,
		clearAllProjects,
	};
});

async function fetchProject(id: string): Promise<PurgedProject> {
	if (id == null) return Promise.reject("Invalid ID");
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
			throw new Error("Failed to fetch project: " + response.statusText);
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
		return await useAuthStore().refreshTokenAndRetry(fetchProject, id);
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
