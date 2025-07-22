import { GetFileResponse, FrameNode } from "@figma/rest-api-spec";
import { Router } from "vue-router";

export enum LogStateOptions {
	"logged out",
	"logging in",
	"logged in",
	"error",
}

export type ProfileType = {
	id: string;
	email: string;
	handle: string;
	img_url: string;
};

declare module "pinia" {
	export interface PiniaCustomProperties {
		router: Router;
	}
}

export type Project = GetFileResponse & {
	id: string;
};

//valid since FrameNode herit from AnnotationsTrait
export type TwickedFrameNode = { id: string; image: string | null };

export type PurgedProject = {
	name: string;
	lastModified: string;
	thumbnailUrl?: string;
	version: string;
	id: string;
	document: {
		//canvas
		children: {
			//subcanvas, or frame as we call it
			id: string;
			children: {
				id: string;
				image: string | null;
			}[];
		}[];
	};
};
