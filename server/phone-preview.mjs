import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { attachPairing } from "./pairing.mjs";
const base = "/figma-xr/";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

// Only built frontend files and anonymous pairing are exposed by this preview.
// It does not load env files, serve sources, or enable OAuth endpoints.
export function createPhonePreview({
  distDir = resolve("dist"),
  origins = [],
} = {}) {
  const root = resolve(distDir),
    sockets = new Set();
  let pairing;
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (pairing.handle(req, res)) return;
    const respond = (status, text) => {
      res.writeHead(status, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(text);
    };
    if (!["GET", "HEAD"].includes(req.method)) {
      respond(405, "Method not allowed");
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      respond(400, "Invalid URL");
      return;
    }
    if (pathname === "/") {
      res.writeHead(302, { Location: base + "companion" });
      res.end();
      return;
    }
    if (!pathname.startsWith(base)) {
      respond(404, "Not found");
      return;
    }
    const relative = pathname.slice(base.length);
    if (
      relative.split(/[\\/]/).some((part) => part.startsWith(".")) ||
      relative.includes("\0")
    ) {
      respond(404, "Not found");
      return;
    }
    const destination = resolve(root, relative || "index.html");
    if (!destination.startsWith(root + sep)) {
      respond(404, "Not found");
      return;
    }
    let file = destination;
    try {
      let info;
      try {
        info = await stat(file);
      } catch {}
      if (!info?.isFile()) {
        // SPA fallback only for app routes, never for a missing asset/source.
        if (relative !== "" && relative !== "companion") {
          respond(404, "Not found");
          return;
        }
        file = resolve(root, "index.html");
      }
      const bytes = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Content-Length": bytes.length,
        "Cache-Control": "no-store",
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch {
      respond(503, "Build the app first with npm run build.");
    }
  });
  pairing = attachPairing(server, {
    origins,
    maxRooms: 8,
    ttlMs: 30 * 60 * 1000,
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  return {
    server,
    close() {
      pairing.close();
      for (const socket of sockets) socket.destroy();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

async function start() {
  const port = Number(process.env.PHONE_PREVIEW_PORT || 5180);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Invalid PHONE_PREVIEW_PORT.");
  const distDir = fileURLToPath(new URL("../dist/", import.meta.url));
  await stat(resolve(distDir, "index.html")).catch(() => {
    throw new Error("Run npm run build before starting the phone preview.");
  });
  const origins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
  const preview = createPhonePreview({ distDir, origins });
  await new Promise((resolve, reject) => {
    preview.server.once("error", reject);
    preview.server.listen(port, "127.0.0.1", resolve);
  });
  const binary =
    process.env.CLOUDFLARED_BIN ||
    (process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
  const tunnel = spawn(
    binary,
    [
      "tunnel",
      "--no-autoupdate",
      "--url",
      `http://127.0.0.1:${port}`,
      "--protocol",
      "http2",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let announced = false,
    stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    tunnel.kill();
    void preview.close();
  };
  let outputBuffer="";
  const inspect = (chunk) => {
    const text = chunk.toString();
    outputBuffer=(outputBuffer+text).slice(-8192);
    const url = outputBuffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)?.[0];
    if (url && !announced) {
      announced = true;
      origins.push(new URL(url).origin);
      console.log(
        `\nCompanion website: ${url}${base}\nPairing server:    ${url}\n\nPaste these addresses into the Figma plugin, then Pair phone.\nKeep this terminal running. Ctrl+C closes the temporary test address.\n`,
      );
    }
    if (/Registered tunnel connection/.test(text))
      console.log("Phone tunnel connected.");
    if (/ERR|error/i.test(text) && !url) process.stderr.write(text);
  };
  tunnel.stdout.on("data", inspect);
  tunnel.stderr.on("data", inspect);
  tunnel.on("error", (error) => {
    console.error(`Cannot start cloudflared: ${error.message}`);
    process.exitCode = 1;
    stop();
  });
  tunnel.on("exit", (code) => {
    if (!stopping) {
      console.error(`Phone tunnel stopped (${code}).`);
      process.exitCode = code || 1;
      stop();
    }
  });
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
