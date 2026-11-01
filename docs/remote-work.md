# Desktop-free mobile iteration

## Entry points

The WIP is published at the existing main Pages URL. Use:

- Mobile lab: <https://arthurmougin.github.io/figma-xr/lab>
- Saved/imported catalog: <https://arthurmougin.github.io/figma-xr/companion>
- Deployed build identity: <https://arthurmougin.github.io/figma-xr/version.json>
- Browser checks without a relay: <https://arthurmougin.github.io/figma-xr/phone-check.html?mode=demo>

The feature branch is `feat/plugin-companion`. On 2026-11-01 the user explicitly approved public source publication, future WIP updates, and deployment at the existing main Pages URL. Keep the source branch separate from `main`; a WIP deployment replaces the site at the same URL. Verify `version.json` after every successful workflow before claiming a particular build is live.

The sample lab redirects to `companion?demo=1`, using the same controls, onboarding, catalog and Babylon scene as live mode. It generates six original sample cards in the browser and does not read the saved Figma catalog, request OAuth, open a pairing socket or require a desktop. Use it for menu/onboarding, touch layouts, search, placement and AR entry on a supported device. A browser without WebXR can still use the 3D preview. Natural-feature screen copying remains a live-plugin/physical-device test.

## Bring real items along

Before leaving the desktop, pair normally and let the phone receive the desired items. In the companion's **Menu**, choose **Export catalog backup**. The JSON contains design names, dimensions and PNGs; keep it private. It contains no pairing token, OAuth token or client secret and is not uploaded to GitHub.

On the phone, open the saved-catalog companion and use **Menu → Import catalog backup**. A validated import switches away from any live room, saves locally through IndexedDB and remains available after reloading. Keep the backup because browsers may evict site storage. Opening sample mode does not replace the saved catalog. The app's static files still need internet for a fresh load; there is no service-worker offline-shell guarantee.

**Menu → Show onboarding** reopens the guide; dismissal is stored separately for sample and live modes. **Show/Hide catalog** leaves more room for the scene. The menu shows the branch and short revision so a phone test can identify its build.

## Work from chatgpt.com

1. Open the repository through the GitHub connection and inspect `AGENTS.md`, this guide, and the current branch head. A temporary chat workspace may have expired; the published repository is the source of truth.
2. Make a bounded change on the feature/WIP branch. GitHub's file API is sufficient for a small change; use Git Data tree/commit/ref operations for an atomic multi-file change. Update the ref only if the previously observed head still matches. No desktop shell is needed once source publication and cloud writes are verified.
3. The **Validate and publish WIP** workflow installs Node 24 dependencies, runs the unit/integration tests, builds the frontend/plugin, and tests the built app in portrait and landscape phone layouts. Pull requests run validation without deploying. A push to `main`, `feat/plugin-companion`, or `wip/**` deploys after validation.
4. Inspect Actions results and screenshots. The workflow also provides a development-plugin artifact. A red check is a stop signal for deployment, not a reason to skip validation.
5. Compare public `version.json` with the intended revision, then open the lab on the phone. Report the build revision, browser/device, visible message, and steps to reproduce. Physical WebXR acceptance remains necessary for camera access, anchors and screen alignment.

GitHub Pages provides one deployment per repository. A successful WIP deployment replaces the site's current build at the same URL. Returning to the `main` build requires deploying that branch again. There is no separate per-PR preview host in this setup.

The repository's `github-pages` environment uses custom branch protection. An exact deployment policy for `feat/plugin-companion` was added on 2026-11-01 alongside the existing `main` policy. Add `wip/*` only if additional WIP branches need to deploy. This changes which branches may deploy, not repository visibility. The new workflow replaces the old Pages workflow to avoid competing deployments; the obsolete extensionless workflow example is removed.

## Backend and Figma access

The demo/catalog workflow requires no backend. Live plugin pairing requires a reachable HTTPS/WSS relay; OAuth requires its secret-bearing relay. Neither is provided by GitHub Pages. At preparation time, repository Actions variables were empty and no permanent hosted relay was configured or verified. A localhost relay or Cloudflare Quick Tunnel stops being useful when the laptop is off.

`Dockerfile.relay` packages the existing Node server with its own minimal dependency lockfile. It binds `0.0.0.0:$PORT`, runs as the Node user, exposes `/health`, and copies only the relay code/public URL helpers. It does not contain the frontend, development plugin exports or local credential files. Build with:

```sh
docker build -f Dockerfile.relay -t figma-xr-relay .
```

