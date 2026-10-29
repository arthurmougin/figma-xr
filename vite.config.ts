import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		basicSsl({
			name: "test",
		}),
		tailwindcss(),
	],
	server: {
		https: {
			key: fileURLToPath(new URL("./certs/server.key", import.meta.url)),
			cert: fileURLToPath(new URL("./certs/server.crt", import.meta.url)),
		},
		port: 5173,
		strictPort: true,
		proxy: {
			"/api/figma": "http://127.0.0.1:8787",
			"/api/pair": { target: "http://127.0.0.1:8787", ws: true },
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	base: "/figma-xr/",
	assetsInclude: ["**/**.gltf", "**/**.glb", "**/**.hdri", "**/**.hdr"],
	define: {
		__VITE_BASE__: JSON.stringify("/figma-xr"),
	},
});
