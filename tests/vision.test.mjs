import test from 'node:test';
import assert from 'node:assert/strict';
import { VisionModes } from '../src/vision-modes.ts';
import { VisionGestures } from '../src/vision-gestures.ts';

const range = { from: 1000, to: 11000 };
function hand(id, x, pinch = false, fist = false) {
  const cameraX = 1 - x;
  const points = Array.from({length:21}, () => ({x:cameraX, y:0.65}));
  points[0] = {x:cameraX, y:0.8};
  points[5] = {x:cameraX - .05, y:.65};
  points[17] = {x:cameraX + .05, y:.65};
  points[8] = {x:cameraX, y:.5};
  points[4] = {x:cameraX + (pinch ? .015 : .12), y:.5};
  for (const tip of [12,16,20]) {
    points[tip] = {x:cameraX, y:fist ? .7 : .45};
    points[tip-2] = {x:cameraX, y:.65};
  }
  return {id,points};
}
const pair = (a=.3,b=.7,pinch=true) => [hand('Left',a,pinch),hand('Right',b,pinch)];
function engage() {
  const engine=new VisionGestures();
  engine.update(pair(.3,.7,false),100,range);
  engine.update(pair(),150,range);
  engine.update(pair(),220,range);
  const result=engine.update(pair(),290,range);
  assert.equal(result.zooming,true);
  return engine;
}
test('starting with closed pinches cannot accidentally engage zoom',()=>{
  const engine=new VisionGestures();
  for(let t=100;t<800;t+=50) assert.equal(engine.update(pair(),t,range).zooming,false);
});
test('two deliberate pinches need a short dwell; stationary hands do not change range',()=>{
  const engine=new VisionGestures();
  engine.update(pair(.3,.7,false),100,range);
  assert.equal(engine.update(pair(),150,range).zooming,false);
  assert.equal(engine.update(pair(),220,range).zooming,false);
  const held=engine.update(pair(),290,range);
  assert.equal(held.zooming,true); assert.equal(held.zoom,null);
});
test('apart zooms in, together zooms out, and the original anchor stays fixed',()=>{
  const engine=engage();
  const wide=engine.update(pair(.2,.8),340,range);
  assert.ok(wide.zoom.to-wide.zoom.from<10000);
  assert.ok(Math.abs((wide.zoom.from+wide.zoom.to)/2-6000)<1e-7);
  const close=engine.update(pair(.38,.62),400,range);
  assert.ok(close.zoom.to-close.zoom.from>10000);
  assert.ok(Math.abs((close.zoom.from+close.zoom.to)/2-6000)<1e-7);
});
test('releasing either pinch stops immediately',()=>{
  const engine=engage();
  const result=engine.update([hand('Left',.3,false),hand('Right',.7,true)],340,range);
  assert.equal(result.zooming,false); assert.equal(result.zoom,null);
});
test('lost hands hide immediately and must reopen before another zoom',()=>{
  const engine=engage();
  const lost=engine.update([],340,range);
  assert.equal(lost.hands.length,0); assert.equal(lost.zooming,false);
  assert.equal(engine.update(pair(),390,range).zooming,false);
});
test('stale frames reset the grab; a fist cannot pinch; no range cannot zoom',()=>{
  assert.equal(engage().update(pair(),900,range).zooming,false);
  const engine=new VisionGestures();
  engine.update(pair(.3,.7,false),100,range);
  const fists=engine.update([hand('Left',.3,true,true),hand('Right',.7,true,true)],340,range);
  assert.equal(fists.zooming,false);
  assert.equal(engage().update(pair(),340,null).zooming,false);
});
test('pointer mirrors camera coordinates and rejects malformed landmarks',()=>{
  const engine=new VisionGestures();
  const result=engine.update([hand('Left',.25)],100,range);
  assert.equal(result.hands[0].x,.25);
  const bad=hand('Left',.25);bad.points[8].x=NaN;
  assert.equal(engine.update([bad],150,range).hands.length,0);
});
test('zoom target remains at an off-center grab position',()=>{
  const engine=new VisionGestures();
  engine.update(pair(.2,.5,false),100,range);
  engine.update(pair(.2,.5),150,range);
  engine.update(pair(.2,.5),290,range);
  const result=engine.update(pair(.1,.6),340,range);
  const anchor=result.zoom.from+.35*(result.zoom.to-result.zoom.from);
  assert.ok(Math.abs(anchor-4500)<1e-7);
});

