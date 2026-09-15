# Troubleshooting

## Server will not start

Check `node --version` and `pnpm --version`. Use Node 22.12+ and pnpm 11.19.0, then run `pnpm install --frozen-lockfile` from the repository root. On macOS, install these tools before using `start.command`.

Port 5173 must be free. `dev` and `preview` intentionally use the same strict port: stop the existing server with Ctrl+C before starting the other. Do not stop an unrelated service without checking what owns the port.

## First-run model download fails

The preparation script downloads the pinned hand model from Google's public storage and checks its SHA-256. Verify network access and rerun `pnpm dev`. Do not bypass a checksum failure. Generated assets live in `public/vision-assets/` and can be regenerated from the script.

## Camera is blocked or busy

Use the localhost URL, or HTTPS for a separately hosted deployment. Camera access requires a secure context. Allow the site's camera permission; check browser and operating-system permissions. Close other applications holding exclusive camera access, then stop and restart Vision. Switching to another tab intentionally stops the camera.

An early “Unable to play media” accessibility message can appear before stream startup. Judge startup using the visible video, tracking indicators and final status; a persistent blank feed or error needs investigation.

## Pinches do not engage

Open thumb and index first so the hand reads **ready**. Pinch one hand and keep holding it; then pinch the other. Simultaneous contact is not required. Keep both hands visible and separated enough to avoid overlap. Check the per-hand state indicators rather than assuming both pinches registered.

When Inspect opens its concept picker, release the selection pinch and make a new tap. A held pinch is intentionally prevented from choosing both menus at once.

## Open palm does not open the menu

Use exactly one active hand. Keep the other off-screen or in a fist. Extend four fingers, leave the thumb apart and face the palm toward the camera with only a modest tilt. Hold for 1.5 seconds and watch the progress bar. A sideways swipe pose cancels the dwell. The Mode button remains available as a fallback.

## Glass disconnects or jitters

Both pinches must remain held. Releasing either one or making a fist disconnects immediately. Brief missing-hand tracking freezes the field before recovery; longer loss cancels it. Keep fingertips away from camera edges and avoid overlapping hands. Improve frontal lighting and reduce background clutter. Open fingers again after a full cancellation.

Depth tilt is approximate and sensitive to palm rotation. Each new grab calibrates a baseline; begin with hands at a comfortable similar depth. A missing depth cue eases the sheet flat rather than ending the grip.

## Chart or analysis is empty

Check the exchange connection and selected symbol/timeframe. Providers can be unavailable in some networks or regions. Analysis needs enough loaded history and may have no relevant zones within the window. The latest forming bar cannot form an FVG or confirm a structure break. Small/rotated windows can suppress labels that do not fit.

The pressure map needs valid volume. Blank areas are not proof of zero buying or selling; the terrain interpolates a candle-based estimate and does not measure volume at each price.

## Library reports offline

The local calculations still work. Check `pnpm library concept fair-value-gap` and network access to `https://mcp.luxalgo.com/mcp`. Use `pnpm dev` or `pnpm preview`; a static-only server does not provide `/api/library/inspect`. Reload the app after restoring connectivity. No API key is needed for this reference lookup.

## Build warning about bundle size

The production build currently emits a large-chunk warning because it includes the Vela workspace. This warning is not a TypeScript or build failure. MediaPipe runtime/model assets are served separately and generated locally.
