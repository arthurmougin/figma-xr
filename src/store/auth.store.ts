import { defineStore } from "pinia";
import { LogStateOptions, ProfileType } from "../definition.d";
import { RouteLocationNormalized } from "vue-router";
import { GetMeResponse } from "@figma/rest-api-spec";
import { useProjectStore } from "./project.store";

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
		lastRetry: 0,
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
			useProjectStore().clearAllProjects();

			this.router.push({ name: "landingpage" });
		},
		async getProfile(): Promise<void> {
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
				console.error("Failed to fetch user data");
				return this.refreshTokenAndRetry(this.getProfile);
			} finally {
				if (!data || !data.ok) {
					console.error(data);
					return this.refreshTokenAndRetry(this.getProfile);
				}
				const meResponse: GetMeResponse = await data.json();
				this.profile = meResponse;
			}
		},
		async initCallbackRoute(to: RouteLocationNormalized): Promise<void> {
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
				return this.refreshTokenAndRetry(this.initCallbackRoute, to);
			}
		},
		async checkLogin(): Promise<void> {
			if (this.state !== LogStateOptions["logged in"]) return;
			const expires_in = this.expires_in;

			if (!this.refresh_token) {
				this.logout();
				return;
			}

			if (expires_in === null || Date.now() > expires_in) {
				await this.refreshTokenAndRetry();
			}

			try {
				this.getProfile();
			} catch (e) {
				this.logout();
				throw e;
			}
		},

		// Retry a function with the current refresh token with the appropriate parameters
		async refreshTokenAndRetry(
			functionToRetry?: ((...args: any[]) => Promise<any>) | undefined,
			...parameters: any[]
		): Promise<any> {
			if (!this.refresh_token) {
				this.logout();
				return;
			}

			//if this function is used more than once per sessions, it's suspect
			if (Date.now() - this.lastRetry < 10000) {
				console.error("Too many retries");
				this.logout();
				throw new Error("Too many retries");
			}

			try {
				//update access token with refresh token
				const getRefreshedTokenUrl = new URL(
					"https://api.figma.com/v1/oauth/token"
				);
				getRefreshedTokenUrl.searchParams.set(
					"refresh_token",
					this.refresh_token || ""
				);
				getRefreshedTokenUrl.searchParams.set(
					"grant_type",
					"refresh_token"
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
				const data = await fetch(getRefreshedTokenUrl.href, options);
				const json = await data.json();
				this.access_token = json.access_token;
				//expires_in is time expressed in seconds, while date.now() is in milliseconds
				this.expires_in = parseInt(json.expires_in) * 1000 + Date.now();

				this.lastRetry = Date.now();

				return functionToRetry
					? await functionToRetry(...parameters)
					: null;
			} catch (e) {
				this.logout();
			}
		},
	},
	persist: true,
});
