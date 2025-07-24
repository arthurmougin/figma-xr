import { defineStore } from "pinia";
import { TwickedFrameNode, Project, PurgedProject } from "../definition.d";
import { useAuthStore } from "./auth.store";
import { GetImagesResponse } from "@figma/rest-api-spec";
import { ref, watch } from "vue";
import localforage from "localforage";
type StringifyableProject = Omit<PurgedProject, "images"> & {
	images: { [key: string]: TwickedFrameNode };
};
type stringifiedProjectList = { [key: string]: StringifyableProject };

export const useProjectStore = defineStore("project", () => {
	const projects = ref(new Map<string, PurgedProject>([]));

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
				if (data) {
					updateProject(data);
				} else {
					removeProject(element.id);
				}
			});
		});
	}
	async function populateAllImagesFromProject(
		projectId: string
	): Promise<Map<string, TwickedFrameNode>> {
		console.log("init fetchAllFigmaNodeFromProject");
		const project: PurgedProject | undefined =
			projects.value.get(projectId);
		if (!project) throw new Error("Project not found");

		const frames: Map<string, TwickedFrameNode> = project.images;
		const framesArray = Array.from(frames.values());

		const headers = new Headers({
			Authorization: `Bearer ${await useAuthStore().access_token}`,
		});

		let imageResponse: GetImagesResponse;
		console.log(
			"Fetching images url for frames:",
			framesArray.map((frame) => frame.id)
		);
		try {
			//list all ids as a string split by commas
			let ids = framesArray.map((frame) => frame.id).join(",");
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
				populateAllImagesFromProject,
				project.id
			);
		}
		console.log(
			"Fetched images url for frames:",
			Array.from(frames.values()).map((frame) => frame.id)
		);

		await Promise.all(
			framesArray.map(async (frame) => {
				const image = imageResponse.images[frame.id];
				if (image) {
					frame.image = await imgUrltoBase64(image);
					console.log("converted image for frame:", frame.id);
				}
				frames.set(frame.id, frame);
			})
		);
		project.images = frames;
		updateProject(project);

		return frames;
	}

	async function populateImagesFromProjectPaginated(
		projectId: string,
		pageNumber: number,
		pageQuantity: number = 5
	) {
		const project = projects.value.get(projectId);
		if (!project) throw new Error("Project not found");
		if (pageNumber < 1 || pageQuantity < 1) {
			throw new Error("Invalid pagination parameters");
		}

		const start = (pageNumber - 1) * pageQuantity;
		const end = start + pageQuantity;
		const paginatedFrames = Array.from(project.images.values()).slice(
			start,
			end
		);

		if (paginatedFrames.length === 0) {
			throw new Error("No frames found for the given pagination");
		}

		const headers = new Headers({
			Authorization: `Bearer ${await useAuthStore().access_token}`,
		});

		let imageResponse: GetImagesResponse | undefined = undefined;
		console.log(
			"Fetching images url for frames:",
			paginatedFrames.map((frame) => frame.id)
		);
		try {
			//list all ids as a string split by commas
			let ids = paginatedFrames.map((frame) => frame.id).join(",");
			const response = await fetch(
				`https://api.figma.com/v1/images/${project.id}?ids=${ids}&format=png&scale=1`,
				{
					method: "get",
					headers,
				}
			);
			imageResponse = await response.json();

			if (!imageResponse || imageResponse.err)
				throw new Error(imageResponse?.err || "Unknown error");
		} catch (e) {
			console.error(e);
			return await useAuthStore().refreshTokenAndRetry(
				populateImagesFromProjectPaginated,
				projectId,
				pageNumber,
				pageQuantity
			);
		}
		console.log(
			"Fetched images url for frames:",
			paginatedFrames.map((frame) => frame.id)
		);

		if (!imageResponse || !imageResponse.images)
			throw new Error("No images found");

		await Promise.all(
			Object.entries(imageResponse.images).map(async ([key, value]) => {
				if (value) {
					project.images.set(key, {
						id: key,
						image: await imgUrltoBase64(value),
					});
				}
			})
		);

		updateProject(project);

		return paginatedFrames;
	}

	async function clearAllProjects() {
		projects.value.clear();
	}

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
		addProject,
		removeProject,
		updateProject,
		populateAllImagesFromProject,
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
			images: new Map<string, TwickedFrameNode>(),
		};
		project.document.children.map((child) =>
			child.children.map((grandchild) =>
				purgedProject.images.set(grandchild.id, {
					id: grandchild.id,
					image: null,
				})
			)
		);
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