// Reconstructed poses exercise orientation/scale mathematically; they are not
// a substitute for accuracy measurements from a person's webcam.
function worldHand(id, x, gap, angle = 0, scale = 1) {
  const h = hand(id, x, true);
  const points = h.points.map(p => ({x: (p.x - (1-x)) * .5, y: (p.y-.65)*.5, z:0}));
  points[4] = {...points[8], x: points[8].x + gap * .075};
  for(const tip of [8,12,16,20]) for(const [index,f] of [[tip-2,.45],[tip-1,.7]]) {
    points[index]={x:points[tip-3].x+(points[tip].x-points[tip-3].x)*f,y:points[tip-3].y+(points[tip].y-points[tip-3].y)*f,z:0};
  }
  h.worldPoints = points.map(p => ({
    x: scale*(p.x*Math.cos(angle) + p.z*Math.sin(angle)),
    y: scale*p.y,
    z: scale*(-p.x*Math.sin(angle) + p.z*Math.cos(angle)),
  }));
  // Projecting an edge-on hand makes the old 2D palm-width rule unreliable.
  h.points = h.points.map(p => ({...p, x: 1-x+(p.x-(1-x))*Math.cos(angle)}));
  return h;
}
test('3D pinch recognition tolerates hand rotation and hand size',()=>{
  for (const angle of [0, Math.PI/3, Math.PI/2]) for (const scale of [.65,1,1.4]) {
    const engine = new VisionGestures();
    const pose = gap => [worldHand('Left',.3,gap,angle,scale), worldHand('Right',.7,gap,angle,scale)];
    engine.update(pose(1),100,range);
    engine.update(pose(.4),150,range);
    const held = engine.update(pose(.4),290,range);
    assert.equal(held.zooming,true);
    assert.equal(engine.update(pose(.9),340,range).zooming,false);
  }
});
test('relaxing spare fingers during an established pinch does not release it',()=>{
  const result=engage().update([hand('Left',.3,true,true),hand('Right',.7,true,true)],340,range);
  assert.equal(result.zooming,true);
});
test('pinch threshold noise does not repeatedly release and reengage a hold',()=>{
  const engine = new VisionGestures();
  const pose = gap => [worldHand('Left',.3,gap),worldHand('Right',.7,gap)];
  engine.update(pose(1),100,range);
  engine.update(pose(.4),150,range);
  assert.equal(engine.update(pose(.4),290,range).zooming,true);
  for (const [i,gap] of [.48,.56,.44,.62,.5].entries()) {
    assert.equal(engine.update(pose(gap),340+i*50,range).zooming,true);
  }
  assert.equal(engine.update(pose(.8),600,range).zooming,false);
});
test('invalid world landmarks fall back to image coordinates without stuck gestures',()=>{
  const engine=new VisionGestures();
  const observations=pair(.3,.7,false).map(h=>({...h,worldPoints:[{x:NaN,y:0,z:0}]}));
  assert.equal(engine.update(observations,100,range).hands.length,2);
  engine.update(pair(),150,range);
  assert.equal(engine.update(pair(),290,range).zooming,true);
  assert.equal(engine.update([],340,range).zooming,false);
});

const swipeHand = (x=.5, angle=Math.PI/3) => worldHand('Left',x,1,angle);
function readySwipe() {
  const engine=new VisionGestures();
  engine.update([swipeHand()],100,range);
  engine.update([swipeHand()],200,range);
  engine.update([swipeHand()],300,range);
  return engine;
}
test('an upright angled swipe moves candles with the hand without changing zoom',()=>{
  for (const x of [.35,.65]) {
    const result=readySwipe().update([swipeHand(x)],350,range);
    assert.equal(result.panning,true);
    assert.equal(result.zoom,null);
    assert.ok(Math.abs(result.pan.to-result.pan.from-10000)<1e-7);
    assert.equal(result.pan.from<range.from,x>.5);
  }
});
test('flat palms, unmeasured poses, entry movement, and stationary jitter do not scroll',()=>{
  for (const pose of [()=>swipeHand(.5,0),()=>hand('Left',.5,false)]) {
    const engine=new VisionGestures();
    for(let t=100;t<=400;t+=50) assert.equal(engine.update([pose()],t,range).pan,null);
  }
  const engine=new VisionGestures();
  engine.update([swipeHand(.4)],100,range);
  assert.equal(engine.update([swipeHand(.5)],200,range).pan,null);
  const still=readySwipe();
  for(let t=350;t<=650;t+=50) assert.equal(still.update([swipeHand(.5+(t%100 ? .004 : -.004))],t,range).pan,null);
});
test('vertical movement does not initiate a horizontal swipe',()=>{
  const engine=readySwipe();
  const observation=swipeHand();
  observation.points=observation.points.map(p=>({...p,y:p.y-.15}));
  assert.equal(engine.update([observation],350,range).panning,false);
});
test('turning palm forward, pinching, losing tracking, or adding another hand stops scroll',()=>{
  for (const observations of [[],[swipeHand(.65,0)],[worldHand('Left',.65,.2,Math.PI/3)],pair(.3,.7,false)]) {
    const engine=readySwipe();
    assert.equal(engine.update([swipeHand(.65)],350,range).panning,true);
    const stopped=engine.update(observations,400,range);
    assert.equal(stopped.panning,false);
    assert.equal(stopped.pan,null);
  }
  const engine=readySwipe();
  engine.update([swipeHand(.65)],350,range);
  assert.equal(engine.update([swipeHand(.65)],700,range).pan,null);
});
test('swipe reentry anchors to the current viewport without jumping',()=>{
  const engine=readySwipe();
  const first=engine.update([swipeHand(.65)],350,range);
  engine.update([],400,first.pan);
  for(const t of [450,550,650]) assert.equal(engine.update([swipeHand(.35)],t,first.pan).pan,null);
  const again=engine.update([swipeHand(.45)],700,first.pan);
  assert.ok(again.pan.from<first.pan.from);
  assert.ok(Math.abs(again.pan.to-again.pan.from-10000)<1e-7);
});
test('pinch zoom takes priority and never returns a simultaneous scroll',()=>{
  const engine=readySwipe();
  engine.update([swipeHand(.65)],350,range);
  engine.update(pair(.3,.7,false),400,range);
  engine.update(pair(),450,range);
  const zoom=engine.update(pair(),600,range);
  assert.equal(zoom.zooming,true);
  assert.equal(zoom.panning,false);
  assert.equal(zoom.pan,null);
});

