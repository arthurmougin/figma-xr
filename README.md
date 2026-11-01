# Figma XR

## Description

This project is a hobby WebAR figma design tool that allow someone to place in AR different planes from a figma project.
It works on laptop, smartphone, and even in AR with such smartphone.

//chrome://inspect/#devices for debugging on smartphone

## Technologies

- [Babylonjs](https://doc.babylonjs.com/) 
- [Vue3](https://v3.vuejs.org/)
- [Typescript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Github pages](https://pages.github.com/)

## Plugin companion (no OAuth)

For the desktop-free mobile WIP workflow, start with the
[remote work guide](docs/remote-work.md). The `/figma-xr/lab` route uses sample
designs and the companion UI without OAuth, a relay or a desktop. Menu includes
onboarding and catalog backup/import; production-layout checks run with
`npm run test:mobile` after building.

The experimental [plugin companion](docs/plugin-companion.md) pairs an open Figma
file with the phone by QR. It keeps an offline catalog for repeated AR placement
and adds natural-feature screen picking. Taps register immediately; copying can
finish after matching, with a retained XR ray and pending feedback.

Run `npm ci`, `npm run build:plugin`, then `npm run dev:relay` and `npm run dev`
in separate terminals. Import `plugin/manifest.json` into Figma desktop and open
`/figma-xr/companion` on the phone through a reachable, trusted HTTPS address.
This route needs no Figma API credentials. Physical screen tracking still needs
device validation; catalog placement works independently of tracking.

For phone testing without installing a development certificate, build the app
and run `npm run dev:phone` with Cloudflared installed. The plugin is rebuilt
with the temporary address; reopen it to prepare the QR automatically. This
temporary preview needs the local machine to stay on and is separate from the
desktop-free Pages workflow.

## Installation and OAuth configuration

Use Node.js 22.18+ or Node.js 24 LTS, then run `npm ci`.

Figma XR uses a small Node.js auth relay to keep the Figma Client Secret off
GitHub Pages. Copy `.env.example` to `.env.local` and `.env.auth.example` to
`.env.auth`, then follow the [Figma OAuth migration and setup guide](docs/figma-oauth-migration.md)
for the exact credentials, scopes, callbacks and production settings.

Run `npm run dev:auth` and `npm run dev` in separate terminals, then open
<https://localhost:5173/figma-xr/>.

GitHub Pages hosts the frontend; the auth relay needs a separate HTTPS Node.js
host. Never put the Client Secret in a `VITE_*` variable.

## Validation

```bash
npm test
npm run build
```

OAuth tests use simulated Figma responses. A real sign-in requires a published
Figma OAuth app and a configured auth relay.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)


