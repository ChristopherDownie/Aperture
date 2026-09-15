import { callLibrary } from '../server/luxalgo-library.mjs';
const [action = 'search', ...terms] = process.argv.slice(2);
const value = terms.join(' ').trim();
const names = { search: 'library_search', concept: 'library_get_concept', indicator: 'library_get_indicator', source: 'library_get_source_code' };
if (!names[action] || !value) {
  console.error('Usage: pnpm library <search|concept|indicator|source> <query or exact slug>');
  process.exitCode = 1;
} else {
  try { console.log(JSON.stringify(await callLibrary(names[action], action === 'search' ? { query: value, limit: 8 } : { slug: value }), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
