import test from 'node:test';
import assert from 'node:assert/strict';
import {insideField,fieldHorizontalSpan} from '../src/vision-field-geometry.ts';
import {energyNodes} from '../src/vision-energy.ts';
import {structureInWindow} from '../src/market-structure.ts';
const diamond={x:10,y:20,width:100,height:100,corners:[{x:60,y:20},{x:110,y:70},{x:60,y:120},{x:10,y:70}]};
test('rotated field excludes candles in its bounding corners and keeps interior candles',()=>{
  assert.equal(insideField({x:20,y:30},diamond),false);
  assert.equal(insideField({x:60,y:70},diamond),true);
  assert.equal(insideField({x:60,y:20},diamond),true);
  assert.equal(insideField({x:60,y:70},{...diamond,corners:[...diamond.corners].reverse()}),true);
  const nodes=[{x:20,y:30,high:25,low:35,up:true},{x:60,y:70,high:65,low:75,up:true}];
  assert.deepEqual(energyNodes(nodes,diamond),[{x:50,y:50,high:45,low:55,up:true}]);
});
test('horizontal market structure lines clip to angled edges without rotating the level',()=>{
  assert.deepEqual(fieldHorizontalSpan(diamond,45),[35,85]);
  assert.deepEqual(fieldHorizontalSpan(diamond,70),[10,110]);
  assert.equal(fieldHorizontalSpan(diamond,121),null);
  const level={x1:0,x2:150,y:45,label:'BOS',direction:1,broken:true};
  assert.deepEqual(structureInWindow([level],diamond),[{...level,x1:25,x2:75,y:25}]);
  assert.deepEqual(structureInWindow([{...level,x2:30}],diamond),[]);
});
test('clipping remains constrained to the chart even with corners outside it',()=>{
  const clipped={...diamond,x:40,y:40,width:40,height:50};
  assert.deepEqual(fieldHorizontalSpan(clipped,70),[40,80]);
  assert.equal(insideField({x:30,y:70},clipped),false);
});
