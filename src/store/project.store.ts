import { defineStore } from "pinia";
import { GetImagesResponse } from "@figma/rest-api-spec";
import { computed, ref, watch } from "vue";
import localforage from "localforage";

import { TwickedFrameNode, Project, PurgedProject } from "../definition.d";
import { useAuthStore } from "./auth.store";
type StringifyableProject = Omit<PurgedProject, "images"> & {
	images: { [key: string]: TwickedFrameNode };
};
type stringifiedProjectList = { [key: string]: StringifyableProject };

export const useProjectStore = defineStore("project", () => {
	const projects = ref(new Map<string, PurgedProject>([]));
	const currentProject = ref<string | null>(null);

	localforage.getItem<string>("projectStore").then((storedData) => {
		if (storedData) {
			// Parse the stored data
			const newProjectList: stringifiedProjectList =
				JSON.parse(storedData).projects;

			// Convert the parsed data into a Map
			const purgedProjectList = new Map<string, PurgedProject>([]);

			// for each project in the newProjectList, we have to create a new PurgedProject
			for (const [id, project] of Object.entries(newProjectList)) {
				// Create a new PurgedProject, we need to convert the images to a Map
				const purgedProject: PurgedProject = {
					...project,
					images: new Map<string, TwickedFrameNode>(
						Object.entries(project.images)
					),
				};
				// Add the new PurgedProject to the Map
				purgedProjectList.set(id, purgedProject);
			}
			// we then update the store
			useProjectStore().projects = purgedProjectList;
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
				if (!data) {
					removeProject(element.id);
				}

				const storedProject = useProjectStore().projects.get(
					element.id
				);
				if (!storedProject || storedProject.version !== data.version) {
					updateProject(data);
				}
			}).catch((error) => {
				// Keep cached projects when the network, permissions or quota fail.
				console.warn("Could not refresh cached Figma project:", error.message);
			});
		});
	}

	async function populateImagesFromProject(
		projectId: string,
		idList: string[]
	) {
		const project = projects.value.get(projectId);
		if (!project) throw new Error("Project not found");

		const ids = idList.join(",");
		const response = await useAuthStore().requestFigma(
			`/v1/images/${project.id}?ids=${ids}&format=png&scale=1`,
		);
		const imageResponse: GetImagesResponse = await response.json();
		if (imageResponse.err) throw new Error(imageResponse.err);

		if (!imageResponse || !imageResponse.images)
			throw new Error("No images found");

		// we populate the project image map, unless the image could not be rendered
		await Promise.all(
			Object.entries(imageResponse.images).map(async ([key, value]) => {
				if (value) {
					project.images.set(key, {
						id: key,
						image: await imgUrltoBase64(value),
					});
				} else {
					console.warn("this image could not be rendered");
					project.images.delete(key);
				}
			})
		);

		updateProject(project);
	}

	async function populateNextMissingImagesFromProject(
		projectId: string,
		quantity: number
	) {
		const project = projects.value.get(projectId);
		if (!project) throw new Error("Project not found");

		const missingFrames = Array.from(project.images.values()).filter(
			(frame) => !frame.image
		);
		const framesToFetch = missingFrames.slice(0, quantity);

		if (framesToFetch.length === 0) {
			return;
		}

		await populateImagesFromProject(
			projectId,
			framesToFetch.map((frame) => frame.id)
		);
	}

	async function clearAllProjects() {
		projects.value.clear();
	}

	const currentImages = computed((): TwickedFrameNode[] => {
		const project = projects.value.get(currentProject.value || "");
		return project ? Array.from(project.images.values()) : [];
	});

	watch(
		projects,
		() => {
			const purgedProjectList = Object.fromEntries(projects.value);
			const stringifiedProjectList: stringifiedProjectList = {};

			for (const [id, project] of Object.entries(purgedProjectList)) {
				stringifiedProjectList[id] = {
					...project,
					images: Object.fromEntries(project.images),
				};
			}

			const stringyfiableProject = JSON.stringify({
				projects: stringifiedProjectList,
			});
			localforage.setItem("projectStore", stringyfiableProject);
		},
		{ flush: "post", deep: true }
	);

	return {
		projects,
		currentProject,
		currentImages,
		addProject,
		removeProject,
		updateProject,
		populateNextMissingImagesFromProject,
		clearAllProjects,
	};
});

async function fetchProject(id: string): Promise<PurgedProject> {
	if (id == null) return Promise.reject("Invalid ID");
	const response = await useAuthStore().requestFigma(`/v1/files/${id}?depth=3`);

	const project: Project = await response.json();
	project.id = id;

	const storedProject = useProjectStore().projects.get(id);
	if (storedProject && storedProject.version === project.version) {
		return storedProject;
	}

	const purgedProject: PurgedProject = {
		name: project.name,
		lastModified: project.lastModified,
		thumbnailUrl: project.thumbnailUrl,
		version: project.version,
		id: project.id,
		images: new Map<string, TwickedFrameNode>(),
	};
	project.document.children.map((child) =>
		child.children.map((grandchild) => {
			purgedProject.images.set(grandchild.id, {
				id: grandchild.id,
				image: null,
			});
		})
	);
	return purgedProject;
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
