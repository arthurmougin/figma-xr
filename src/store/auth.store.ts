import { defineStore } from "pinia";
import { LogStateOptions, ProfileType } from "../definition.d";
import { RouteLocationNormalized } from "vue-router";

const callbackUrl =
	new URL(window.location.href).origin +
	import.meta.env.BASE_URL +
	"/callback";
export const useAuthStore = defineStore("auth", {
	state: () => ({
		profile: null as ProfileType | null,
		state: LogStateOptions["logged out"] as LogStateOptions,
		access_token: null as string | null,
		expires_in: null as number | null,
		refresh_token: null as string | null,
		figmaState: null as string | null,
	}),
	actions: {
		async login() {
			const figmaState = Math.random().toString(36).substring(7);
			this.figmaState = figmaState;
			const url = new URL(`https://www.figma.com/oauth`);
			url.searchParams.set("client_id", import.meta.env.VITE_ID);
			url.searchParams.set("redirect_uri", callbackUrl);
			url.searchParams.set(
				"scope",
				"current_user:read,file_content:read"
			);
			url.searchParams.set("state", figmaState);
			url.searchParams.set("response_type", "code");

			this.state = LogStateOptions["logging in"];
			window.location.replace(url.toString());
		},
		async logout() {
			console.log("Logging out...");
			this.profile = null;
			this.state = LogStateOptions["logged out"];
			this.access_token = null;
			this.expires_in = null;
			this.refresh_token = null;
			this.figmaState = null;

			this.router.push({ name: "landingpage" });
		},
		async getProfile() {
			const headers = new Headers({
				Authorization: `Bearer ${this.access_token || ""}`,
			});
			let data: any = {};

			try {
				data = await fetch("https://api.figma.com/v1/me", {
					method: "get",
					headers,
				});
			} catch (e) {
				console.warn(e);
				this.logout();
			} finally {
				const json = await data.json();
				console.log(json);
				if (json.err) {
					console.error(json.err);
					this.logout();
				}
				this.profile = json;
			}
		},
		async initCallbackRoute(to: RouteLocationNormalized) {
			try {
				const state = to.query.state?.toString() || "";
				console.log(state);
				if (state !== this.figmaState) {
					console.error("Invalid state");
					this.logout();
					return;
				}

				console.log(to, to.query.code);
				const code = to.query.code?.toString() || "";

				const getTokenUrl = new URL(
					"https://api.figma.com/v1/oauth/token"
				);
				getTokenUrl.searchParams.set("redirect_uri", callbackUrl);
				getTokenUrl.searchParams.set("code", code);
				getTokenUrl.searchParams.set(
					"grant_type",
					"authorization_code"
				);

				const credentials = btoa(
					`${import.meta.env.VITE_ID}:${import.meta.env.VITE_SECRET}`
				);

				const requestParameters: RequestInit = {
					method: "POST",
					mode: "no-cors",
					headers: {
						"content-type": "application/x-www-form-urlencoded",

						Authorization: `Basic ${credentials}`,
					},
				};
				console.log(requestParameters, getTokenUrl);
				const data = await fetch(getTokenUrl, requestParameters);
				console.log(data);
				const json = await data.json();
				console.log(json);
				this.access_token = json.access_token;
				this.expires_in =
					parseInt(json.expires_in) * 24 * 60 * 60 + Date.now();
				this.refresh_token = json.refresh_token;
				this.state = LogStateOptions["logged in"];

				this.getProfile();
				this.router.push({ name: "projects" });
			} catch (e) {
				this.state = LogStateOptions["error"];
				console.error(e);
			}
		},
		async checkLogin() {
			if (this.state !== LogStateOptions["logged in"]) return;
			const access_token = this.access_token;
			const expires_in = this.expires_in;
			if (
				access_token === null ||
				expires_in === null ||
				Date.now() > expires_in
			) {
				this.logout();
			}
		},
	},
	persist: true,
});