function closedFist(id='Right', x=.7) {
  const h=hand(id,x,true,true);
  h.points[8]={x:1-x,y:.71};
  h.points[4]={x:1-x+.015,y:.72};
  return h;
}
test('a visible fist removes only its pointer and permits the other hand to swipe',()=>{
  const engine=new VisionGestures();
  for(const t of [100,200,300]) {
    const result=engine.update([swipeHand(),closedFist()],t,range);
    assert.deepEqual(result.hands.map(h=>h.id),['Left']);
    assert.deepEqual(result.inactiveHands,['Right']);
  }
  const result=engine.update([swipeHand(.65),closedFist()],350,range);
  assert.equal(result.panning,true);
  assert.equal(result.zooming,false);
});
test('a fist immediately cancels zoom even when it was holding a pinch',()=>{
  const result=engage().update([hand('Left',.3,true),closedFist()],340,range);
  assert.equal(result.zooming,false);
  assert.equal(result.zoom,null);
  assert.equal(result.hands.length,1);
  assert.deepEqual(result.inactiveHands,['Right']);
});
test('two fists deactivate both pointers and reopening restores only that hand',()=>{
  const engine=engage();
  const closed=engine.update([closedFist('Left',.3),closedFist()],340,range);
  assert.equal(closed.hands.length,0);
  assert.equal(closed.panning,false);
  assert.equal(closed.zooming,false);
  const reopened=engine.update([hand('Left',.3,false),closedFist()],390,range);
  assert.deepEqual(reopened.hands.map(h=>h.id),['Left']);
  assert.equal(reopened.hands[0].armed,true);
  assert.deepEqual(reopened.inactiveHands,['Right']);
});
test('fist hysteresis rejects marginal finger jitter and resets after tracking loss',()=>{
  const engine=new VisionGestures();
  engine.update([closedFist()],100,range);
  const noisy=closedFist(); noisy.points[8]={x:.3,y:.636};
  assert.equal(engine.update([noisy],150,range).hands.length,0);
  assert.deepEqual(engine.update([],200,range).inactiveHands,[]);
  assert.equal(engine.update([hand('Right',.7,false)],250,range).hands.length,1);
});
test('opening a fist interrupts single-hand scrolling and restores two-hand control',()=>{
  const engine=new VisionGestures();
  for(const t of [100,200,300]) engine.update([swipeHand(),closedFist()],t,range);
  assert.equal(engine.update([swipeHand(.65),closedFist()],350,range).panning,true);
  const result=engine.update([swipeHand(.65),hand('Right',.8,false)],400,range);
  assert.equal(result.hands.length,2);
  assert.equal(result.panning,false);
  assert.equal(result.pan,null);
});

