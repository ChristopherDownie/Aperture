import test from 'node:test';
import assert from 'node:assert/strict';
import {candlePressure,pressureHeatmap} from '../src/vision-pressure.ts';
const rect={x:0,y:0,width:240,height:100};
const bar=(x,close=8,volume=100)=>({x,top:20,bottom:80,high:10,low:0,close,volume});
test('pressure estimate uses closing position and stays within total volume',()=>{
  assert.deepEqual(candlePressure(bar(0,10)),{volume:100,delta:100});
  assert.deepEqual(candlePressure(bar(0,0)),{volume:100,delta:-100});
  assert.deepEqual(candlePressure(bar(0,5)),{volume:100,delta:0});
  assert.deepEqual(candlePressure({...bar(0),high:5,low:5,close:5}),{volume:100,delta:0});
  assert.deepEqual(candlePressure(bar(0,20)),{volume:100,delta:100});
});
test('aggregate bias is volume weighted, not an average of candle directions',()=>{
  const result=pressureHeatmap([bar(10,10,100),bar(20,0,300)],rect);
  assert.equal(result.volume,400);assert.equal(result.delta,-200);assert.equal(result.bias,-.5);
  assert.equal(result.count,2);assert.equal(result.missing,0);
  assert.equal(result.cells.reduce((sum,c)=>sum+c.delta,0),-200);
});
test('missing and invalid volume are excluded instead of treated as a neutral signal',()=>{
  const bars=[bar(10),{...bar(20),volume:undefined},bar(30,8,NaN),bar(40,8,-1),bar(50,8,0)];
  const result=pressureHeatmap(bars,rect);
  assert.equal(result.count,5);assert.equal(result.missing,3);assert.equal(result.volume,100);assert.equal(result.bias,.6);
  assert.equal(candlePressure({...bar(0),low:20}),null);
  assert.equal(candlePressure({...bar(0),close:NaN}),null);
});
test('rotated window selects intersecting wicks, excluding empty bounding corners',()=>{
  const diamond={x:0,y:0,width:100,height:100,corners:[{x:50,y:0},{x:100,y:50},{x:50,y:100},{x:0,y:50}]};
  const result=pressureHeatmap([{...bar(10),top:0,bottom:10},{...bar(50),top:95,bottom:110},{...bar(90),top:55,bottom:70}],diamond);
  assert.equal(result.count,2);assert.equal(result.volume,200);
  assert.equal(pressureHeatmap([bar(200)],diamond).count,0);
});
test('dense selections keep every candle volume with only 24 heat cells',()=>{
  const result=pressureHeatmap(Array.from({length:10000},(_,i)=>bar(i/10000*240,10,1)),rect);
  assert.equal(result.count,10000);assert.equal(result.volume,10000);assert.equal(result.cells.length,24);
  assert.equal(result.cells.reduce((sum,c)=>sum+c.count,0),10000);
  assert.equal(result.bias,1);
});
test('empty, zero-volume and forming-bar selections retain distinct states',()=>{
  assert.equal(pressureHeatmap([],rect).count,0);
  const zero=pressureHeatmap([bar(10,5,0)],rect);assert.equal(zero.count,1);assert.equal(zero.missing,0);assert.equal(zero.volume,0);
  const live=pressureHeatmap([{...bar(10),forming:true}],rect);assert.equal(live.forming,true);
  const moved=pressureHeatmap([{...bar(10),forming:true}],{...rect,x:100});assert.equal(moved.count,0);assert.equal(moved.forming,false);
});
