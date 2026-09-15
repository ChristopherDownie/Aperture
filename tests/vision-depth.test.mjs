import test from 'node:test';
import assert from 'node:assert/strict';
import {palmDepthScale,depthTilt} from '../src/vision-depth.ts';
import {perspectiveSheet,glassPoint,insideField} from '../src/vision-field-geometry.ts';
import {VisionFrames} from '../src/vision-frames.ts';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const rectangle=[{x:.2,y:.3},{x:.8,y:.3},{x:.8,y:.7},{x:.2,y:.7}];
test('perspective keeps both gripped corners exact and the sheet convex at every supported tilt',()=>{
  for(const aspect of [1,2,3]) for(const reverse of [false,true]) for(const tilt of [-.85,-.4,0,.4,.85]) {
    const result=perspectiveSheet(rectangle,tilt,aspect,reverse),ids=reverse?[3,1]:[0,2];
    for(const i of ids) {near(result.corners[i].x,rectangle[i].x);near(result.corners[i].y,rectangle[i].y);}
    assert.ok(result.weights.every(w=>Number.isFinite(w)&&w>.5));
    const signs=result.corners.map((p,i)=>{
      const q=result.corners[(i+1)%4],r=result.corners[(i+2)%4];return Math.sign((q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x));
    });
    assert.ok(signs.every(s=>s===signs[0]&&s!==0));
    if(tilt===0) result.corners.forEach((p,i)=>{near(p.x,rectangle[i].x);near(p.y,rectangle[i].y);});
  }
});
test('projected grid meets the corners and stays inside the perspective glass',()=>{
  const sheet=perspectiveSheet(rectangle,.7,2);
  const bounds={x:0,y:0,width:1,height:1,corners:sheet.corners};
  for(const [i,[u,v]] of [[0,0],[1,0],[1,1],[0,1]].entries()) {
    const p=glassPoint(sheet.corners,sheet.weights,u,v);near(p.x,sheet.corners[i].x);near(p.y,sheet.corners[i].y);
  }
  for(let i=0;i<=10;i++) for(let j=0;j<=10;j++) assert.equal(insideField(glassPoint(sheet.corners,sheet.weights,i/10,j/10),bounds),true);
});
test('relative depth cancels hand-size differences and moving both hands closer together',()=>{
  near(depthTilt([3,7],[3,7]),0);near(depthTilt([6,14],[3,7]),0);
  near(depthTilt([3,7.2],[3,7]),0);
  assert.ok(depthTilt([3,10],[3,7])>0);assert.ok(depthTilt([5,7],[3,7])<0);
  assert.equal(depthTilt([0,7],[3,7]),0);assert.equal(depthTilt([Infinity,7],[3,7]),0);
  assert.ok(Math.abs(depthTilt([1,1000],[3,7]))<=.85);
});
test('palm scale compensates projected hand orientation without comparing hand-local depth origins',()=>{
  const world=Array.from({length:21},(_,i)=>({x:(i%5-2)*.02,y:Math.floor(i/5)*.025,z:0}));
  for(const angle of [0,.6,-.6]) {
    const rotated=world.map(p=>({x:p.x*Math.cos(angle),y:p.y,z:50-p.x*Math.sin(angle)}));
    const points=rotated.map(p=>({x:.5+p.x*3/(4/3),y:.4+p.y*3}));
    near(palmDepthScale(points,rotated,4/3),3);
    const larger=points.map(p=>({x:.5+(p.x-.5)*1.5,y:.4+(p.y-.4)*1.5}));
    near(palmDepthScale(larger,rotated,4/3),4.5);
  }
  assert.equal(palmDepthScale([],null,4/3),undefined);
});
test('depth calibrates each grab, eases toward tilt, freezes through loss and releases immediately',()=>{
  const frames=new VisionFrames();
  const pair=[{id:'Left',x:.25,y:.3,pinched:true,depthScale:3},{id:'Right',x:.75,y:.7,pinched:true,depthScale:7}];
  const update=(hands,t)=>frames.update(hands,t,'a',true,.025,.025,false,2);
  update(pair,100);update(pair,200);near(frames.visible('a').tilt,0);
  const closer=[pair[0],{...pair[1],depthScale:12}];
  update(closer,250);assert.ok(frames.visible('a').tilt>0 && frames.visible('a').tilt<=.125);
  for(let t=300;t<=800;t+=50)update(closer,t);
  assert.ok(frames.visible('a').tilt>.6);const before=frames.visible('a');
  update([closer[0]],850);assert.deepEqual(frames.visible('a'),before);
  update(closer,900);assert.ok(frames.following);
  update([{...closer[0],pinched:false},closer[1]],950);assert.equal(frames.visible('a'),null);
  update(closer,1000);update(closer,1100);near(frames.visible('a').tilt,0);
});
test('missing depth eases back to the flat rotating field without disconnecting',()=>{
  const frames=new VisionFrames();const pair=[{id:'Left',x:.25,y:.3,pinched:true,depthScale:3},{id:'Right',x:.75,y:.7,pinched:true,depthScale:7}];
  frames.update(pair,100,'a',true);frames.update(pair,200,'a',true);
  for(let t=250;t<=700;t+=50)frames.update([pair[0],{...pair[1],depthScale:12}],t,'a',true);
  assert.ok(frames.visible('a').tilt>.5);
  for(let t=750;t<=3000;t+=50)frames.update(pair.map(h=>({...h,depthScale:undefined})),t,'a',true);
  assert.ok(Math.abs(frames.visible('a').tilt)<.0001);assert.ok(frames.following);
});