function clawObservation(x=.5) {
  const h=hand('Left',x,false);
  const w=Array.from({length:21},()=>({x:0,y:0,z:0}));
  w[0]={x:0,y:.08,z:0}; w[4]={x:-.09,y:-.015,z:0};
  for(const [i,tip] of [8,12,16,20].entries()) {
    const x=-.03+i*.02;
    w[tip-3]={x,y:0,z:0}; w[tip-2]={x,y:-.05,z:0};
    w[tip-1]={x,y:-.05,z:.025}; w[tip]={x,y:-.05,z:.05};
  }
  h.worldPoints=w; return h;
}
test('a roomy bent-finger claw is distinct from an open palm, pinch, and fist',()=>{
  const engine=new VisionGestures();
  const claw=engine.update([clawObservation()],100,range);
  assert.equal(claw.hands[0].claw,true);
  assert.equal(claw.hands[0].pinched,false);
  assert.equal(claw.hands[0].swipePose,false);
  assert.deepEqual(claw.inactiveHands,[]);
  assert.equal(engine.update([worldHand('Left',.5,1)],150,range).hands[0].claw,false);
  assert.equal(engine.update([worldHand('Left',.5,.2)],200,range).hands[0].claw,false);
  assert.equal(engine.update([closedFist('Left',.5)],250,range).hands.length,0);
});
const modeHand=(offsetY=0,claw=true)=>({id:'Left',palm:{x:.5,y:.5+offsetY},knobAngle:0,claw,pinched:false,openPalm:!claw,palmFacing:true,wheelPalm:!claw,swipePose:false,modeRelease:!claw});
function assertInspectPicker(modes) {
  assert.equal(modes.mode,'charting');
  assert.equal(modes.menu?.stage,'concept');
  assert.equal(modes.menu.selection,'structure');
}
function openModeMenu() {
  const modes=new VisionModes();
  modes.update([modeHand(0,false)],500);
  modes.open({x:.5,y:.5},'Left');
  return modes;
}
test('one thumb-index tap opens Inspect choices after downward swipe',()=>{
  const modes=openModeMenu();
  modes.update([modeHand(0.18)],550);
  assert.equal(modes.menu.selection,'drawing');
  assert.equal(modes.mode,'charting');
  assert.equal(modes.paused,true);
  modes.update([{...modeHand(0.18,false),pinched:true}],600);
  modes.update([modeHand(0.18,false)],750);
  assertInspectPicker(modes);
  assert.equal(modes.paused,true);
});
test('menu can return to Charting and resume controls',()=>{
  const modes=openModeMenu(); modes.choose('drawing');
  holdPalm(modes,600);
  modes.update([modeHand(-0.18)],2150);
  modes.update([{...modeHand(-0.18,false),pinched:true}],2200);
  modes.update([modeHand(-0.18,false)],2300);
  assert.equal(modes.mode,'charting'); assert.equal(modes.paused,false);
});
test('fist or tracking loss cancels mode selection without changing the mode',()=>{
  const modes=openModeMenu(); modes.update([modeHand(0.18)],550);
  modes.update([],600);
  assert.equal(modes.menu,null); assert.equal(modes.mode,'charting');
  const stale=openModeMenu(); stale.update([modeHand(0.18)],900);
  assert.equal(stale.menu,null);
});
test('opening the hand alone leaves the menu open without choosing',()=>{
  const modes=openModeMenu();
  modes.update([modeHand(0.18)],550);
  for(const t of [600,750,900]) modes.update([modeHand(0.18,false)],t);
  assert.equal(modes.mode,'charting'); assert.ok(modes.menu);
});

test('palm-facing claws work while edge-on claws are rejected',()=>{
  const front=clawObservation();
  const edge=clawObservation();
  edge.worldPoints=edge.worldPoints.map(p=>({x:p.z,y:p.y,z:-p.x}));
  assert.equal(new VisionGestures().update([front],100,range).hands[0].claw,true);
  assert.equal(new VisionGestures().update([edge],100,range).hands[0].claw,false);
});
test('horizontal motion cannot select a mode; vertical motion can',()=>{
  const modes=openModeMenu();
  modes.update([{...modeHand(),palm:{x:.8,y:.5}}],550);
  assert.equal(modes.menu.selection,'charting');
  modes.update([modeHand(0.24)],650);
  assert.equal(modes.menu.selection,'drawing');
});
test('wrist rotation alone cannot move the menu highlight',()=>{
  const modes=openModeMenu();
  for(const [i,knobAngle] of [-3.08,-2.6,.6].entries()) modes.update([{...modeHand(),knobAngle}],550+i*50);
  assert.equal(modes.menu.selection,'charting');
});
test('a small vertical tremor stays inside the neutral zone',()=>{
  const modes=openModeMenu();
  for(const [i,angle] of [.016,-.02,.014,-.015].entries()) modes.update([modeHand(angle)],550+i*50);
  assert.equal(modes.menu.selection,'charting');
});

