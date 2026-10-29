import { createServer } from "node:http";
import { createAuthHandler, loadConfig } from "./figma-auth.mjs";
import { attachPairing } from "./pairing.mjs";
const origins = (
  process.env.FIGMA_ALLOWED_ORIGINS ||
  "https://localhost:5173,https://arthurmougin.github.io"
)
  .split(",")
  .map((s) => s.trim());
const auth =
  process.env.FIGMA_CLIENT_ID && process.env.FIGMA_CLIENT_SECRET
    ? createAuthHandler(loadConfig())
    : null;
const server = createServer((req, res) => {
  if (pairing.handle(req, res)) return;
  if (new URL(req.url, "http://localhost").pathname === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ ok: true, pairing: true, oauth: Boolean(auth) }));
    return;
  }
  if (auth) return auth(req, res);
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_configured" }));
});
const pairing = attachPairing(server, { origins });
const host = process.env.AUTH_HOST || "127.0.0.1",
  port = Number(process.env.PORT || 8787);
server.listen(port, host, () =>
  console.log(
    `Figma XR relay listening on ${host}:${port} (plugin pairing enabled)`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    pairing.close();
    server.close(() => process.exit(0));
  });