Deploy it to a separately authenticated HTTPS host with WebSocket support. This repository does not create an account, subscription or hosted service automatically. Use a single running instance for the current in-memory pairing rooms: process restarts lose rooms, while phone catalog backups remain usable.

Configure the host's secret/environment store:

| Variable | Value / purpose |
| --- | --- |
| `AUTH_HOST` | `0.0.0.0` (set in the image) |
| `PORT` | The hosting provider's assigned port; image default 8787 |
| `NODE_ENV` | `production` (set in the image) |
| `FIGMA_ALLOWED_ORIGINS` | `https://arthurmougin.github.io`; append exact other approved frontend origins if needed |
| `FIGMA_CLIENT_ID` | Figma OAuth app's client ID, if enabling OAuth |
| `FIGMA_CLIENT_SECRET` | **Server-side secret only**, if enabling OAuth |
| `FIGMA_REDIRECT_URIS` | Exact Figma-registered callback, e.g. `https://arthurmougin.github.io/figma-xr/?callback` |

The relay works for pairing with no OAuth credentials. If OAuth is enabled, all four OAuth configuration fields must be valid. Keep secrets on the backend; do not add them to Pages variables or `VITE_*` fields.

Then configure these repository Actions settings and rebuild:

| Setting | Type | Purpose |
| --- | --- | --- |
| `FIGMA_XR_RELAY_URL` | Variable | Public HTTPS origin of the pairing relay; enables hosted endpoint defaults in the downloadable plugin |
| `VITE_AUTH_API_URL` | Variable | `https://YOUR-RELAY/api/figma` for the OAuth frontend |
| `VITE_ID` | Secret or existing public-client-ID configuration | OAuth client ID used in the frontend; it is a public identifier |

Without `FIGMA_XR_RELAY_URL`, CI intentionally builds an unconfigured plugin rather than embedding a runner LAN address or pretending Pages is a relay. The mobile lab still works.

After hosting: verify `/health`, allowed-origin preflight, a real anonymous room/socket exchange, and finally the Figma OAuth flow if enabled. Never publish a client secret to make a frontend-only sign-in work. Figma's app visibility/publication requirements still apply independently of hosting.

The **Figma connection in ChatGPT** is separate from the app's OAuth/relay. It was not connected at preparation time. Connecting it enables the available Figma tools for design inspection in chat; it does not deploy this app's backend or grant its browser sessions a Figma token. Check the latest confirmed connection state before claiming it works.

## Evidence and remaining checks

Preparation verified on **2026-11-01**, application code revision `ca767b2`:

| Check | Result |
| --- | --- |
| Unit/integration suite | 38 passed |
| Existing live-plugin/browser suite | 7 passed on the local HTTPS relay/dev server |
| Built app in phone portrait and landscape layouts | 8 passed, including the production vision worker |
| Production frontend and development-plugin builds | Passed on Linux and Windows during preparation; final code built on Windows |
| Relay container | Built; health, origin rejection, room creation and socket join passed; temporary test container removed |
| Visual review | Portrait and landscape preview screenshots checked; non-immersive placement fits the uncovered canvas |
| GitHub read access | Verified |
| GitHub editing from ChatGPT | A real file-save attempt returned HTTP 403, Resource not accessible by integration. Cloud editing is blocked until a write-capable connection is available; do not claim the PC-free editing loop is ready |
| GitHub source publication | Published from the PC; future WIP source updates at the main Pages URL are explicitly authorized |
| GitHub Actions / Pages deployment of this branch | First cloud build and deployment passed: Actions run 41358068914. Public version.json matched c358edc; public catalog placement passed in Chrome over the internet |
| Permanent hosted relay / physical WebXR | Not verified |

The development vision dependency is now prepared before first use, avoiding the observed Vite reload when OpenCV was first requested. The production worker is checked independently from Vite in the mobile suite. Local frontend and relay services can be stopped after publication; they are not part of the remote lab design.

Local automated checks cover anonymous pairing, export revisions, worker initialization, tap queuing, the mobile lab without backend calls, import/export and preservation across reload/sample visits. A public Pages deployment and a Chrome smoke test have passed; physical phone/WebXR acceptance still needs checking. No successful physical screen tracking or hosted OAuth test has been claimed.

Next UI work: one-handed catalog/menu behavior in portrait and landscape; onboarding before camera permission; useful unsupported-AR feedback; entering/exiting XR; placing repeated items; recoverable errors. The lab is an iteration surface, not proof that the live screen tracker is ready.

References: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Figma OAuth setup](https://developers.figma.com/docs/rest-api/oauth-apps/).