test('an open menu follows vertical movement even when the opening pose relaxes',()=>{
  const modes=openModeMenu();
  modes.update([{...modeHand(0.12),claw:false,openPalm:false,modeRelease:false}],550);
  assert.equal(modes.menu.selection,'drawing');
  assert.ok(modes.menu.offsetY>.065);
  modes.update([{...modeHand(-0.18),claw:false,openPalm:true,modeRelease:false}],650);
  assert.equal(modes.menu.selection,'charting');
});
test('the tap captures the highlighted choice despite hand movement during contact',()=>{
  const modes=openModeMenu();modes.update([modeHand(0.12)],550);
  modes.update([{...modeHand(-0.18,false),pinched:true}],600);
  assert.equal(modes.menu.tap.mode,'drawing');
  modes.update([modeHand(-0.18,false)],700);
  assertInspectPicker(modes);
});
test('a stable contact confirms after 80ms without waiting for release',()=>{
  const modes=openModeMenu();modes.update([modeHand(0.12)],550);
  modes.update([{...modeHand(0.12,false),pinched:true}],600);
  modes.update([{...modeHand(0.12,false),pinched:true}],679);
  assert.ok(modes.menu);assert.equal(modes.mode,'charting');
  modes.update([{...modeHand(-0.12,false),pinched:true}],680);
  assertInspectPicker(modes);
  assert.equal(modes.confirmation,null);
  for(let t=730;t<=1000;t+=50) modes.update([{...modeHand(0.12,false),pinched:true}],t);
  assertInspectPicker(modes);
});
test('a tap without swiping confirms the current highlighted mode',()=>{
  const modes=openModeMenu();
  assert.equal(modes.menu.selection,'charting');
  modes.update([{...modeHand(0,false),pinched:true}],550);
  modes.update([modeHand(0,false)],650);
  assert.equal(modes.mode,'charting');assert.equal(modes.menu,null);
});
test('the other hand cannot confirm the controlling hand choice',()=>{
  const modes=openModeMenu();modes.update([modeHand(0.12)],550);
  modes.update([modeHand(0.12),{...modeHand(0.12,false),id:'Right',pinched:true}],600);
  modes.update([modeHand(0.12),{...modeHand(0.12,false),id:'Right',pinched:false}],700);
  assert.equal(modes.mode,'charting');assert.ok(modes.menu);
});
test('moderate vertical swipes select each row',()=>{
  for(const angle of [-.09,.09]) {
    const modes=openModeMenu();
    modes.update([modeHand(angle)],550);
    modes.update([modeHand(angle)],600);
    assert.equal(modes.menu.selection,angle<0 ? 'charting' : 'drawing');
  }
});
test('tilting a still-bent claw is not mistaken for deliberate finger release',()=>{
  const tilted=clawObservation();
  tilted.worldPoints=tilted.worldPoints.map(p=>({x:p.z,y:p.y,z:-p.x}));
  const h=new VisionGestures().update([tilted],100,range).hands[0];
  assert.equal(h.claw,false); assert.equal(h.modeRelease,false);
  const open=new VisionGestures().update([worldHand('Left',.5,1)],100,range).hands[0];
  assert.equal(open.modeRelease,true);
});

function holdPalm(modes,start=100,id='Left') {
  for(let t=start;t<=start+1500;t+=100) modes.update([{...modeHand(0.06,false),id}],t);
}
test('open palm needs the full 1.5 seconds and captures its opening palm position',()=>{
  const modes=new VisionModes();
  for(let t=100;t<=1500;t+=100) modes.update([modeHand(0.06,false)],t);
  assert.equal(modes.menu,null);assert.ok(modes.holdProgress>.9);
  modes.update([modeHand(0.06,false)],1599);assert.equal(modes.menu,null);
  modes.update([modeHand(0.06,false)],1600);
  assert.equal(modes.menu.owner,'Left');assert.equal(modes.menu.startY,.56);
  assert.equal(modes.menu.selection,'charting');
  modes.update([modeHand(0.18,false)],1700);
  assert.equal(modes.menu.selection,'drawing');
});
test('claws, edge-on palms, swipe poses, and pinches cannot open the menu',()=>{
  for(const pose of [modeHand(),{...modeHand(0,false),palmFacing:false,wheelPalm:false},{...modeHand(0,false),swipePose:true},{...modeHand(0,false),pinched:true}]) {
    const modes=new VisionModes();
    for(let t=100;t<=2000;t+=100) modes.update([pose],t);
    assert.equal(modes.menu,null);assert.equal(modes.paused,false);
  }
});
test('early release, lost tracking, and stale frames restart the entire hold',()=>{
  for(const interruption of ['release','loss','stale']) {
    const modes=new VisionModes();
    for(let t=100;t<=1000;t+=100) modes.update([modeHand(0,false)],t);
    if(interruption!=='stale') modes.update(interruption==='loss'?[]:[modeHand()],1100);
    modes.update([modeHand(0,false)],1400);
    assert.equal(modes.holdProgress,0);
    for(let t=1500;t<=2800;t+=100) modes.update([modeHand(0,false)],t);
    assert.equal(modes.menu,null);
    modes.update([modeHand(0,false)],2900);assert.ok(modes.menu);
  }
});
test('different hands cannot combine hold time',()=>{
  const modes=new VisionModes();
  for(let t=100;t<=1000;t+=100) modes.update([modeHand(0,false)],t);
  for(let t=1100;t<=2500;t+=100) modes.update([{...modeHand(0,false),id:'Right'}],t);
  assert.equal(modes.menu,null);
  modes.update([{...modeHand(0,false),id:'Right'}],2600);
  assert.equal(modes.menu.owner,'Right');
});
test('double fists no longer open the menu',()=>{
  const modes=new VisionModes();
  for(const [t,open] of [[100,true],[200,false],[300,true],[400,false],[500,true]]) modes.update(open?[modeHand(0,false)]:[],t);
  assert.equal(modes.menu,null);
});
test('landmark-detected front palms open the menu but side palms keep swipe available',()=>{
  for(const angle of [0,Math.PI/2]) {
    const gestures=new VisionGestures();const modes=new VisionModes();
    for(let t=100;t<=1600;t+=100) {
      const result=gestures.update([worldHand('Left',.5,1,angle)],t,null);
      modes.update(result.hands,t);
    }
    assert.equal(Boolean(modes.menu),angle===0);
    if(angle) assert.equal(modes.paused,false);
  }
});

