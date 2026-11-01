import { createPhonePreview } from "./phone-preview.mjs";

// A loopback-only production preview for CI. No tunnel or credentials are loaded.
const port = Number(process.env.PREVIEW_PORT || 4173);
const preview = createPhonePreview();
preview.server.listen(port, "127.0.0.1", () => console.log(`Built app on http://127.0.0.1:${port}/figma-xr/lab`));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => { await preview.close(); process.exit(0); });
