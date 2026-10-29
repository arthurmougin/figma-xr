import { defineStore } from "pinia";
import type { RouteLocationNormalized } from "vue-router";
import type { GetMeResponse } from "@figma/rest-api-spec";
import { LogStateOptions, type ProfileType } from "../definition.d";
import { useProjectStore } from "./project.store";
import {
	beginAuthorization, consumeAuthorization, clearAuthorization,
	normalizeTokens, requestTokens, fetchWithToken, OAuthRequestError,
} from "../lib/figma-oauth";

const callbackUrl = new URL(import.meta.env.BASE_URL + "?callback", window.location.origin).href;
const authApiUrl = (import.meta.env.VITE_AUTH_API_URL || "/api/figma").replace(/\/$/, "");
let refreshing: Promise<void> | null = null;

// Discard the old, indefinitely persisted credentials during migration.
localStorage.removeItem("auth");

export const useAuthStore = defineStore("auth", {
	state: () => ({
		profile: null as ProfileType | null,
		state: LogStateOptions["logged out"] as LogStateOptions,
		access_token: null as string | null,
		expires_at: null as number | null,
		refresh_token: null as string | null,
		error: null as string | null,
	}),
	actions: {
		async login() {
			try {
				this.error = null;
				const url = await beginAuthorization(import.meta.env.VITE_ID, callbackUrl, sessionStorage);
				this.state = LogStateOptions["logging in"];
				window.location.assign(url);
			} catch (error) {
				this.error = error instanceof Error ? error.message : "Unable to start Figma sign-in.";
				this.state = LogStateOptions.error;
			}
		},
		clearSession() {
			this.profile = null;
			this.state = LogStateOptions["logged out"];
			this.access_token = null;
			this.expires_at = null;
			this.refresh_token = null;
			this.error = null;
			clearAuthorization(sessionStorage);
		},
		async logout() {
			this.clearSession();
			await useProjectStore().clearAllProjects();
			await this.router.push({ name: "landingpage" });
		},
		async getProfile(): Promise<void> {
			const response = await this.requestFigma("/v1/me");
			this.profile = await response.json() as GetMeResponse;
		},
		async initCallbackRoute(to: RouteLocationNormalized): Promise<boolean> {
			try {
				const state = typeof to.query.state === "string" ? to.query.state : "";
				const pending = consumeAuthorization(state, sessionStorage);
				const code = typeof to.query.code === "string" ? to.query.code : "";
				if (to.query.error || !code) throw new Error("Figma sign-in was not completed. Please try again.");
				const json = await requestTokens(`${authApiUrl}/token`, {
					code, redirect_uri: pending.redirectUri, code_verifier: pending.verifier,
				});
				Object.assign(this, normalizeTokens(json));
				await this.getProfile();
				this.state = LogStateOptions["logged in"];
				this.error = null;
				return true;
			} catch (error) {
				this.clearSession();
				this.state = LogStateOptions.error;
				this.error = error instanceof Error ? error.message : "Unable to connect to Figma.";
				return false;
			}
		},
		async ensureValidToken(): Promise<string> {
			if (!this.access_token) throw new Error("Please connect to Figma first.");
			if (!this.expires_at || Date.now() + 30_000 >= this.expires_at) {
				await this.refreshAccessToken();
			}
			if (!this.access_token) throw new Error("Please connect to Figma again.");
			return this.access_token;
		},
		async checkLogin(): Promise<boolean> {
			if (this.state !== LogStateOptions["logged in"]) return false;
			try {
				await this.ensureValidToken();
				if (!this.profile) await this.getProfile();
				return true;
			} catch (error) {
				this.error = error instanceof Error ? error.message : "Unable to check the Figma session.";
				return false;
			}
		},
		async refreshAccessToken(): Promise<void> {
			if (refreshing) return refreshing;
			const refreshToken = this.refresh_token;
			if (!refreshToken) {
				this.clearSession();
				throw new Error("Please connect to Figma again.");
			}
			refreshing = (async () => {
				try {
					const json = await requestTokens(`${authApiUrl}/refresh`, { refresh_token: refreshToken });
					// A refresh that completes after logout must not restore the session.
					if (this.refresh_token === refreshToken) {
						Object.assign(this, normalizeTokens(json, refreshToken));
					}
				} catch (error) {
					if (this.refresh_token === refreshToken && error instanceof OAuthRequestError && (error.status === 400 || error.status === 401)) {
						this.clearSession();
					}
					throw error;
				}
			})().finally(() => { refreshing = null; });
			return refreshing;
		},
		async requestFigma(path: string): Promise<Response> {
			if (!path.startsWith("/v1/")) throw new Error("Invalid Figma API path.");
			return fetchWithToken(`https://api.figma.com${path}`,
				() => this.ensureValidToken(), () => this.refreshAccessToken());
		},
	},
	persist: {
		storage: sessionStorage,
		pick: ["profile", "state", "access_token", "expires_at", "refresh_token"],
	},
});
