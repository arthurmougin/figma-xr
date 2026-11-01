import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { execFileSync } from "node:child_process";

const revision = process.env.GITHUB_SHA || (() => {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return "local"; }
})();
const buildInfo = {
  revision,
  channel: process.env.GITHUB_REF_NAME || "local",
  builtAt: new Date().toISOString(),
};

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		{ name: "build-info", generateBundle() {
			this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify(buildInfo) + "\n" });
		} },
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
		__APP_BUILD__: JSON.stringify(buildInfo),
		__VITE_BASE__: JSON.stringify("/figma-xr"),
	},
});
