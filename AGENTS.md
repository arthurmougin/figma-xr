# Figma XR working agreement

Read `docs/remote-work.md` and `docs/plugin-companion.md` before changing the mobile workflow.

- Work on `feat/plugin-companion` or a `wip/` branch. Preserve the OAuth project browser and the companion's live plugin flow.
- The mobile lab at `/figma-xr/lab` must run from built static files with no localhost, Figma login, relay, desktop or private design data. It uses the same companion UI and scene as live mode.
- Sample designs and imported/live catalogs must remain separate. Catalog backups contain assets only, never session credentials. Never commit real exports, `.env` files, access/refresh tokens or client secrets.
- Register screen taps immediately; matching may finish later. Preserve the original XR ray. Catalog placement must remain independent of screen acquisition.
- A public WIP has been authorized for GitHub Pages. Publishing the previously unpublished source branch was blocked by automatic approval review on 2026-11-01; obtain the user's explicit source-publication confirmation before retrying that push. Do not work around the block by another upload method.
- GitHub Pages cannot run the OAuth/WebSocket server. A temporary tunnel or a running developer laptop does not satisfy the desktop-free workflow. Keep backend configuration explicit and report whether a hosted backend was actually verified.
- Use `npm ci`, `npm test`, `npm run build`, then `npm run test:mobile`. `test:mobile` starts its own loopback production preview. Live plugin tests additionally require `npm run dev:relay`, `npm run dev`, and `npm run test:browser`.
- Treat phone-sized browser automation, emulated XR, and physical phone/WebXR checks as different evidence. Never claim physical tracking or camera access was tested from desktop automation.
- After publication, verify the deployed `version.json` against the intended commit, then check the public `/lab` link. Do not merge into `main` just to obtain a WIP deployment.
- Keep `docs/remote-work.md` current when workflow, routes, environment variables or known blockers change. Check repository state rather than relying on a transient chat workspace.