// Exercise landmark recognition and the menu together, not just a mocked pinch.
function curledTap(gap) {
  const h=worldHand('Left',.5,gap);
  h.points[4]={...h.points[8],x:h.points[8].x+gap*.15/(4/3)};
  for(const tip of [12,16,20]) {
    h.worldPoints[tip]={...h.worldPoints[tip],y:.03};
  }
  return h;
}
test('menu tap works with curled spare fingers and a small release opening',()=>{
  const gestures=new VisionGestures();
  const modes=openModeMenu();
  modes.update([modeHand(0.12)],550);
  const sample=(gap,t)=>gestures.update([curledTap(gap)],t,null,1,4/3,'Left');
  sample(1,550);
  const contact=sample(.3,600);
  assert.equal(contact.hands[0].pinched,true);
  modes.update(contact.hands,600);
  const release=sample(.6,650);
  assert.equal(release.hands[0].pinched,false);
  modes.update(release.hands,650);
  assertInspectPicker(modes);
});
test('curled spare fingers can start a chart pinch as well as a menu tap',()=>{
  for(const owner of [null,'Right']) {
    const gestures=new VisionGestures();
    gestures.update([curledTap(1)],550,range,1,4/3,owner);
    assert.equal(gestures.update([curledTap(.3)],600,range,1,4/3,owner).hands[0].pinched,true);
  }
});
test('a full fist still cancels the menu despite relaxed tap recognition',()=>{
  const gestures=new VisionGestures();
  const modes=openModeMenu();
  modes.update([modeHand(0.12)],550);
  const result=gestures.update([closedFist('Left',.5)],600,null,1,4/3,'Left');
  assert.deepEqual(result.inactiveHands,['Left']);
  modes.update(result.hands,600);
  assert.equal(modes.menu,null);
  assert.equal(modes.mode,'charting');
});

test('menu choice survives returning the hand to neutral before a tap',()=>{
  const modes=openModeMenu();modes.update([modeHand(0.12)],550);
  for(const t of [600,650,700]) modes.update([modeHand(0)],t);
  assert.equal(modes.menu.selection,'drawing');
  modes.update([{...modeHand(0,false),pinched:true}],750);
  modes.update([modeHand(0,false)],800);
  assertInspectPicker(modes);
});
test('image contact confirms despite erroneous estimated fingertip depth at different rolls',()=>{
  for(const angle of [-.8,0,.8]) {
    const gestures=new VisionGestures();const modes=openModeMenu();
    modes.update([modeHand(0.12)],550);
    const sample=(gap,t)=>{
      const h=curledTap(1);
      h.points[4]={...h.points[8],x:h.points[8].x+gap*.15/(4/3)};
      // Rotate the complete image; world distance deliberately remains open.
      h.points=h.points.map(p=>{const x=(p.x-.5)*4/3,y=p.y-.65;return {
        x:.5+(x*Math.cos(angle)-y*Math.sin(angle))/(4/3),
        y:.65+x*Math.sin(angle)+y*Math.cos(angle)};});
      return gestures.update([h],t,null,1,4/3,'Left');
    };
    sample(.8,550);
    const touching=sample(.1,600);
    assert.equal(touching.hands[0].pinched,true);
    modes.update(touching.hands,600);
    const released=sample(.4,650);
    assert.equal(released.hands[0].pinched,false);
    modes.update(released.hands,650);
    assertInspectPicker(modes);
  }
});
test('a bent index outside the palm can tap without being discarded as a fist',()=>{
  const gestures=new VisionGestures();const modes=openModeMenu();
  modes.update([modeHand(0.12)],550);
  gestures.update([curledTap(1)],550,null,1,4/3,'Left');
  const h=curledTap(.1);
  h.worldPoints[8]={x:-.025,y:0,z:.05};
  h.worldPoints[4]={...h.worldPoints[8],x:-.02};
  const result=gestures.update([h],600,null,1,4/3,'Left');
  assert.equal(result.hands[0]?.pinched,true);
  assert.deepEqual(result.inactiveHands,[]);
  modes.update(result.hands,600);
  modes.update(gestures.update([curledTap(.6)],650,null,1,4/3,'Left').hands,650);
  assertInspectPicker(modes);
});


