import { defineStore } from "pinia";
import { LogStateOptions, ProfileType } from "../definition.d";
import { RouteLocationNormalized } from "vue-router";
import { GetMeResponse } from "@figma/rest-api-spec";

const callbackUrl =
	new URL(window.location.href).origin +
	import.meta.env.BASE_URL +
	"?callback";
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
			let data: Response = new Response("", {
				status: 504,
				statusText: "API call Error",
			});

			try {
				data = await fetch("https://api.figma.com/v1/me", {
					method: "get",
					headers,
				});
			} catch (e) {
				console.warn(e);
				this.logout();
			} finally {
				//how to test if a variable is assigned
				if (!data) {
					console.error("Failed to fetch user data");
					return;
				}
				console.log("me", data);
				if (!data.ok) {
					console.error(data);
					this.logout();
				}
				const meResponse: GetMeResponse = await data.json();
				console.log("me", meResponse);
				this.profile = meResponse;
			}
		},
		async initCallbackRoute(to: RouteLocationNormalized) {
			try {
				const state = to.query.state?.toString() || "";
				if (state !== this.figmaState) {
					console.error("Invalid state");
					this.logout();
					return;
				}

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

				const options = {
					method: "POST",
					headers: {
						authorization: `Basic ${credentials}`,
						"content-type": "application/x-www-form-urlencoded",
					},
				};
				const data = await fetch(getTokenUrl.href, options);
				const json = await data.json();
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
