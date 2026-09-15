# Gesture and analysis guide

An experimental chart workspace built on [Vela](https://www.luxalgo.com/vela/).

## Run locally

Requires Node.js 22.12+ and pnpm.

On macOS, double-click `start.command` to start the server with your installed Node.js and pnpm. Keep its Terminal window open; press Ctrl+C there to stop it.

```sh
pnpm install
pnpm dev
```

Open http://127.0.0.1:5173. The development server listens only on this computer.

```sh
pnpm build    # Type-check and create the production bundle
pnpm preview  # Preview that bundle locally
```

## Interface

- Full Vela workspace with a single chart initially; the layout picker enables multiple charts.
- Live Coinbase BTC/USD by default, with Coinbase, Binance, and Hyperliquid available through symbol search. These are public crypto data feeds; availability depends on each provider and your network.
- Native drawing toolbar, chart styles, timeframes, undo/redo, object tree, data window, settings, and screenshots.
- Layouts, drawings, and workspace settings persist in this browser under `vision-charting.workspace.v1`. Display timezone defaults to America/Jamaica.
- Vela's native indicators are available. Pine Script indicators require a separate scripting-engine addon, which is not installed.

The interface uses the pinned `@luxalgo/vela` 0.7.3 package. Vela's built-in visible attribution is retained. Its Apache-2.0 license and attribution notice ship with the dependency.

## Vision gestures

Click the **Vision** hand icon directly below the cursor on the left drawing toolbar. Allow webcam access when prompted. One pointer follows each index fingertip, mirrored like the camera preview.

1. Show both hands with thumb and index apart to arm tracking.
2. The panel shows each hand as **open to arm**, **ready**, or **pinched**. Pinch one hand and hold it, then pinch the other; they do not need to close at the same moment. Hold both briefly (80 ms). The pointer rings become heavier; a dotted line and fixed target mark show when zoom is engaged.
3. Move hands apart to zoom in, or together to zoom out. This adjusts the time viewport; Vela controls price autoscaling as usual.
4. Release either pinch to stop zooming. Click Vision again, press Escape, or use Stop to turn off the camera. Switching away from the tab also stops the camera.

Tracking uses MediaPipe Tasks Vision 0.10.14 in a dedicated worker, with a pinned hand-landmarker model. Frames stay in the browser; no recording, uploads, microphone, or cloud API key. `predev` and `prebuild` copy the runtime assets locally and download the model once from Google's public model storage, verifying its SHA256. Generated assets are ignored by Git.

Pinch detection combines MediaPipe's 3D hand landmarks with visible fingertip contact. The image cue requires previously open fingers and a bounded 3D gap, reducing accidental contact from overlapping projections. Separate entry/release thresholds prevent small fingertip fluctuations from breaking a held pinch. A full fist cannot start a pinch, but the spare fingers can curl naturally during entry and holding; opening thumb and index still releases immediately. These thresholds are provisional and need real webcam testing.

Only the active chart responds. Hand loss, stale tracking, chart/market/layout changes, and manual wheel navigation cancel the current gesture. Reopen your pinches before grabbing again. Good lighting and keeping both hands in frame improve results. Vision implements hand pointers, horizontal chart zoom, swipe scrolling, and candle-energy frames in Inspect mode. Asset selection and drawing placement remain future work.

### Swipe scrolling

Use one active hand, upright with fingers pointing up and the edge angled toward the camera. Hold briefly, then sweep left or right: the candles follow your hand while the zoom level stays fixed. The pointer indicates an active swipe and the panel says **Scrolling**. Turn the palm back toward the camera, curl your fingers, or lower the hand to stop and reposition. A flat palm alone does not scroll. Two active hands reserve control for pinch zoom. Make a fist to deactivate either pointer without moving the hand out of view; the panel shows **fist · off**. The other hand can then swipe on its own. Open the fist to restore its pointer. Two fists pause both pointers, and making a fist during zoom cancels zoom immediately. Curling only the spare fingers during a pinch still keeps the pinch active. There is no momentum after release.

Swipe activation uses 3D palm orientation, a short arming interval, and a horizontal movement threshold. A missing 3D pose cannot activate scrolling. Turning fully edge-on can hide fingers from the camera; a partially sideways angle is sufficient. Thresholds still need hands-on testing.

`pnpm test` runs deterministic tests for pinch arming, dwell, zoom direction, target anchoring, release/loss cancellation, fist rejection, and coordinate mirroring. Real tracking comfort still needs webcam testing across users and lighting conditions.

The toolbar button uses a small DOM adapter in `src/vision-trigger.ts`, scoped to Vela 0.7.3's toolbar markup. Recheck this adapter when upgrading Vela; it restores the icon after toolbar rebuilds and inherits the native collapse behavior. Chart geometry comes from Vela's public renderer-layer SDK, and zoom uses its public viewport API. No code from the temporary comparison repositories is included.

The camera preview labels each fingertip with its landmark number and mirrored, normalized x/y coordinates (0–1).

### Open-palm mode menu

Hold one fully open palm facing the camera for **1.5 seconds**, with the other hand off-screen or in a fist. Progress appears beneath the camera. All four fingers must be extended with the thumb apart; a little tilt is allowed. Brief pose flicker pauses the hold; hand loss, pinching, or turning into a sideways swipe cancels it.

The vertical menu initially highlights your current mode. Move the controlling hand **up for Navigate** or **down for Inspect**, then briefly touch thumb and index to select. The menu uses palm position, not wrist rotation, with smoothing and a neutral zone. Returning to neutral keeps the highlight; contact freezes it. Stable contact for 80 ms selects immediately, and a quick pinch-and-release also works. A fist, hand loss, or Escape cancels. The Mode button and Up/Down + Enter also work. A mouse-opened menu acquires one unpinched hand before accepting a fresh tap.

Selecting **Inspect** opens a second menu: **up for Market Structure**, **down for Fair Value Gaps**. Reopen the selection pinch, then make a fresh tap to confirm the concept. The first tap cannot select both screens. Back or Escape returns to the mode menu; cancelling leaves the previously active mode and concept unchanged.

Chart gestures pause during the hold and selection. **Navigate** has zoom and swipe; **Inspect** has the candle field. Vision always starts in Navigate. Live gesture feel still needs webcam testing.

### Live fingertip candle energy frame

Switch to **Inspect**, choose **Market Structure** or **Fair Value Gaps**, open thumb and index, then pinch each hand to activate the frame. **Keep both pinches closed while moving:** the two index fingertips control opposite corners. Release either pinch to disconnect immediately. Pinch again to reconnect; the other hand can stay pinched.

Make a fist, use **Clear frame** / the box's **×**, stop Vision, open the mode menu, or switch charts to dismiss it. In Inspect mode, a brief tracking loss freezes the box for up to 180 ms and resumes when the same hands return. Uncertain pinch readings get up to 120 ms to recover; a clear opening or fist still disconnects immediately. Longer loss cancels the effect. After a longer loss or explicit clear, reopen each hand before pinching again.

This is a live canvas effects window, not a saved native Vela drawing. It does not record the webcam, capture chart pixels, or change the viewport in Inspect mode. Pixelation, webcam textures, and multiple windows are not included yet.

The Inspect window connects actual candle closes with luminous lines and moving pulses, glowing wick traces, small flame plumes, and sparks clipped to the fingertip-controlled area. Moving edge emitters fire branching connections toward changing candle targets, with sparks and light pulses across the window. In empty chart space they connect to the opposite edges. Reduced-motion mode retains a static connection mesh without flames or particles.

Large energy windows use a bounded rendering budget: at most 72 candle anchors, 140 particles, a one-million-pixel canvas, and roughly 30 animation updates per second. Large blur passes are avoided so the effect leaves time for hand tracking.

### Market structure inside the candle field

The field reveals candle-anchored bullish (mint) and bearish (pink) horizontal levels. Solid lines run from the confirmed swing to the candle that closed beyond it; dashed lines mark the latest unbroken swing high/low. Lines and labels are clipped to the moving field, while their chart coordinates remain fixed.

This is an original swing-based detector inspired by [LuxAlgo's BOS/CHOCH definitions](https://www.luxalgo.com/library/concept/break-of-structure/), not an exact reproduction of Smart Money Concepts. It uses five bars on each side to confirm swings, selects the last equal high/low in a plateau, and excludes the latest possibly forming candle. A first **BREAK** establishes direction, a same-direction break is **BOS**, and an opposing break is **CHOCH**, establishing the new direction. Wick-only crossings do not count. There is one event per broken swing. Swings become known only after the five right-side bars close, even though the level starts at the earlier pivot.

Structure uses all loaded bars, so moving the window does not reset trend context. Results are cached between closed-bar updates (including historical corrections); moving/resizing only projects and clips levels. At most 48 intersecting structure lines are drawn, with overlapping labels suppressed. The existing 30 fps effect, 72 candle-anchor, 140 spark and one-million-pixel budgets remain. This first version has one swing scale, not separate internal/swing layers or LuxAlgo's full SMC filters.

### Freely rotating candle field

While both pinches stay held, the index fingertips control opposite corners of a **2D rotating rectangle**. Raise one hand and lower the other to turn it; move both hands together to translate, or apart/together to scale. Each grab captures the starting proportions (with a usable minimum shape for nearly flat grips), then preserves those proportions until release. A level or vertical grip no longer collapses the field. Hand identities stay fixed, so reordered tracking results do not flip it.

Rotation is calculated in chart pixels to preserve right angles on wide charts. The effects and edge emitters follow the tilted polygon, but candles and horizontal BOS/CHOCH lines stay fixed to the chart. The field is clipped at chart boundaries; the existing tracking recovery, immediate release/fist cancellation, and render budgets remain. The experimental depth layer below adds perspective on top of this rotation.

### Experimental perspective glass

Inspect now adds a bounded perspective tilt. Start with both hands at a comfortable depth and grab; then bring one pinched hand closer to the webcam or move it farther away. Each grab calibrates the two palm sizes independently. The camera panel shows the visual tilt angle. The nearer edge expands and brightens; the farther edge recedes. A projected grid and soft reflection follow the glass, while candles and structure remain anchored underneath. Both gripped corners still follow the fingertips.

This is an approximate depth-driven visual effect, not measured physical distance. [MediaPipe world landmarks have a separate origin at each hand](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/hands.md); comparing their raw z values would be incorrect. We instead compare image palm size against the projected hand-local skeleton, then compare each hand's change from its grab baseline. Common size changes cancel. A 7% logarithmic dead zone, 180 ms smoothing and angular speed limit reduce noise; tilt is capped near 49 degrees. Palm rotation and model errors can still affect this cue. If depth is unavailable, the sheet eases back to the flat rotating field without breaking the grip. Release/fist/tracking-loss rules remain unchanged. No extra model, dependency, or camera upload is added.

### Estimated pressure heatmap

While an Inspect glass field is active, a smooth contour heatmap follows above it (clamped inside the chart near the top edge). The map runs from older candles on the left to newer candles on the right, with higher chart prices above. Cool purple/blue indicates estimated selling pressure; yellow/orange/red indicates buying pressure. Fine contour lines connect equal estimated pressure values. The summary is the volume-weighted net bias for covered candles. Selection tests candle high-low intersection with the actual perspective polygon; it uses the full candle volume, not volume at the intersecting price. All covered candles contribute, independently of the decorative candle sampling limit. The latest candle is included and marked as live when selected.

The estimate uses `pressure = volume × (2 × close − high − low) / (high − low)`, clamped to ±volume. Buy share is `(1 + pressure / volume) / 2`, sell share is the remainder. A zero-range candle is neutral. Missing/invalid volume is excluded and flagged; zero traded volume and no candles have distinct states. This close-location estimate is **not actual aggressor buy/sell volume or trade delta**, and the panel labels that distinction. It works with existing OHLCV feeds wherever volume is supplied, with no extra data service. The terrain uses a fixed 96 × 40 grid, volume-weighted Gaussian interpolation and bilinear sample placement to avoid snapping. Each covered candle contributes at the midpoint of its intersecting price range. Interpolation does not imply measured volume at a price; unsupported regions fade out and are labeled as blank. Contours use 0.05 bias intervals. Rendering is capped around six updates per second; positioning continues with the glass. Release, clear, chart/mode changes, tracking cancellation, or stopping Vision also hide the heatmap.


### Inspect concepts and LuxAlgo Library MCP

Inspect currently offers exactly two concepts:

- **Market Structure** preserves the existing local 5-bar swing / BOS / CHOCH implementation.
- **Fair Value Gaps** adds translucent bullish and bearish zones, dashed midpoints, and a moving light sweep inside the glass. Filled zones become subdued. This is an original TypeScript implementation of the [LuxAlgo Library concept](https://www.luxalgo.com/library/concept/fair-value-gap/), retrieved through its MCP on September 15, 2026. It is not an exact port of a particular Pine indicator.

FVG rules: the third closed candle's low must exceed the first candle's high (bullish), or its high must fall below the first candle's low (bearish). There is no size or displacement filter. A subsequent closed candle's wick reaching the far edge marks a complete fill; partial fills retain the original bounds. The current forming bar cannot create or fill zones. Zones end at the fill bar and remain visible historically. Computation retains the latest 240 gaps and the effect draws at most 32 overlapping its bounding region. Invalid three-candle inputs are skipped. Gap caches detect corrections to closed history. The glass geometry, pinch retention, and estimated pressure terrain are shared by both concepts.

The local server connects to **https://mcp.luxalgo.com/mcp** using the official Model Context Protocol SDK. Opening the Inspect selector verifies the FVG reference through `library_get_concept`; the collapsed Gesture guide shows the connection status and source link. Successful references cache for 15 minutes. The endpoint is public and keyless; no brokerage tools, credentials, chart bars, or webcam frames are sent. Remote code is never executed. Calculation and rendering remain local and work if the Library is offline. Reload to retry an unavailable connection.

`vite.config.mjs` mounts the narrow `GET /api/library/inspect` route in both `pnpm dev` and `pnpm preview`. Static-only hosting has no MCP bridge: the two local concepts still work and report the reference connection as offline. A production server must mount an equivalent route to keep live reference access.

For future concept research, the same server-side client exposes read-only Library tools through a CLI:

```sh
pnpm library search "fair value gap"
pnpm library concept fair-value-gap
# Use an exact indicator slug returned by search:
pnpm library indicator <slug>
pnpm library source <slug>
```

Add future curated choices in `src/inspect-concepts.ts`, their local computation/cache and renderer adapter, and expand the menu's two-row navigation when more than two choices are introduced. MCP retrieval provides reference material, not automatic execution of arbitrary indicators. Consult each source's terms before porting source code; the Library concept attribution is retained here and in the guide.
