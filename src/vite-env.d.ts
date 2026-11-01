/// <reference types="vite/client" />
declare const __APP_BUILD__: { revision: string; channel: string; builtAt: string };

interface ImportMetaEnv {
	readonly VITE_APP_TITLE: string;
	readonly VITE_ID: string;
	readonly VITE_AUTH_API_URL?: string;
	// more env variables...
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
