import test from 'node:test';
import assert from 'node:assert/strict';
import { fairValueGaps, GapCache } from '../src/fair-value-gaps.ts';
const bars=(pairs)=>pairs.map(([low,high],time)=>({time,low,high,close:(low+high)/2}));
test('bullish and bearish gaps use outer wicks and exclude the forming candle',()=>{
  const b=bars([[8,10],[9,14],[12,15]]);
  assert.deepEqual(fairValueGaps(b),[]);
  b.push(...bars([[12,14]]));
  assert.deepEqual(fairValueGaps(b),[{from:0,to:2,low:10,high:12,direction:1,filled:false}]);
  const bear=bars([[12,15],[9,14],[8,10],[8,9]]);
  assert.deepEqual(fairValueGaps(bear),[{from:0,to:2,low:10,high:12,direction:-1,filled:false}]);
});
test('touching outer wicks or invalid candles cannot form a gap',()=>{
  assert.deepEqual(fairValueGaps(bars([[8,10],[9,14],[10,15],[12,14]])),[]);
  const b=bars([[8,10],[9,14],[12,15],[12,14]]);b[1].close=NaN;
  assert.deepEqual(fairValueGaps(b),[]);
});
test('partial retracement leaves original bounds; far-edge wick closes and stops the zone',()=>{
  const b=bars([[8,10],[9,14],[12,15],[11,14],[10,13],[5,9],[4,8]]);
  const partial=fairValueGaps(b.slice(0,5))[0];
  assert.deepEqual(partial,{from:0,to:3,low:10,high:12,direction:1,filled:false});
  const complete=fairValueGaps(b)[0];
  assert.equal(complete.filled,true);assert.equal(complete.to,4);
  const mirrored=b.map(x=>({...x,low:-x.high,high:-x.low,close:-x.close}));
  assert.equal(fairValueGaps(mirrored)[0].filled,true);
});
test('cache detects closed history corrections and ignores forming-bar updates',()=>{
  const b=bars([[8,10],[9,14],[12,15],[12,14]]),cache=new GapCache();
  const original=cache.update(b);b[3].low=0;
  assert.equal(cache.update(b),original);assert.equal(original[0].filled,false);
  b[2].low=9;cache.update(b);assert.equal(cache.zones.length,0);
});
test('retained zone count is bounded on long monotonically rising feeds',()=>{
  const b=Array.from({length:5000},(_,i)=>({time:i,low:i*10,high:i*10+1,close:i*10+.5}));
  const zones=fairValueGaps(b);assert.equal(zones.length,240);assert.ok(zones.every(z=>z.to===4998));
});
