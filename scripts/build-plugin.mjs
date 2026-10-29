import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { companionConnection } from "./companion-connection.mjs";
import { normalizeConnection } from "../plugin/connection.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
export async function buildPlugin({ connection } = {}) {
  let local = {};
  try {
    local = parseEnv(await readFile(resolve(root, ".env.local"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const config = connection
    ? normalizeConnection(connection)
    : companionConnection({ env: { ...local, ...process.env } });
  await mkdir(resolve(root, "plugin/dist"), { recursive: true });
  const ui = await build({
    absWorkingDir: root,
    entryPoints: ["plugin/ui.ts"],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2020",
    minify: true,
    define: { __COMPANION_CONNECTION__: JSON.stringify(config) },
  });
  const html = (
    await readFile(resolve(root, "plugin/ui.html"), "utf8")
  ).replace("/* BUNDLE */", () =>
    ui.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"),
  );
  await writeFile(resolve(root, "plugin/dist/ui.html"), html);
  await writeFile(
    resolve(root, "plugin/dist/connection.json"),
    JSON.stringify(config, null, 2) + "\n",
  );
  await build({
    absWorkingDir: root,
    entryPoints: ["plugin/code.ts"],
    bundle: true,
    outfile: "plugin/dist/code.js",
    format: "iife",
    target: "es2020",
    define: { __html__: JSON.stringify(html) },
  });
  console.log(
    config.website
      ? `Built plugin with phone address ${config.website}`
      : "Built plugin; configure public addresses before release.",
  );
  return config;
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  await buildPlugin();
