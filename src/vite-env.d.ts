/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APP_TITLE: string
    readonly VITE_FIGMA_CLIENT_ID: string
    readonly VITE_FIGMA_SECRET: string
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}