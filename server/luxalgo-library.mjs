import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const LIBRARY_ENDPOINT = 'https://mcp.luxalgo.com/mcp';
const context = 'Retrieving public trading concept references to support local chart inspection overlays and prepare additional documented visual concepts for future expansion.';
const tools = new Set(['library_search', 'library_get_concept', 'library_get_indicator', 'library_get_source_code']);
export function decodeLibraryResult(result) {
  if (result.isError) throw new Error('LuxAlgo Library rejected the request');
  const text = result.content?.filter(c => c.type === 'text').map(c => c.text).join('\n');
  if (!text) throw new Error('LuxAlgo Library returned an empty response');
  try { return JSON.parse(text); } catch { return { content_markdown: text }; }
}
// Library-only access. No camera frames, chart bars, account credentials or
// brokerage tools are sent through this connection. Remote source is never run.
export async function callLibrary(name, args) {
  if (!tools.has(name)) throw new Error('Unsupported Library tool');
  const client = new Client({ name: 'aperture', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(LIBRARY_ENDPOINT));
  try {
    await client.connect(transport, { timeout: 12000 });
    return decodeLibraryResult(await client.callTool({ name, arguments: { ...args, context } }, undefined, { timeout: 15000 }));
  } finally { await client.close().catch(() => {}); }
}
let cached = null;
let pending = null;
export async function inspectLibraryReference() {
  if (cached && Date.now() - cached.checkedAt < 15 * 60_000) return cached;
  if (pending) return pending;
  pending = (async () => {
    const concept = await callLibrary('library_get_concept', { slug: 'fair-value-gap' });
    const url = 'https://www.luxalgo.com/library/concept/fair-value-gap/';
    if (concept.slug !== 'fair-value-gap' || concept.url !== url || typeof concept.content_markdown !== 'string') {
      throw new Error('Unexpected Library concept response');
    }
    cached = { status: 'connected', endpoint: LIBRARY_ENDPOINT, slug: concept.slug, url, name: 'Fair Value Gaps', checkedAt: Date.now() };
    return cached;
  })();
  try { return await pending; } finally { pending = null; }
}
export function libraryPlugin() {
  const attach = server => { server.middlewares.use('/api/library/inspect', async (req, res) => {
    if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return; }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    try { res.end(JSON.stringify(await inspectLibraryReference())); }
    catch { res.statusCode = 503; res.end(JSON.stringify({ status: 'offline', message: 'Library unavailable; local concepts remain available.' })); }
  }); };
  return { name: 'luxalgo-library', configureServer: attach, configurePreviewServer: attach };
}