test('fully open palms allow a small tilt while claws remain rejected',()=>{
  for(const angle of [0,.25]) {
    const observation=worldHand('Left',.5,1,angle);
    for(const tip of [8,12,16,20]) {
      const p=observation.worldPoints[tip];
      p.z+=.005;
    }
    const result=new VisionGestures().update([observation],100,null);
    assert.equal(result.hands[0].wheelPalm,true,JSON.stringify({angle,hand:result.hands[0]}));
  }
  assert.equal(new VisionGestures().update([clawObservation()],100,null).hands[0].wheelPalm,false);
});
test('brief pose flicker pauses hold progress but does not count toward the dwell',()=>{
  const modes=new VisionModes();
  for(let t=100;t<=1000;t+=50) modes.update([modeHand(0,false)],t);
  const progress=modes.holdProgress;
  modes.update([{...modeHand(0,false),wheelPalm:false}],1050);
  assert.equal(modes.holdProgress,progress);
  modes.update([modeHand(0,false)],1100);
  assert.equal(modes.holdProgress,progress);
  for(let t=1150;t<=1650;t+=50) modes.update([modeHand(0,false)],t);
  assert.equal(modes.menu,null);
  modes.update([modeHand(0,false)],1700);assert.ok(modes.menu);
});


test('menu rejects any curled finger, a closed thumb gap, and excessive tilt',()=>{
  const poses=[worldHand('Left',.5,.6),worldHand('Left',.5,1,.65)];
  for(const tip of [8,12,16,20]) {
    const pose=worldHand('Left',.5,1);
    pose.worldPoints[tip]={...pose.worldPoints[tip-2],z:.04};
    poses.push(pose);
  }
  for(const pose of poses) {
    assert.equal(new VisionGestures().update([pose],100,null).hands[0]?.wheelPalm ?? false,false);
  }
});
test('a second active hand blocks opening and clears an existing hold',()=>{
  const modes=new VisionModes();
  for(let t=100;t<=1000;t+=50) modes.update([modeHand(0,false)],t);
  modes.update([modeHand(0,false),{...modeHand(),id:'Right'}],1050);
  assert.equal(modes.gesturePending,false);
  for(let t=1100;t<=3000;t+=50) modes.update([modeHand(0,false),{...modeHand(0,false),id:'Right'}],t);
  assert.equal(modes.menu,null);
  holdPalm(modes,3050);assert.ok(modes.menu);
});
test('one open palm with the other hand in a fist can open the menu',()=>{
  const gestures=new VisionGestures(), modes=new VisionModes();
  for(let t=100;t<=1600;t+=50) {
    const result=gestures.update([worldHand('Left',.3,1),closedFist('Right',.7)],t,null);
    assert.equal(result.hands.length,1);
    assert.deepEqual(result.inactiveHands,['Right']);
    modes.update(result.hands,t);
  }
  assert.equal(modes.menu.owner,'Left');
});

test('chart pinches use visible contact when depth disagrees and can engage one hand at a time',()=>{
  const engine=new VisionGestures();
  const sample=(id,x,gap)=>{
    const h=worldHand(id,x,.85);
    h.points[4]={...h.points[8],x:h.points[8].x+gap*.15/(4/3)};
    return h;
  };
  engine.update([sample('Left',.3,.8),sample('Right',.7,.8)],100,range);
  for(let t=150;t<=450;t+=50) {
    const first=engine.update([sample('Left',.3,.08),sample('Right',.7,.8)],t,range);
    assert.equal(first.hands[0].pinched,true);assert.equal(first.hands[1].pinched,false);assert.equal(first.zooming,false);
  }
  engine.update([sample('Left',.3,.08),sample('Right',.7,.08)],500,range);
  assert.equal(engine.update([sample('Left',.3,.08),sample('Right',.7,.08)],580,range).zooming,true);
  assert.equal(engine.update([sample('Left',.3,.5),sample('Right',.7,.08)],620,range).zooming,false);
});
test('projected fingertip overlap needs a previously open image gap and bounded depth',()=>{
  const sample=(gap)=>{const h=worldHand('Left',.3,gap);h.points[4]={...h.points[8]};return h;};
  const engine=new VisionGestures();
  for(let t=100;t<=400;t+=50) assert.equal(engine.update([sample(.85)],t,range).hands[0].pinched,false);
  engine.update([hand('Left',.3,false)],450,range);
  assert.equal(engine.update([sample(1.4)],500,range).hands[0].pinched,false);
});
test('cancelling a pending menu hold preserves pinch readiness while resetting motion',()=>{
  const engine=new VisionGestures(),modes=new VisionModes();
  modes.update(engine.update([worldHand('Left',.3,1)],100,range).hands,100);
  assert.equal(modes.gesturePending,true);
  const observed=engine.update([worldHand('Left',.3,.3),worldHand('Right',.7,1)],150,null);
  modes.update(observed.hands,150);
  assert.equal(modes.gesturePending,false);
  engine.resetMotion();
  const both=engine.update([worldHand('Left',.3,.3),worldHand('Right',.7,.3)],200,range);
  assert.ok(both.hands.every(h=>h.pinched));
  assert.equal(engine.update([worldHand('Left',.3,.3),worldHand('Right',.7,.3)],280,range).zooming,true);
});

