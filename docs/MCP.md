# LuxAlgo Library MCP

Aperture uses the public [LuxAlgo MCP server](https://github.com/LuxAlgo/luxalgo-mcp-server) as a reference source for curated inspection concepts.

- Endpoint: `https://mcp.luxalgo.com/mcp`
- Transport: Streamable HTTP through `@modelcontextprotocol/sdk` 1.30.0.
- Current UI request: `library_get_concept` with the exact slug `fair-value-gap`.
- Local route: `GET /api/library/inspect`.
- Current references require no login or key. Other LuxAlgo MCP capabilities may have different requirements and are not used here.

## What happens when Inspect opens

1. The browser opens the two-concept selector immediately.
2. It requests the local reference route once per controller lifetime.
3. The local server connects to LuxAlgo MCP and retrieves the FVG concept.
4. The adapter validates the exact slug, canonical source URL and a text response.
5. The browser receives connection status, source name/URL and the check timestamp. It does not receive executable code.
6. The collapsed gesture guide shows connection status and the [source link](https://www.luxalgo.com/library/concept/fair-value-gap/).

Concurrent lookups share a pending request. Successful responses are cached in server memory for 15 minutes. Connection and tool calls have timeouts, and the client closes after each operation. If the service fails, the route returns an offline state and the locally implemented concepts remain usable. Reload to retry a failed browser lookup. Restarting the server clears the reference cache.

## Supported research commands

```sh
pnpm library search "fair value gap"
pnpm library concept fair-value-gap
```

Search returns canonical slugs. Use an exact indicator slug from search for:

```sh
pnpm library indicator <slug>
pnpm library source <slug>
```

The client allows only `library_search`, `library_get_concept`, `library_get_indicator` and `library_get_source_code`. The browser route is narrower and cannot invoke arbitrary tool names or slugs. CLI output goes to stdout; retrieved source is not installed or executed.

## Request boundaries

The local connection sends public concept identifiers or research queries plus a generic purpose description. It does not send camera frames, landmarks, chart bars, personal accounts or brokerage credentials. The client has no brokerage/tool-write path. Do not put secrets into CLI research queries.

MCP availability does **not** mean every indicator can run inside Aperture. The server supplies definitions and sources; local TypeScript supplies the current calculations. There is no Pine runtime or LLM-driven code execution in this project.

## Add a concept

1. Search the Library and retrieve the exact concept/reference.
2. Retain the canonical source URL and attribution. If using indicator code, inspect its specific license first; Library prose and indicator code have different terms.
3. Define candle-confirmation, missing-data, invalidation and historical-revision rules.
4. Implement a pure local calculation and cache, following `fair-value-gaps.ts`.
5. Project its results through the Vela coordinate bridge and clip them with the existing field geometry.
6. Register its name in `inspect-concepts.ts` and wire the selection and rendering adapter.
7. Extend the menu beyond its current two-row concept layout before adding more than two choices.
8. Test the calculation and gesture transition; visually inspect rotation, clipping, dense charts and reduced motion.

The existing Market Structure detector is deliberately preserved. Adding a reference must not silently change its calculation settings.

## Deployment

The Vite plugin mounts the route in development and local production preview. Deploying only `dist/` omits this server middleware. Both local overlays remain available, while the connection reports offline. A hosted implementation would need an equivalent server route with request limits, timeouts and the same narrow tool boundary. Do not expose the development server as a production deployment.

## Sources

- [LuxAlgo MCP repository](https://github.com/LuxAlgo/luxalgo-mcp-server)
- [LuxAlgo Library](https://www.luxalgo.com/library/)
- [Fair Value Gap concept](https://www.luxalgo.com/library/concept/fair-value-gap/)
- [Library content and source-code terms](https://www.luxalgo.com/library/license/)
- [Official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
