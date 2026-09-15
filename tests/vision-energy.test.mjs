import test from 'node:test';
import assert from 'node:assert/strict';
import { energyNodes } from '../src/vision-energy.ts';
test('energy selects real candle anchors inside the window and translates them locally',()=>{
  const nodes=[{x:90,y:120,high:100,low:140,up:true},{x:150,y:120,high:90,low:150,up:false},{x:180,y:250,high:200,low:270,up:true}];
  assert.deepEqual(energyNodes(nodes,{x:100,y:100,width:100,height:100}),[{x:50,y:20,high:-10,low:50,up:false}]);
  assert.deepEqual(energyNodes(nodes,{x:300,y:300,width:100,height:100}),[]);
  assert.equal(nodes[1].x,150);
});

test('clearing an energy window cancels its pending animation and clears the canvas',async()=>{
  const {VisionEnergy}=await import('../src/vision-energy.ts');
  const previous={matchMedia:globalThis.matchMedia,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  let cancelled=null,cleared=0;
  try {
    globalThis.matchMedia=()=>({matches:false});
    globalThis.requestAnimationFrame=()=>42;
    globalThis.cancelAnimationFrame=id=>{cancelled=id;};
    const canvas={width:100,height:100,getContext:()=>({clearRect:()=>cleared++})};
    const energy=new VisionEnergy(canvas,()=>[]);
    energy.update({x:0,y:0,width:100,height:100});
    energy.update(null);
    assert.equal(cancelled,42);assert.equal(cleared,1);
  } finally { Object.assign(globalThis,previous); }
});

test('dense candle windows have a bounded effect budget covering the entire selection',()=>{
  const nodes=Array.from({length:10000},(_,x)=>({x,y:20,high:10,low:30,up:true}));
  const selected=energyNodes(nodes,{x:0,y:0,width:10000,height:100});
  assert.equal(selected.length,72);assert.equal(selected[0].x,0);assert.equal(selected.at(-1).x,9999);
});
test('full-screen Retina effects never allocate more than one million pixels',async()=>{
  const {energySurface}=await import('../src/vision-energy.ts');
  for(const [w,h] of [[24,24],[400,300],[1920,1080],[3840,2160],[8000,4000]]) for(const dpr of [1,2,3]) {
    const surface=energySurface(w,h,dpr);
    assert.ok(surface.width*surface.height<=1_000_000);
    assert.ok(surface.width>0 && surface.height>0);
  }
  assert.deepEqual(energySurface(401,301,2),energySurface(402,302,2));
});
