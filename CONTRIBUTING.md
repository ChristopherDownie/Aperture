# Contributing to Aperture

Aperture is an experimental gesture interface built on Vela. Improvements should preserve ordinary chart controls and predictable camera start/stop behavior.

## Development

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

Use Node 22.12+ and the pnpm version pinned in `package.json`. Changes to Vela's pinned version need a review of the toolbar DOM adapter and public renderer-layer integration. Keep the visible Vela attribution.

## Changes and validation

- Keep calculation code independent of DOM/camera state when possible.
- Add regression tests for behavioral changes: confirm/release edges, lost tracking, both hand identities, menu stages and mode cancellation.
- For financial overlays, state confirmation timing, historical corrections, missing-data handling and invalidation rules. Distinguish measured data from estimates.
- Visually check chart clipping, rotated/perspective fields, dense charts, label overlap and reduced-motion behavior.
- Test real webcam interactions when changing recognition. Record the browser, OS, approximate lighting, gesture sequence and observed behavior; deterministic tests alone do not prove recognition accuracy.
- Keep camera processing local. Library research belongs on the server-side client; do not add remote execution of retrieved code.
- Preserve source attribution and inspect licenses before reusing external code.

## Reporting a bug

Include the app revision, browser/OS, selected symbol and timeframe, Navigate/Inspect concept, steps to reproduce, expected behavior and actual behavior. Mention which hand failed and what its status indicator showed for gesture issues. A short recording or screenshot can help; crop personal information and only attach camera footage you intend to share.

## Pull requests

Explain the problem, resulting behavior and validation. Keep changes focused and update the relevant guide if controls or analysis rules change. Do not commit generated model assets, dependencies, build output, environment files or credentials.
