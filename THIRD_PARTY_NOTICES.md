# Third-party notices

Aperture's MIT license covers its original application code. Dependencies and referenced material retain their own licenses and notices.

## Vela — LuxAlgo

Aperture uses `@luxalgo/vela` 0.7.3 for the chart workspace, renderer, providers and native tools.

- Project: https://www.luxalgo.com/vela/
- Repository: https://github.com/LuxAlgo/Vela
- License: Apache-2.0; a copy from the pinned package is in [licenses/VELA-LICENSE.txt](licenses/VELA-LICENSE.txt).
- Upstream notice: [licenses/VELA-NOTICE.txt](licenses/VELA-NOTICE.txt), copied unchanged from the pinned package.

The built-in Vela attribution remains visible on the chart. Redistributions must preserve the applicable license and notice, and follow the upstream visible-attribution requirement.

## LuxAlgo Library and LuxAlgo MCP

Aperture connects to the [LuxAlgo MCP](https://github.com/LuxAlgo/luxalgo-mcp-server) hosted endpoint using the official MCP SDK. The LuxAlgo server implementation is not copied into this repository.

Source: **LuxAlgo Library**:

- [Break of Structure](https://www.luxalgo.com/library/concept/break-of-structure/)
- [Fair Value Gap](https://www.luxalgo.com/library/concept/fair-value-gap/)
- [Library content terms](https://www.luxalgo.com/library/license/)

The local detectors are original TypeScript implementations of documented concepts, not copied Pine indicators or exact reproductions of LuxAlgo Smart Money Concepts. Library prose is attributed separately from application code. Indicator and strategy sources returned by MCP have their own terms; those are not relicensed by Aperture's MIT license.

## MediaPipe — Google

`@mediapipe/tasks-vision` 0.10.14 supplies hand-landmark inference. The runtime is installed as a dependency; its WASM and JavaScript files are copied locally during setup. The pinned hand-landmarker model is downloaded from Google's public MediaPipe model storage and checked against the checksum in `scripts/vision-assets.mjs`.

- Project and source: https://github.com/google-ai-edge/mediapipe
- Hand-landmarker documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
- Runtime package metadata declares Apache-2.0. The runtime and model remain upstream assets; generated binaries are excluded from Git. Consult upstream notices/model documentation when redistributing generated assets.

## Model Context Protocol TypeScript SDK

`@modelcontextprotocol/sdk` 1.30.0 is used server-side for Streamable HTTP transport.

- Repository: https://github.com/modelcontextprotocol/typescript-sdk
- License: MIT, included in the installed package.

## Other dependencies

Vite, TypeScript and their transitive dependencies are installed through the pinned lockfile. Their upstream licenses remain applicable. The lockfile and package metadata identify exact versions; this notice does not replace dependency-specific licenses.
