import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const assets = new URL('public/vision-assets/', root);
await mkdir(assets, { recursive: true });
await cp(new URL('node_modules/@mediapipe/tasks-vision/wasm/', root), new URL('wasm/', assets), { recursive: true });
await cp(new URL('node_modules/@mediapipe/tasks-vision/vision_bundle.cjs', root), new URL('vision_bundle.js', assets));
const hash = 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';
const model = new URL('hand_landmarker.task', assets);
let bytes;
try { bytes = await readFile(model); } catch { /* First install. */ }
const digest = (data) => createHash('sha256').update(data).digest('hex');
if (!bytes || digest(bytes) !== hash) {
  const response = await fetch('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task');
  if (!response.ok) throw new Error(`Hand model download failed: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== hash) throw new Error('Hand model checksum mismatch');
  await writeFile(model, bytes);
}
console.log('Local hand-tracking assets ready.');