test('left and right open palms share the same acceptance across small tilt, roll, and hand size',()=>{
  for(const id of ['Left','Right']) for(const tilt of [-.35,0,.35]) for(const roll of [-.3,.3]) for(const scale of [.7,1.3]) {
    const pose=worldHand(id,.5,.72,tilt,scale);
    const mirror=id==='Left'?1:-1;
    pose.worldPoints=pose.worldPoints.map(p=>({x:mirror*(p.x*Math.cos(roll)-p.y*Math.sin(roll)),y:p.x*Math.sin(roll)+p.y*Math.cos(roll),z:p.z}));
    pose.points=pose.points.map(p=>({...p,x:mirror===1?p.x:1-p.x}));
    const engine=new VisionGestures(),modes=new VisionModes();
    for(let t=100;t<=1600;t+=50) {
      const result=engine.update([pose],t,null);
      assert.equal(result.hands[0].wheelPalm,true,JSON.stringify({id,tilt,roll,scale}));
      modes.update(result.hands,t);
    }
    assert.equal(modes.menu.owner,id);
  }
});


test('a mouse-opened menu acquires an open hand and allows a fresh tap',()=>{
  const modes=new VisionModes();modes.open({x:.5,y:.5});
  modes.menu.selection='drawing';
  modes.update([{...modeHand(0.12,false),pinched:true}],100);
  assert.equal(modes.menu.owner,null);assert.equal(modes.mode,'charting');
  modes.update([modeHand(0.12,false)],150);
  assert.equal(modes.menu.owner,'Left');assert.equal(modes.menu.startY,.62);
  modes.update([{...modeHand(0.12,false),pinched:true}],200);
  modes.update([modeHand(0.12,false)],250);
  assertInspectPicker(modes);
});
test('menu selection remains pinned through a small release and inconsistent depth',()=>{
  for(const id of ['Left','Right']) {
    const gestures=new VisionGestures(),modes=new VisionModes();
    modes.open({x:.5,y:.5},id);modes.menu.selection='drawing';
    const sample=(gap,t)=>{
      const h=curledTap(.9);h.id=id;
      h.points[4]={...h.points[8],x:h.points[8].x+gap*.15/(4/3)};
      return gestures.update([h],t,null,1,4/3,id).hands;
    };
    modes.update(sample(.8,100),100);
    modes.update(sample(.23,150),150);
    assert.ok(modes.menu.tap);
    modes.update(sample(.23,230),230);
    assertInspectPicker(modes);
  }
});

test('Drawing keeps pinch readiness through rapid expansion and brief hand loss',()=>{
  const engine=new VisionGestures();
  const update=(poses,t)=>engine.update(poses,t,null,1,4/3,null,true);
  update(pair(.3,.7,false),100);update(pair(.3,.7,true),150);
  const wide=update(pair(.01,.99,true),200);
  assert.ok(wide.hands.every(h=>h.pinched));
  assert.equal(update([hand('Left',.01,true)],250).hands.length,1);
  assert.ok(update(pair(.01,.99,true),300).hands.every(h=>h.pinched));
  update([],350);update([],500);
  assert.ok(update(pair(.01,.99,true),550).hands.every(h=>!h.pinched));
});
test('Drawing smooths ambiguous pinch noise but clear opening releases immediately',()=>{
  const engine=new VisionGestures();
  const pose=(ratio,gap)=>{
    const h=worldHand('Left',.5,ratio);
    h.points[4]={...h.points[8],x:h.points[8].x+gap*.15/(4/3)};
    return h;
  };
  const update=(ratio,gap,t)=>engine.update([pose(ratio,gap)],t,null,1,4/3,null,true).hands[0];
  update(1,1,100);assert.equal(update(.3,.1,150).pinched,true);
  assert.equal(update(.85,.4,200).pinchUncertain,true);
  assert.equal(update(.85,.4,250).pinched,true);
  assert.equal(update(.3,.1,280).pinchUncertain,false);
  assert.equal(update(1,1,300).pinched,false);
  update(.3,.1,350);update(.85,.4,400);
  assert.equal(update(.85,.4,520).pinched,false);
});
