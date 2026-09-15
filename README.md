# Aperture

**Explore charts with your hands.**

Aperture is an experimental webcam-controlled chart workspace built on **[Vela](https://www.luxalgo.com/vela/)**, with a connection to the **[LuxAlgo Library MCP](https://github.com/LuxAlgo/luxalgo-mcp-server)** for documented trading concepts.

Pinch to zoom, swipe through price history, or hold a moving glass field over candles to reveal market structure, fair value gaps, and estimated pressure. The surrounding interface is monochrome; the inspection field carries the visual effects.

A personal open-source project by [Christopher Downie](https://github.com/ChristopherDownie). Vela and the LuxAlgo Library are credited dependencies and reference sources; this repository is the Aperture application.

## What you can do

| Mode | Controls | Result |
| --- | --- | --- |
| **Navigate** | Two held thumb–index pinches; move hands apart/together | Zoom the time axis around a fixed target |
| **Navigate** | One upright hand, angled sideways; move left/right | Scroll the chart |
| **Inspect → Market Structure** | Hold both pinches and move the glass | Reveal swing levels, BOS and CHOCH |
| **Inspect → Fair Value Gaps** | Hold both pinches and move the glass | Reveal bullish/bearish gap zones, midpoints and fills |
| **Either Inspect concept** | Move, rotate, resize and change relative hand depth | Manipulate a perspective glass field with candle connections, sparks and a pressure terrain above it |

The standard Vela interface remains available: symbols, timeframes, chart styles, indicators, drawings, layouts and chart settings. Mouse and keyboard still work.

## Quick start

Requirements:

- **Node.js 22.12 or newer** and **pnpm 11.19.0**.
- A webcam and a modern browser supporting Web Workers, WebAssembly and webcam access. Desktop Chromium is the primary development target; cross-browser gesture accuracy is not yet characterized.
- Internet access for installing dependencies, downloading the hand model on first startup, and fetching market data. Live Library references also require internet access.

```sh
git clone https://github.com/ChristopherDownie/Aperture.git
cd Aperture
pnpm install --frozen-lockfile
pnpm dev
```

Open **[http://127.0.0.1:5173](http://127.0.0.1:5173)**. The server listens on loopback only. On macOS, `start.command` is an optional launcher after Node.js and pnpm are installed.

The first start downloads Google's pinned hand-landmarker model and verifies its SHA-256. MediaPipe runtime assets are copied from the installed dependency. Generated assets, dependencies and build output are excluded from Git.

```sh
pnpm test      # Deterministic gesture, geometry, analysis and connector tests
pnpm build     # TypeScript checks and production bundle
pnpm preview   # Serve that bundle locally, including the Library bridge
```

The repository is public; `private: true` in `package.json` only prevents accidental publication to npm.

## Your first session

1. Click the **Vision hand icon**, directly beneath the cursor in the left toolbar. Allow camera access.
2. Start with thumb and index apart. **Navigate is always the startup mode.**
3. Pinch one hand, keep holding, then pinch the other. Move apart to zoom in; together to zoom out. Release either pinch to stop.
4. To change modes, show **one fully open palm facing the camera for 1.5 seconds**. Keep the other hand off-screen or in a fist.
5. Swipe **up for Navigate** or **down for Inspect**, then tap thumb and index to select.
6. Inspect opens a second menu: **up for Market Structure**, **down for Fair Value Gaps**. Reopen your fingers and make a fresh tap to confirm.
7. In Inspect, hold both pinches to create the glass. Move both hands to translate; separate them to enlarge; raise one to rotate; bring one closer to the camera to tilt. **Keep both pinches held.**

Make a fist to switch that hand's pointer off. Open it to restore tracking. Stop, the Vision icon, Escape outside a menu, or switching away from the tab turns the camera off. In the concept menu, Escape goes back; in the mode menu, it cancels.

The **Mode** button offers the same choices with a mouse, or use Up/Down and Enter in the open menu. Expand **Gesture guide** below the camera for recognition status, detailed instructions and the Library connection status.

See the [complete gesture and analysis guide](docs/GUIDE.md) for thresholds, recovery behavior, structure rules, FVG fill rules and pressure calculations.

## Built with Vela

[![Vela — fast, extensible financial charts for the web](https://raw.githubusercontent.com/LuxAlgo/Vela/main/.github/banner.png)](https://github.com/LuxAlgo/Vela)

*Official Vela banner from the [LuxAlgo/Vela repository](https://github.com/LuxAlgo/Vela).*

[Vela](https://github.com/LuxAlgo/Vela) supplies the chart workspace, renderer, native controls, layouts, drawing tools and exchange providers. Aperture uses its public renderer-layer coordinates to align overlays with actual candles and its public viewport API for chart movement.

Aperture pins `@luxalgo/vela` **0.7.3**. The Vision toolbar icon uses a small DOM adapter specific to that version; upgrades should recheck toolbar integration. Vela's visible chart attribution remains enabled. See [third-party notices](THIRD_PARTY_NOTICES.md).

The default symbol is Coinbase BTC/USD, with Coinbase, Binance and Hyperliquid available through Vela's providers. These are public exchange feeds, not a separate LuxAlgo market-data subscription. Symbols and feeds can be unavailable depending on the exchange and network.

## LuxAlgo Library MCP integration

Aperture connects to **[LuxAlgo MCP](https://github.com/LuxAlgo/luxalgo-mcp-server)** at `https://mcp.luxalgo.com/mcp`, using the official Model Context Protocol TypeScript SDK.

Opening the Inspect concept menu asks the local server to verify the [Fair Value Gap reference](https://www.luxalgo.com/library/concept/fair-value-gap/) with `library_get_concept`. A successful reference is cached for 15 minutes. The guide shows **Library · connected**, or an offline state if the request fails.

**The MCP supplies references; the overlays calculate and render locally.** It does not process video, receive chart candles, stream indicator signals, or execute Pine scripts. The current Market Structure implementation remains Aperture's local swing detector. Fair Value Gaps is an original TypeScript implementation of the Library's documented three-candle concept.

The same client supports future research through the CLI:

```sh
pnpm library search "fair value gap"
pnpm library concept fair-value-gap
# Replace <slug> with an exact indicator slug returned by search:
pnpm library indicator <slug>
pnpm library source <slug>
```

Only the two curated Inspect concepts are selectable today. A newly retrieved concept still needs a reviewed calculation, renderer and tests before it can become an overlay. Individual indicator source licenses must be checked before reuse.

See [MCP connection and extension guide](docs/MCP.md) for tools, request flow, caching and deployment behavior.

## Hand tracking powered by MediaPipe

Aperture uses **[MediaPipe by Google](https://github.com/google-ai-edge/mediapipe)** to detect hand landmarks locally from the webcam. MediaPipe provides the tracking foundation; Aperture implements the gesture controls, menus and chart overlays on top of those landmarks.

The MediaPipe Tasks Vision runtime is licensed under **Apache 2.0**. See the [third-party notices](THIRD_PARTY_NOTICES.md#mediapipe--google) for runtime and model attribution, and the [Hand Landmarker documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) for the underlying tracking capability.

## Camera and network behavior

- Webcam inference runs locally in a dedicated **MediaPipe Tasks Vision** worker. There is no recording, frame upload or microphone access in Aperture.
- The hand-model download comes from Google's public model storage; exchange requests go to the selected market-data provider.
- MCP requests send public concept/tool queries and a generic purpose description to LuxAlgo. No camera frames, chart bars, brokerage credentials or account requests are sent by this integration.
- Browser persistence stores Vela workspace settings and drawings under `vision-charting.workspace.v1`, retained for compatibility. It does not store camera footage.
- No exchange API key, brokerage account, LuxAlgo login or LLM API key is required for the current local feature set.

## Current limits

- Experimental gesture recognition: lighting, occlusion, camera angle and performance affect accuracy. Automated tests do not establish real-world detection accuracy.
- Pressure terrain is an **OHLCV close-location estimate**, not measured aggressor buy/sell volume, trade delta, or a volume-at-price footprint. It is labeled in the interface.
- Market Structure uses confirmed five-bar swings; it is not an exact reproduction of LuxAlgo Smart Money Concepts. FVG uses closed candles, no size filter and a far-edge wick fill rule.
- The 3D glass is an approximate perspective effect, not calibrated physical depth. The underlying candles stay in chart space.
- One inspection field at a time; gesture-created native drawings, asset-switching gestures, arbitrary Library indicators and Pine execution are not implemented.
- Static hosting preserves the local overlays but does not supply the server-side MCP route. Use `pnpm dev` or `pnpm preview` for the full local experience. No hosted deployment is included.

## Documentation

- [Gesture and analysis guide](docs/GUIDE.md) — controls, equations, thresholds and render budgets.
- [Architecture](docs/ARCHITECTURE.md) — chart integration, tracking, menus, overlays and data flow.
- [LuxAlgo MCP](docs/MCP.md) — connection, CLI and adding concepts.
- [Troubleshooting](docs/TROUBLESHOOTING.md) — camera, tracking, startup and network issues.
- [Contributing](CONTRIBUTING.md) — development and validation expectations.
- [Third-party notices](THIRD_PARTY_NOTICES.md) — Vela, MediaPipe and Library attribution.

## License and credits

Aperture's original application code is released under the [MIT License](LICENSE).

Built on **[Vela by LuxAlgo](https://www.luxalgo.com/vela/)**, with concept references from the **[LuxAlgo Library](https://www.luxalgo.com/library/)** through **[LuxAlgo MCP](https://github.com/LuxAlgo/luxalgo-mcp-server)**, hand tracking from **[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)**, and the **[MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)**. Dependencies and referenced material retain their own licenses.
