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
