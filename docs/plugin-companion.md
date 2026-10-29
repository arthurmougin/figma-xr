# Figma plugin companion (experimental)

This adds an optional plugin route to the existing Figma XR app. The OAuth project browser stays available. The plugin route requires no OAuth application, client ID, client secret, or personal access token: a plugin running in an open Figma file supplies its own exports.

## Run locally

Use Node 24 and two terminals in the repository:

```sh
npm ci
npm run build:plugin
npm run dev:relay
```

```sh
npm run dev
```

`dev:relay` works without `.env.auth`. If OAuth credentials are present, it also serves the existing OAuth endpoints. The Vite server forwards `/api/pair` HTTP and WebSocket traffic to the relay on port 8787. Do not expose the plain HTTP relay directly; use HTTPS/WSS through a reverse proxy or the development server.

The companion is at `/figma-xr/companion`. A link on the landing page also opens the most recently saved catalog.

## Test on a phone with temporary HTTPS

If `cloudflared` is installed, there is a certificate-free testing path:

```sh
npm run build
npm run dev:phone
```

The command creates a temporary HTTPS address and rebuilds the development plugin with it. Close and reopen **Figma XR Companion** in Figma: it prepares the QR automatically. Scan it on the phone; no URL entry is needed. Leave the terminal running; stopping it closes the temporary address. Each start produces a different hostname, so reopen the plugin after starting a new preview.

This preview serves the built app and its own in-memory pairing service through a temporary Cloudflare HTTPS tunnel. It does not load OAuth credentials, expose the Vite development server or serve the repository. The URL is an externally reachable testing endpoint; pairing tokens still control access to each room's exported assets. The existing `dev:relay` service is not needed for this mode. Source changes require another build. Use the LAN/trusted-certificate route below if you prefer local network testing.

## Load the plugin

1. In Figma desktop, open a design file. Use **Plugins → Development → Import plugin from manifest** and select `plugin/manifest.json` from this checkout. The preceding build creates the ignored `plugin/dist` files it references.
2. Run **Figma XR Companion** from Development plugins. No Community publication is needed for development. Figma assigns a plugin ID when you create/publish a plugin; this is separate from an OAuth client ID.
3. The plugin prepares a QR automatically. A local build chooses the current private Wi-Fi address and connects the desktop through `http://127.0.0.1:8787`; the phone uses the HTTPS site/proxy on port 5173. These reach the same relay. URL fields are hidden under **Connection settings**.
4. Scan the QR on the phone. For LAN testing both devices must be on the same network, the HTTPS certificate must be acceptable to the phone, and Windows must allow private LAN access on port 5173. Run `scripts/allow-phone-lan.ps1` as administrator to add a narrow rule for Node, port 5173, private Wi-Fi and the local subnet. The script defaults to the `WiFi` interface; use `-InterfaceAlias` for another interface. Remove it later with `Remove-NetFirewallRule -Name FigmaXR-Phone-Private-5173` if no longer needed.
5. The development relay automatically allows the detected LAN companion origin for pairing. OAuth keeps its separate, configured origin checks. On a hosted relay, configure `FIGMA_ALLOWED_ORIGINS` with the companion's exact origin.
6. Exporting begins only when a phone joins. The plugin must stay running for live edits and screen picking. The phone retains catalog images after disconnecting and reloads them from IndexedDB.

`npm run dev` rebuilds the plugin before starting Vite. After a changed address or build, close and reopen the Figma development plugin to load the new bundle. Existing saved localhost settings migrate to the new build address automatically. Manual overrides are available in **Connection settings → Apply and reconnect** and remain active while the build's endpoints are unchanged.

For a published plugin, set `FIGMA_XR_COMPANION_URL` and `FIGMA_XR_RELAY_URL` in `.env.local` or the build environment to stable HTTPS addresses. An optional `FIGMA_XR_DESKTOP_RELAY_URL` can use a different desktop transport to the same relay. Otherwise it defaults to the public relay. Only these public endpoint fields are bundled. CI and production builds do not infer a private address from the build machine; configure their endpoints explicitly. A Figma plugin cannot inspect the operating system's network interfaces itself, so local address detection happens in the Node build/helper. A VPN or multiple physical networks can still require an explicit override.

The development manifest permits configurable network destinations. Before a Community release, restrict `networkAccess.allowedDomains` to the production relay and move localhost destinations to `devAllowedDomains`.

