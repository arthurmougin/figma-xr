import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		basicSsl({
			name: "test",
		}),
	],
	server: {
		https: {
			key: fileURLToPath(new URL("./certs/server.key", import.meta.url)),
			cert: fileURLToPath(new URL("./certs/server.crt", import.meta.url)),
		},
		port: 5173,
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	base: "/figma-xr",
	assetsInclude: ["**/**.gltf", "**/**.glb", "**/**.hdri", "**/**.hdr"],
	define: {
		__VITE_BASE__: JSON.stringify("/figma-xr"),
	},
});
