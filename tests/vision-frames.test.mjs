import test from 'node:test';
import assert from 'node:assert/strict';
import { VisionFrames } from '../src/vision-frames.ts';
const pair=(pinched=true)=>[{id:'Left',x:.2,y:.25,pinched,claw:false},{id:'Right',x:.7,y:.8,pinched,claw:false}];
function activated() {
  const frames=new VisionFrames();
  frames.update(pair(false),100,'a',true);
  frames.update(pair(),150,'a',true);
  frames.update(pair(),300,'a',true);
  assert.equal(frames.following,true); return frames;
}
test('held pinches move the frame with both index tips',()=>{
  const frames=activated();
  const moved=pair().map(h=>({...h,x:h.x+.08,y:h.y-.1}));
  frames.update(moved,350,'a',true);
  const rect=frames.visible('a');
  assert.equal(frames.following,true);
  assert.ok(Math.abs(rect.x-.28)<1e-8);assert.ok(Math.abs(rect.y-.15)<1e-8);
  assert.ok(Math.abs(rect.width-.5)<1e-8);assert.ok(Math.abs(rect.height-.55)<1e-8);
});
test('held hands keep moving and resizing the frame in all directions',()=>{
  const frames=activated();
  for(const [i,dx,dy] of [[0,.05,-.1],[1,-.1,.05],[2,.1,.08]]) {
    frames.update(pair().map(h=>({...h,x:h.x+dx,y:h.y+dy})),350+i*50,'a',true);
    assert.ok(Math.abs(frames.visible('a').x-(.2+dx))<1e-8);
    assert.ok(Math.abs(frames.visible('a').y-(.25+dy))<1e-8);
  }
  frames.update([{...pair()[0],x:.1,y:.1},{...pair()[1],x:.9,y:.9}],550,'a',true);
  assert.ok(frames.visible('a').corners.some(p=>Math.hypot(p.x-.1,p.y-.1)<1e-8));
  assert.ok(frames.visible('a').corners.some(p=>Math.hypot(p.x-.9,p.y-.9)<1e-8));
});
test('brief pinches cannot activate a frame',()=>{
  const frames=new VisionFrames();
  frames.update(pair(false),100,'a',true);frames.update(pair(),150,'a',true);frames.update(pair(false),200,'a',true);
  assert.equal(frames.following,false);assert.equal(frames.visible('a'),null);
});
test('brief hand loss freezes the box and resumes with the same held pinches',()=>{
  const frames=activated();const before=frames.visible('a');
  frames.update([pair()[0]],350,'a',true);
  assert.equal(frames.recovering,true);assert.deepEqual(frames.visible('a'),before);
  frames.update(pair().map(h=>({...h,x:h.x+.05})),450,'a',true);
  assert.equal(frames.recovering,false);assert.equal(frames.following,true);
  assert.ok(Math.abs(frames.visible('a').x-.25)<1e-8);
});
test('a prolonged dropout cancels, and an open returning hand releases immediately',()=>{
  const frames=activated();frames.update([],350,'a',true);frames.update([],530,'a',true);
  assert.equal(frames.following,false);assert.equal(frames.visible('a'),null);
  const released=activated();released.update([],350,'a',true);released.update(pair(false),400,'a',true);
  assert.equal(released.following,false);assert.equal(released.visible('a'),null);
});
test('release of either pinch disconnects immediately and that hand can reconnect',()=>{
  for(const id of ['Left','Right']) {
    const frames=activated();
    frames.update(pair().map(h=>({...h,pinched:h.id!==id})),350,'a',true);
    assert.equal(frames.following,false);assert.equal(frames.visible('a'),null);
    frames.update(pair(),400,'a',true);assert.equal(frames.following,false);
    frames.update(pair(),480,'a',true);assert.equal(frames.following,true);
  }
});
test('fists, mode changes, context changes and stale tracking dismiss the frame',()=>{
  for(const run of [f=>f.update(pair(),350,'a',true,.025,.025,true),f=>f.update(pair(),350,'a',false),f=>f.update(pair(),350,'b',true),f=>f.update(pair(),700,'a',true)]) {
    const frames=activated();run(frames);assert.equal(frames.visible('a'),null);assert.equal(frames.following,false);
  }
  const frames=activated();
  for(const t of [350,500,650]) frames.update([],t,'a',true);
  assert.equal(frames.following,false);
});
test('tiny and crossed frames stay bounded and can expand again without another pinch',()=>{
  const frames=activated();frames.update(pair().map(h=>({...h,x:.5,y:.5})),350,'a',true);
  assert.equal(frames.visible('a'),null);assert.equal(frames.following,true);
  const hands=pair();hands[0]={...hands[0],x:1.2,y:.9};hands[1]={...hands[1],x:-.2,y:.1};
  frames.update(hands,400,'a',true);
  assert.equal(frames.visible('a').x,0);assert.equal(frames.visible('a').width,1);
});
test('clear requires a fresh open-and-pinch cycle and leaves no saved frame',()=>{
  const frames=activated();frames.clear();
  for(const t of [350,500,650]) frames.update(pair(),t,'a',true);
  assert.equal(frames.following,false);assert.equal(frames.visible('a'),null);
  frames.update(pair(false),700,'a',true);frames.update(pair(),750,'a',true);frames.update(pair(),900,'a',true);
  assert.equal(frames.following,true);
});

