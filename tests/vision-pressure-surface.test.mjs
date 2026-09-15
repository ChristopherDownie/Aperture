import test from 'node:test';
import assert from 'node:assert/strict';
import {pressureSurface,pressureColor,surfaceContours} from '../src/vision-pressure-surface.ts';
const rect={x:0,y:0,width:100,height:100};
const candle=(x,y,close,volume=100)=>({x,top:y-3,bottom:y+3,high:10,low:0,close,volume});
test('surface remains bounded and represents both pressure directions',()=>{
  const surface=pressureSurface([candle(30,40,10),candle(70,60,0)],rect);
  assert.equal(surface.values.length,96*40);
  const valid=[...surface.values].filter(Number.isFinite);
  assert.ok(Math.max(...valid)>.9);assert.ok(Math.min(...valid)<-.9);
  assert.ok(valid.every(v=>v>=-1&&v<=1));
  assert.ok(surface.coverage.every(v=>v>=0&&v<=1));
});
test('empty and missing-volume regions do not invent pressure contours',()=>{
  const empty=pressureSurface([{...candle(50,50,10),volume:undefined}],rect);
  assert.ok(empty.coverage.every(v=>v===0));assert.equal(surfaceContours(empty,0).length,0);
  const one=pressureSurface([candle(50,50,10)],rect);
  assert.ok(Number.isNaN(one.values[0]));
});
test('overlapping estimates blend by volume and flat candles stay neutral',()=>{
  const surface=pressureSurface([candle(50,50,10,100),candle(50,50,0,300)],rect);
  assert.ok([...surface.values].filter(Number.isFinite).every(v=>Math.abs(v+.5)<1e-6));
  const flat=pressureSurface([{...candle(50,50,5),high:5,low:5}],rect);
  assert.ok([...flat.values].filter(Number.isFinite).every(v=>v===0));
});
test('bilinear deposition changes smoothly under sub-cell movements',()=>{
  const a=pressureSurface([candle(40,45,10),candle(55,55,0)],rect);
  const b=pressureSurface([candle(40.01,45,10),candle(55.01,55,0)],rect);
  const diffs=[...a.values].flatMap((v,i)=>Number.isFinite(v)&&Number.isFinite(b.values[i])?[Math.abs(v*a.coverage[i]-b.values[i]*b.coverage[i])]:[]);
  assert.ok(Math.max(...diffs)<.02);
});
test('contours interpolate level crossings and do not cross missing data',()=>{
  const simple={width:2,height:2,values:new Float32Array([-1,1,-1,1]),coverage:new Float32Array([1,1,1,1])};
  assert.deepEqual(surfaceContours(simple,0),[[.5,0,.5,1]]);
  simple.values[0]=NaN;assert.deepEqual(surfaceContours(simple,0),[]);
  assert.deepEqual(pressureColor(-1),[19,7,46]);assert.deepEqual(pressureColor(1),[204,29,43]);
});
test('saddle contour topology is symmetric when pressure signs invert',()=>{
  const surface={width:2,height:2,values:new Float32Array([-1,1,1,-.2]),coverage:new Float32Array([1,1,1,1])};
  const normalize=segments=>segments.map(([a,b,c,d])=>[[a,b],[c,d]].map(p=>p.map(v=>v.toFixed(6)).join(',')).sort().join(':')).sort();
  const inverted={...surface,values:surface.values.map(v=>-v)};
  assert.deepEqual(normalize(surfaceContours(surface,0)),normalize(surfaceContours(inverted,0)));
});
