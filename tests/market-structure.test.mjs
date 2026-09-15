import test from 'node:test';
import assert from 'node:assert/strict';
import {marketStructure,StructureCache,structureInWindow} from '../src/market-structure.ts';
const candles=values=>values.map((close,time)=>({time,high:close+.4,low:close-.4,close}));
const sequence=candles([10,12,10,13,11,14,10,9,11,8,10,7,8]);
const breaks=bars=>marketStructure(bars,1).filter(l=>l.broken);

test('confirmed closes establish bias, continue with BOS and reverse with CHOCH',()=>{
  assert.deepEqual(breaks(sequence).map(({from,to,price,direction,label})=>({from,to,price,direction,label})),[
    {from:1,to:3,price:12.4,direction:1,label:'BREAK'},
    {from:3,to:5,price:13.4,direction:1,label:'BOS'},
    {from:4,to:6,price:10.6,direction:-1,label:'CHOCH'},
    {from:7,to:9,price:8.6,direction:-1,label:'BOS'},
    {from:9,to:11,price:7.6,direction:-1,label:'BOS'},
  ]);
});
test('bearish-first sequence has symmetric continuation and bullish reversal',()=>{
  const mirrored=sequence.map(b=>({time:b.time,high:30-b.low,low:30-b.high,close:30-b.close}));
  const expected=breaks(sequence);
  const actual=breaks(mirrored);
  assert.deepEqual(actual.map(l=>l.label),expected.map(l=>l.label));
  assert.deepEqual(actual.map(l=>l.direction),expected.map(l=>-l.direction));
});
test('forming candles and wick-only sweeps cannot confirm a break',()=>{
  const bars=candles([10,12,10,11,11]);bars[3].high=14;
  assert.equal(breaks(bars).length,0);
  bars[4].close=15;bars[4].high=16;
  assert.equal(breaks(bars).length,0);
  bars.push({time:5,high:15,low:14,close:14.5});
  assert.equal(breaks(bars).length,1);
  assert.equal(breaks(bars)[0].to,4);
});
test('pivot requires all five right-side candles to close',()=>{
  const bars=candles([1,2,3,4,5,10,5,4,3,2,1,2]);
  assert.equal(marketStructure(bars.slice(0,11)).filter(l=>l.label==='SWING HIGH').length,0);
  assert.equal(marketStructure(bars).find(l=>l.label==='SWING HIGH').from,5);
});
test('confirmed historical breaks never depend on future candles',()=>{
  const all=breaks(sequence);
  for(let length=3;length<=sequence.length;length++) {
    assert.deepEqual(breaks(sequence.slice(0,length)),all.filter(l=>l.to<length-1));
  }
});
test('one broken level only emits once even if price stays beyond it',()=>{
  const result=breaks(candles([10,12,10,13,14,15,16]));
  assert.equal(result.length,1);assert.equal(result[0].from,1);
});
test('equal pivot plateaus resolve to the last equal swing',()=>{
  const result=marketStructure(candles([10,12,12,10,11]),1);
  assert.equal(result.find(l=>l.label==='SWING HIGH').from,2);
});
test('cache ignores forming-bar ticks but detects closed-bar corrections in place',()=>{
  const bars=candles([1,2,3,4,5,10,5,4,3,2,1,12,13]);
  const cache=new StructureCache();const first=cache.update(bars);
  assert.ok(first.some(l=>l.broken));
  assert.equal(cache.update(bars),first);
  bars.at(-1).close=99;assert.equal(cache.update(bars),first);
  bars[5].high=20;
  const corrected=cache.update(bars);
  assert.notEqual(corrected,first);assert.equal(corrected.some(l=>l.broken),false);
  assert.deepEqual(cache.update([]),[]);
});
test('moving the field clips candle-anchored levels without changing their identity',()=>{
  const level={x1:10,x2:200,y:80,label:'BOS',direction:1,broken:true};
  assert.deepEqual(structureInWindow([level],{x:50,y:50,width:100,height:100}),[{...level,x1:0,x2:100,y:30}]);
  assert.deepEqual(structureInWindow([level],{x:120,y:60,width:100,height:100}),[{...level,x1:0,x2:80,y:20}]);
  assert.deepEqual(structureInWindow([level],{x:250,y:50,width:100,height:100}),[]);
  assert.equal(level.x1,10);
  assert.equal(structureInWindow(Array.from({length:500},()=>level),{x:0,y:0,width:300,height:100}).length,48);
});