## Plugin startup troubleshooting

Connection fields should already be filled by the build. If the panel remains at startup, close it and rerun **Plugins → Development → Figma XR Companion** to load both the rebuilt controller and UI. The panel now retries the settings handshake and reports a controller timeout after five seconds instead of waiting indefinitely. SDK replies are correlated with a per-launch token, without assuming a particular browser `MessageEvent.source` value. Errors in optional page-watching setup no longer prevent the connection handler from starting.

If it reports that the pairing service is unreachable, keep `npm run dev:relay` and `npm run dev` running. The local desktop endpoint is `http://127.0.0.1:8787`; the phone endpoint uses the computer's HTTPS LAN address through Vite. These are intentionally different routes to the same relay. A loaded QR followed by a phone timeout is a network/firewall or phone HTTPS issue, separate from the controller startup.

## Experience

Visible top-level frames, components, instances and groups become catalog entries. **Add selected items** adds nested elements, including offscreen selections. The catalog accumulates as you pan and is bounded to 256 items per pairing session. Search it on the phone and place any item repeatedly without returning to the desktop. The library works without a current screen match or a connected plugin.

Enter AR and tap the desktop whenever you want. Matching starts automatically; there is no ready-state gate on input. A pulsing reticle and subtle ray acknowledge the tap immediately while the phone locates the screen. Move slightly sideways if acquisition needs more depth information. Once a match is reliable, the saved tap resolves to an item and the copy flashes into place. Multiple taps can be pending independently.

Tap catalog entries for free placement, drag copies to move them and pinch to scale. Gestures starting on a placed object manipulate that object instead of queuing another copy. Copies have their own textures and do not change when the Figma source is edited. Clearing placed items leaves the catalog intact. Placed objects are session-local; the catalog is the persisted part.

Pending taps can be cancelled from the phone. They expire after eight seconds rather than copying unexpectedly much later. Edits, pan/zoom, a replaced reference, disconnection, XR reference-space resets and manual recalibration cancel pending requests; a tap made while the next reference is loading can bind to that publication if no further canvas invalidation occurs. The prototype retains up to twelve pending requests, replacing the oldest with visible feedback when full.


## What the homography does

The viewport export is one flat reference image. ORB descriptors match distinctive details in that image to camera pixels. RANSAC rejects inconsistent matches and estimates a 3×3 homography `H`:

```text
cameraPixel ~ H × referencePixel
referencePixel ~ inverse(H) × cameraPixel
```

The homogeneous division accounts for perspective: a rectangular viewport can appear as a trapezoid. Reference pixels map linearly to document coordinates through the exported viewport bounds. Selection uses containing paint bounds and paint order; a tap on empty space does not choose a nearby frame.

A homography alone does **not** establish physical monitor size or metric depth. This prototype associates the same reference features across synchronized WebXR camera frames, triangulates them using translated XR camera poses, and fits a metric screen plane. Rotation alone cannot provide that depth. It requires at least a 2.5 cm baseline, enough well-spread consistent features, a plausible aspect ratio and a low fitting residual. Two consistent plane estimates are needed before accepting a pose. The input ray is captured at the start of the tap and retained in XR reference coordinates. When available, an XR anchor at that ray's origin and orientation follows spatial corrections; it does not assume a known surface depth. Once the plane is recovered, its intersection with the retained ray resolves the original tap in document coordinates, even if the camera has since moved. The pending reticle is provisional feedback along that ray, not an estimated surface hit. It moves to the actual screen intersection when resolved. This assumes the physical monitor stays still during acquisition.

Screen location is held fixed after acquisition and verified by reprojection against fresh matches. Three inconsistent checks discard it. Completing a pending copy requires an accepted camera observation under 900 ms old; registering a tap does not. Match freshness uses the camera capture time rather than the time the worker returns. Placed clones never follow successive homography estimates. WebXR anchors are used when available; otherwise copies retain their world transforms. Moving the monitor requires reacquisition.

## Edits and feature-map revisions

The plugin listens to the current page's `nodechange` event. Changes dirty affected catalog exports, including exported ancestors of edited children. Movement of an exported node updates placement without re-exporting that node's own pixels; movement inside an exported ancestor dirties the ancestor. Deleted nodes are removed from the catalog; already placed copies remain snapshots. Offscreen cached items are re-exported when dirty.