test('after clear each hand can reopen and pinch independently, with an 80ms joint hold',()=>{
  const frames=activated();frames.clear();
  const leftOpen=[{...pair()[0],pinched:false},pair()[1]];
  const rightOpen=[pair()[0],{...pair()[1],pinched:false}];
  frames.update(leftOpen,350,'a',true);
  frames.update(rightOpen,400,'a',true);
  frames.update(pair(),450,'a',true);
  frames.update(pair(),529,'a',true);assert.equal(frames.following,false);
  frames.update(pair(),530,'a',true);assert.equal(frames.following,true);
});

test('a visible release cancels even while the other hand is missing',()=>{
  const frames=activated();frames.update([pair()[0]],350,'a',true);
  assert.equal(frames.recovering,true);
  frames.update([{...pair()[0],pinched:false}],400,'a',true);
  assert.equal(frames.following,false);assert.equal(frames.visible('a'),null);
});

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('rotating the held fingertips rotates a true rectangle on a widescreen chart',()=>{
  const frames=new VisionFrames(),aspect=2;
  const initial=[{...pair()[0],x:.35,y:.35},{...pair()[1],x:.65,y:.65}];
  const update=(hands,t)=>frames.update(hands,t,'a',true,.012,.024,false,aspect);
  update(initial,100);update(initial,200);
  const before=frames.visible('a').corners;
  const rotate=p=>({x:(1-(p.y-.5))/aspect,y:.5+(p.x*aspect-1)});
  const turned=initial.map(p=>({...p,...rotate(p)}));
  update(turned,250);
  const after=frames.visible('a').corners;
  before.forEach((p,i)=>{near(after[i].x,rotate(p).x);near(after[i].y,rotate(p).y);});
  const edges=after.map((p,i)=>({x:(after[(i+1)%4].x-p.x)*aspect,y:after[(i+1)%4].y-p.y}));
  near(edges[0].x*edges[1].x+edges[0].y*edges[1].y,0);
  for(const hand of turned) assert.ok(after.some(p=>Math.hypot(p.x-hand.x,p.y-hand.y)<1e-8));
  // Detector result ordering cannot flip the rectangle.
  update([...turned].reverse(),300);assert.deepEqual(frames.visible('a').corners,after);
});
test('a horizontal grip can activate, pass through vertical, and scale without flattening',()=>{
  const frames=new VisionFrames();
  const initial=[{...pair()[0],x:.3,y:.5},{...pair()[1],x:.7,y:.5}];
  frames.update(initial,100,'a',true);frames.update(initial,200,'a',true);
  assert.ok(frames.visible('a').height>.1);
  for(const [i,angle] of [Math.PI/2,Math.PI-.01,Math.PI+.01,Math.PI*1.5].entries()) {
    const hands=initial.map((h,j)=>({...h,x:.5+(j?1:-1)*.3*Math.cos(angle),y:.5+(j?1:-1)*.3*Math.sin(angle)}));
    frames.update(hands,250+i*50,'a',true);
    const rect=frames.visible('a');assert.ok(rect && frames.following);
    for(const hand of hands) assert.ok(rect.corners.some(p=>Math.hypot(p.x-hand.x,p.y-hand.y)<1e-8));
  }
});
