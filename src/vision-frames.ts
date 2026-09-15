import { perspectiveSheet } from './vision-field-geometry.ts';
import { depthTilt } from './vision-depth.ts';
import type { Hand } from './vision-gestures';

export type FrameRect = { x: number; y: number; width: number; height: number; corners: {x:number;y:number}[]; tilt:number; weights:number[] };
export class VisionFrames {
  private active: { context: string; ids: string[]; diagonal:number; widthFraction:number; heightFraction:number; depthBaseline:[number,number]|null; tilt:number } | null = null;
  private rect: FrameRect | null = null;
  private pending: { context: string; ids: string[]; since: number } | null = null;
  private lastTime = 0;
  private missingSince:number|null=null;
  private locked = false;
  private reopened = new Set<string>();
  get recovering() { return this.active!==null && this.missingSince!==null; }
  get following() { return this.active !== null; }
  cancel() { this.pending=null; this.active=null; this.rect=null; this.missingSince=null; this.locked=true; this.reopened.clear(); }
  clear() { this.cancel(); }
  visible(context: string) { return this.active?.context===context ? this.rect : null; }
  update(hands: Hand[], now: number, context: string, enabled: boolean, minWidth=.025, minHeight=.025, fist=false, aspect=1) {
    const dt=this.lastTime?Math.max(0,Math.min(100,now-this.lastTime)):33;
    if(this.lastTime && now-this.lastTime>250) this.cancel();
    this.lastTime=now;
    if(!enabled || fist) { this.cancel(); return; }
    if(this.active?.context!==context && this.active || this.pending?.context!==context && this.pending) { this.cancel(); return; }
    if(hands.length!==2) {
      if(hands.some(h=>!h.pinched || (this.active && !this.active.ids.includes(h.id)))) { this.cancel(); return; }
      this.pending=null;
      // Freeze the last valid rectangle during a brief occlusion. Never move
      // its corners using an inferred/missing hand; recovery must be the same IDs.
      if(this.active) {
        this.missingSince??=now;
        if(now-this.missingSince<180) return;
      }
      this.cancel(); return;
    }
    if(this.missingSince!==null && now-this.missingSince>=180) { this.cancel(); return; }
    this.missingSince=null;
    for(const hand of hands) if(!hand.pinched) this.reopened.add(hand.id);
    if(hands.every(h=>this.reopened.has(h.id))) this.locked=false;
    if(this.active && this.active.ids.some(id=>!hands.some(h=>h.id===id))) { this.cancel(); return; }
    if(!hands.every(h=>h.pinched)) {
      // Releasing either pinch disconnects immediately. The other hand may
      // keep holding while the released hand pinches again to reconnect.
      this.active=null;this.rect=null;this.pending=null;
      return;
    }
    if(!this.active) {
      if(this.locked || !hands.every(h=>h.pinched)) { this.pending=null; return; }
      if(!this.pending) this.pending={context,ids:hands.map(h=>h.id),since:now};
      if(now-this.pending.since<80) return;
      // Keep stable hand identities and the initial rectangle proportions.
      // The line between the grabbed corners supplies rotation and scale.
      const ordered=[...hands].sort((a,b)=>a.x-b.x);
      const dx=(ordered[1].x-ordered[0].x)*aspect,dy=ordered[1].y-ordered[0].y;
      const distance=Math.hypot(dx,dy);
      if(distance<Math.max(minWidth*aspect,minHeight)) return;
      // A nearly flat starting grip still gets a usable sheet rather than a
      // zero-height box. Proportions stay fixed until the next grab.
      const ratio=Math.max(.5,Math.min(2.5,Math.abs(dx)/Math.max(Math.abs(dy),1e-6)));
      const widthFraction=ratio/Math.hypot(ratio,1),heightFraction=1/Math.hypot(ratio,1);
      this.active={context,ids:ordered.map(h=>h.id),diagonal:Math.atan2((dy<0?-1:1)*heightFraction,widthFraction),widthFraction,heightFraction,depthBaseline:null,tilt:0};
      this.pending=null;
    }
    const clamp=(v:number)=>Math.max(0,Math.min(1,v));
    const ordered=this.active.ids.map(id=>hands.find(h=>h.id===id)!);
    const [a,b]=ordered.map(h=>({x:clamp(h.x)*aspect,y:clamp(h.y)}));
    const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);
    if(distance<Math.max(minWidth*aspect,minHeight)) { this.rect=null;return; }
    const angle=Math.atan2(dy,dx)-this.active.diagonal;
    const width=distance*this.active.widthFraction,height=distance*this.active.heightFraction;
    const u={x:Math.cos(angle)*width/2,y:Math.sin(angle)*width/2};
    const v={x:-Math.sin(angle)*height/2,y:Math.cos(angle)*height/2};
    const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    let corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([su,sv])=>({x:(center.x+su*u.x+sv*v.x)/aspect,y:center.y+su*u.y+sv*v.y}));
    const scales=ordered.map(h=>h.depthScale);
    const valid=scales.every((n):n is number=>typeof n==='number' && Number.isFinite(n) && n>0);
    let target=0;
    if(valid) {
      const pair=scales as [number,number];
      this.active.depthBaseline??=[...pair];
      target=depthTilt(pair,this.active.depthBaseline);
    }
    // A dead zone, low-pass response, and angular speed limit tame depth noise.
    // Unavailable depth gently returns the sheet to its existing 2D behavior.
    const change=(target-this.active.tilt)*(1-Math.exp(-dt/180));
    this.active.tilt+=Math.max(-dt*.0025,Math.min(dt*.0025,change));
    let weights=[1,1,1,1];
    if(Math.abs(this.active.tilt)>.0001) {
      const projected=perspectiveSheet(corners,this.active.tilt,aspect,this.active.diagonal<0);
      corners=projected.corners;weights=projected.weights;
    }
    const x=Math.max(0,Math.min(...corners.map(p=>p.x))),y=Math.max(0,Math.min(...corners.map(p=>p.y)));
    const right=Math.min(1,Math.max(...corners.map(p=>p.x))),bottom=Math.min(1,Math.max(...corners.map(p=>p.y)));
    this.rect={x,y,width:right-x,height:bottom-y,corners,tilt:this.active.tilt,weights};
  }
}