Visible changes and viewport pan/zoom immediately cancel pending requests against the previous canvas. An explicit invalidation epoch is observed even while no reference image is loaded. After a short debounce, the plugin publishes updated catalog assets and a new bounded viewport PNG with matching document bounds, item versions and a monotonic revision. Exports that race with edits are retried. The phone ignores stale matching results, rebuilds descriptors for the new viewport image and reacquires the screen pose. This first implementation rebuilds the visible viewport's descriptors rather than maintaining a per-tile incremental feature index; it does not re-index the whole document.

The viewport PNG is exported through a temporary SliceNode, removed in `finally`. This preserves overlaps and clipping in the visible composition. There are no permanent helper markers, but these transient document operations may affect undo history and should be validated with collaboration and large files before release.

## Tracking a monitor

Printed targets are not a requirement for planar feature matching. Displays introduce additional acquisition problems: moire from the camera/display pixel grids, flicker banding, glare, blur, and repeated or low-detail UI. These may reduce matches or produce unstable estimates. The worker uses a slightly blurred grayscale image, descriptor ratio tests, RANSAC, spread and reprojection thresholds. Matching runs in a worker on bounded images; raw camera frames never go through the relay.

Those measures do not guarantee a match on every screen. The UI records taps immediately and defers copying when confidence is insufficient, with feedback, cancellation and an expiry. Catalog placement and already placed clones remain usable. Actual phone/monitor acquisition rate, latency, alignment error, camera-texture orientation and long-session anchor behavior still require physical-device validation. No claim of production-quality screen tracking is made from synthetic tests.

Current picking uses axis-aligned exported bounds. Rotated top-level nodes are available in the catalog but excluded from screen picking. Overlapping transparent shapes are selected by their bounds, not by a pixel-alpha hit test. Prototyping supports exported flat panels, not reconstruction of 3D geometry from arbitrary Figma artwork.

## Relay and deployment

Pairing creates random room and separate desktop/phone capability tokens. WebSocket credentials are sent in the first message, not the WebSocket URL. The QR's phone token is in its fragment; the app removes it from the visible address and retains it in session storage for reloads. Keep the QR private. The phone cannot publish document assets. Sessions expire after one hour without activity; catalog images remain in the phone browser. Each room is bounded to 256 catalog items / 60 MB, with message and socket backpressure limits. This in-memory relay is for a small prototype, not a hardened multi-tenant public upload service.

GitHub Pages can host the app and its worker, but cannot host the relay. Configure the plugin with the separately hosted HTTPS/WSS relay. The Pages 404 fallback preserves the companion route and pairing fragment. No OAuth build variables are required for the companion. OAuth login still requires its existing configuration.

## Validation

```sh
npm test
npm run build
# With the relay and Vite running, plus a Playwright browser installed:
npm run test:browser
# Windows with Google Chrome installed:
# $env:PLAYWRIGHT_CHANNEL='chrome'; npm.cmd run test:browser
```

Unit/integration tests exercise actual OpenCV perspective matching, reference invalidation, metric geometry, degenerate motion rejection, pose gating, relay authorization, asset revisions, deletion and reconnection. Pending-input tests cover delayed matching after camera motion, multiple taps, reference loading and invalidation, exact asset versions, expiry, cancellation, anchor corrections and late-anchor cleanup. Browser tests cover anonymous pairing, placement, edited catalog assets, offline persistence and OpenCV worker initialization. An actual Figma session and physical WebXR session remain necessary acceptance tests.

## References

- [Figma plugin manifest](https://developers.figma.com/docs/plugins/manifest/)
- [Figma viewport](https://developers.figma.com/docs/plugins/api/figma-viewport/)
- [Figma node exports](https://developers.figma.com/docs/plugins/api/properties/nodes-exportasync/)
- [Page nodechange events](https://developers.figma.com/docs/plugins/api/properties/PageNode-on/)
- [OpenCV feature matching and homography](https://docs.opencv.org/4.13.0/d1/de0/tutorial_py_feature_homography.html)
- [WebXR raw camera access](https://immersive-web.github.io/raw-camera-access/)
- [WebXR anchors](https://immersive-web.github.io/anchors/)
- [Screen-camera moire and flicker-banding research](https://libozhu03.github.io/CLEAR/)
