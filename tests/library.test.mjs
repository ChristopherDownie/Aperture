import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeLibraryResult, callLibrary } from '../server/luxalgo-library.mjs';
test('Library result decoding rejects remote tool errors and empty responses',()=>{
  assert.throws(()=>decodeLibraryResult({isError:true,content:[{type:'text',text:'failed'}]}));
  assert.throws(()=>decodeLibraryResult({content:[]}));
  assert.deepEqual(decodeLibraryResult({content:[{type:'text',text:'{"slug":"fair-value-gap"}'}]}),{slug:'fair-value-gap'});
});
test('connector refuses non-Library tools before opening a connection',async()=>{
  await assert.rejects(callLibrary('broker_trades',{}),/Unsupported Library tool/);
});
