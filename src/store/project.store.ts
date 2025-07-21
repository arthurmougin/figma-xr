import { defineStore } from "pinia";
import { ExtendedFrameNode, Project, PurgedProject } from "../definition.d";
import { useAuthStore } from "./auth.store";
import { GetImagesResponse } from "@figma/rest-api-spec";
const regex =
	/https:\/\/[\w\.-]+\.?figma.com\/([\w-]+)\/([0-9a-zA-Z]{22,128})(?:\/.*)?$/;

export const useProjectStore = defineStore("project", {
	state: () => ({
		projects: new Map<string, PurgedProject>([]),
	}),
	actions: {
		async addProject(url: string): Promise<PurgedProject> {
			return new Promise<PurgedProject>(async (resolve, reject) => {
				const match = url.match(regex);
				if (!match) return reject("Invalid Figma URL");
				const fileId = url.split("/")[4];
				const project = await fetchProject(fileId);
				if (!project) return reject("Failed to fetch project");

				project.id = fileId;
				this.projects.set(project.id, project);
				resolve(project);
			});
		},
		removeProject(id: string) {
			this.projects.delete(id);
		},
		updateProject(project: PurgedProject) {
			this.projects.set(project.id, project);
		},
		refreshOnLoad() {
			this.projects.forEach((element) => {
				fetchProject(element.id).then((data) => {
					if (data) {
						this.updateProject(data);
					} else {
						this.removeProject(element.id);
					}
				});
			});
		},
		async fetchAllFigmaNodeFromProject(projectId: string) {
			return new Promise<ExtendedFrameNode[]>(async (resolve, reject) => {
				const project: PurgedProject | undefined =
					this.projects.get(projectId);
				if (!project) return reject("Project not found");

				const frames = project.document.children[0].children;

				const headers = new Headers({
					Authorization: `Bearer ${await useAuthStore()
						.access_token}`,
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

				frames.forEach((frame) => {
					const image = imageResponse.images[frame.id];
					if (image) frame.image = image;
				});

				project.document.children[0].children = frames;
				this.updateProject(project);

				resolve(frames);
			});
		},
	},
	persist: {
		debug: true,
		serializer: {
			// Use the JSON serializer for the state
			deserialize: (value) => {
				return {
					projects: new Map(
						Object.entries(JSON.parse(value).projects)
					),
				};
			},
			serialize: (value) => {
				return JSON.stringify({
					projects: Object.fromEntries(value.projects),
				});
			},
		},
	},
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
					})),
				})),
			},
		};
		return purgedProject;
	} catch (e) {
		return null;
	}
}
