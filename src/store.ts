import { defineStore } from 'pinia'
import localForage from "localforage";
import { ProfileType } from './definition'
import { useRoute } from 'vue-router';
import { Buffer } from 'buffer';

export const useStore = defineStore('store', {
    state: () => ({
        figma_state: null as string|null,
        access_token: null as string|null,
        expires_in: null as number|null,
        refresh_token: null as string|null,
        profile: null as null | ProfileType
    }),
    getters: {
        isLoggedIn: (state) => {
            if (state.access_token === null || state.expires_in === null) {
                return false;
            }
            if (Date.now() > state.expires_in) {
                return false;
            }
            return true;
        }
    },
    actions: {
        async getProfile() {
            const headers = new Headers({
                'Authorization': `Bearer ${this.access_token || ''}`
            });
            let data: any = {};

            try {
                data = await fetch('https://api.figma.com/v1/me', {
                    method: 'get',
                    headers
                });
            } catch (e) {
                console.warn(e);
                this.logout();
                return;
            } finally {
                const json = await data.json();
                console.log(json);
                if (json.err) {
                    console.error(json.err);
                    this.logout();
                    return;
                }
                this.profile = json
            }
        },
        login() {
            //We generate a value that help us follow the progression of the app authentification process
            const state = Math.random().toString(36).substring(7);
            
            //storing the state for later use
            this.figma_state = state;
            localForage.setItem("figma_state", state);

            // then we navigate to the authentification page 
            const figmaOAuthUrl = new URL(
                `https://www.figma.com/oauth`
            );
            figmaOAuthUrl.searchParams.set("client_id", import.meta.env.VITE_FIGMA_CLIENT_ID)
            figmaOAuthUrl.searchParams.set("redirect_uri", window.location.href.split('?')[0] + "?callback")
            figmaOAuthUrl.searchParams.set("scope", "file_read")
            figmaOAuthUrl.searchParams.set("response_type", "code")
            figmaOAuthUrl.searchParams.set("state", state)
            window.location.replace(figmaOAuthUrl);
        },
        async initiateAuth() {
            //initiation
            this.figma_state = await localForage.getItem("figma_state");
            this.access_token = await localForage.getItem("access_token");
            this.expires_in = await localForage.getItem("expires_in");
            this.refresh_token = await localForage.getItem("refresh_token");

            const urlParams = new URL(window.location.toLocaleString()).searchParams;
            
            if (urlParams.get("callback") === null) {
                //TODO check for token refresh opportunity
                return;
            }

            if (urlParams.get("state") != await localForage.getItem("figma_state")) {
                throw new Error("State mismatch, can't trust the connection. Please try again.");

            }

            try {

                const url = new URL("https://api.figma.com/v1/oauth/token");
              
                const redirect_uri = window.location.href.split('?')[0] + "?callback"

                const code = urlParams.get("code") || "";

                const base64EncodedClientIDAndSecret = Buffer.from(`${import.meta.env.VITE_FIGMA_CLIENT_ID}:${import.meta.env.VITE_FIGMA_SECRET}`).toString('base64')
               
                const headers = {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${base64EncodedClientIDAndSecret}`,
                        'body': `redirect_uri=${encodeURIComponent(redirect_uri)}&code=${encodeURIComponent(code)}&grant_type=authorization_code
`
                }

                //this currently returns the following error "POST https://api.figma.com/v1/oauth/token net::ERR_ABORTED 400 (Bad Request)"
                const data = await fetch(url, {
                    mode: 'no-cors',
                    method: "POST",
                    headers: headers,
                });

                const json = await data.json();

                this.access_token = json.access_token;
                localForage.setItem("access_token", json.access_token);

                const expireTime = parseInt(json.expires_in) * 1000 + Date.now();
                localForage.setItem( "expires_in", expireTime);
                this.expires_in = expireTime
                localForage.setItem("refresh_token", json.refresh_token);
                this.refresh_token = json.refresh_token;

                this.router.push("/projects");

            } catch (e) {
                console.error(e)
                throw new Error("Something went wrong, please try again.");
            }
        },
        logout() {
            localForage.removeItem("access_token");
            localForage.removeItem("expires_in");
            localForage.removeItem("refresh_token");
            localForage.removeItem("figma_state");
            //@ts-ignore
            this.access_token = null;
            //@ts-ignore
            this.expires_in = null;
            //@ts-ignore
            this.refresh_token = null;
            //@ts-ignore
            this.figma_state = null;

            //TODO : Force Navigation to navigation
        }

    }
})