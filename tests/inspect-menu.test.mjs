import test from 'node:test';
import assert from 'node:assert/strict';
import { VisionModes } from '../src/vision-modes.ts';
const hand=(id,y,pinched=false)=>({id,palm:{x:.5,y},pinched,wheelPalm:false,swipePose:false});
test('Inspect requires a second fresh tap, including while the first pinch stays held',()=>{
  for(const id of ['Left','Right']) {
    const m=new VisionModes();m.open({x:.5,y:.5},id);
    m.menu.selection='drawing';
    m.update([hand(id,.7,true)],100);m.update([hand(id,.7,true)],180);
    assert.equal(m.menu.stage,'concept');assert.equal(m.mode,'charting');
    for(let t=220;t<=500;t+=40) m.update([hand(id,.7,true)],t);
    assert.equal(m.menu.stage,'concept');assert.equal(m.confirmation,null);
    m.update([hand(id,.7)],540);
    assert.equal(m.menu.startY,.7);
    m.update([hand(id,.88)],600);
    assert.equal(m.menu.selection,'fair-value-gap');
    m.update([hand(id,.88,true)],650);m.update([hand(id,.88)],700);
    assert.equal(m.mode,'drawing');assert.equal(m.concept,'fair-value-gap');assert.equal(m.menu,null);
  }
});
test('mouse/keyboard flow selects both concepts and returns to Navigate',()=>{
  const m=new VisionModes();
  for(const concept of ['fair-value-gap','structure']) {
    m.open({x:.5,y:.5});m.select('drawing');
    assert.deepEqual(m.choices,['structure','fair-value-gap']);
    m.select(concept);assert.equal(m.concept,concept);assert.equal(m.mode,'drawing');
  }
  m.open({x:.5,y:.5});m.select('charting');assert.equal(m.mode,'charting');assert.equal(m.paused,false);
});
test('Back, cancel, loss and stale frames preserve the previously active concept',()=>{
  for(const cancel of [m=>m.cancel(),m=>m.update([],100),m=>{m.update([hand('Left',.5)],100);m.update([hand('Left',.5)],500);}]) {
    const m=new VisionModes();m.open({x:.5,y:.5},'Left');m.select('drawing');m.select('fair-value-gap');
    m.open({x:.5,y:.5},'Left');m.select('drawing');m.menu.selection='structure';
    cancel(m);assert.equal(m.concept,'fair-value-gap');assert.equal(m.mode,'drawing');assert.equal(m.menu,null);
  }
  const m=new VisionModes();m.open({x:.5,y:.5},'Left');m.select('drawing');m.back();
  assert.equal(m.menu.stage,'mode');assert.equal(m.menu.tapArmed,false);assert.equal(m.mode,'charting');
});
test('only the menu owner can confirm a concept and wrong-stage choices are ignored',()=>{
  const m=new VisionModes();m.open({x:.5,y:.5},'Left');m.select('fair-value-gap');assert.equal(m.menu.stage,'mode');
  m.select('drawing');m.update([hand('Left',.5)],100);
  m.update([hand('Left',.5),hand('Right',.5,true)],150);
  m.update([hand('Left',.5),hand('Right',.5,true)],240);
  assert.equal(m.menu.stage,'concept');assert.equal(m.mode,'charting');
});
