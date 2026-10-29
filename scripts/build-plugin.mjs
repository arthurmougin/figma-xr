import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
await mkdir("plugin/dist", { recursive: true });
const ui = await build({
  entryPoints: ["plugin/ui.ts"],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2020",
  minify: true,
});
const html = (await readFile("plugin/ui.html", "utf8")).replace(
  "/* BUNDLE */",
  ui.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"),
);
await writeFile("plugin/dist/ui.html", html);
await build({
  entryPoints: ["plugin/code.ts"],
  bundle: true,
  outfile: "plugin/dist/code.js",
  format: "iife",
  target: "es2020",
  define: { __html__: JSON.stringify(html) },
});
console.log("Built plugin/manifest.json → plugin/dist/");
