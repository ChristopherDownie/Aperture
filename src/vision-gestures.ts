import { palmDepthScale } from './vision-depth.ts';
export type Point = { x: number; y: number };
export type WorldPoint = Point & { z: number };
export type Hand = Point & { id: string; pinched: boolean; pinchUncertain?: boolean; depthScale?:number; armed: boolean; openPalm: boolean; palmFacing: boolean; wheelPalm: boolean; modeRelease: boolean; swipePose: boolean; claw: boolean; palm: Point; knobAngle: number };
export type FistHand = Pick<Hand, 'id' | 'palm' | 'knobAngle'>;
export type Range = { from: number; to: number };
export type Observation = { id: string; points: Point[]; worldPoints?: WorldPoint[] };
const distance = (a: Point, b: Point, aspect = 1) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export class VisionGestures {
  private tracks = new Map<string, Hand & { imageOpened: boolean; seenAt:number; uncertainSince:number|null }>();
  private fists = new Set<string>();
  private lastTime = 0;
  private pending = 0;
  private grip: { distance: number; range: Range; fraction: number; anchor: number; moved: boolean } | null = null;
  private swipe: { id: string; since: number; origin: Point; range: Range; active: boolean } | null = null;

  resetMotion() { this.grip = null; this.swipe = null; this.pending = 0; }
  reset() { this.tracks.clear(); this.fists.clear(); this.resetMotion(); this.lastTime = 0; }

  update(observations: Observation[], now: number, range: Range | null, aspect = 1, cameraAspect = 4 / 3, modeOwner: string | null = null, stabilizeDrawingPinch = false) {
    if (this.lastTime && now - this.lastTime > 250) this.reset();
    const alpha = this.lastTime ? 1 - Math.exp(-(now - this.lastTime) / 45) : 1;
    this.lastTime = now;
    const previousTracks=this.tracks;
    const next = new Map<string, Hand & { imageOpened: boolean; seenAt:number; uncertainSince:number|null }>();
    const fists = new Set<string>();
    const fistHands: FistHand[] = [];
    for (const { id, points: p, worldPoints } of observations) {
      if (p.length !== 21 || p.some(v => !Number.isFinite(v.x) || !Number.isFinite(v.y)) || next.has(id) || fists.has(id)) continue;
      // Screen-space palm width collapses when the hand turns sideways. Use the
      // model's metric 3D landmarks for pose, keeping image coordinates for pointers.
      const world = worldPoints?.length === 21 && worldPoints.every(v => [v.x, v.y, v.z].every(Number.isFinite)) ? worldPoints : null;
      const measure = (a: number, b: number) => world
        ? Math.hypot(world[a].x - world[b].x, world[a].y - world[b].y, world[a].z - world[b].z)
        : distance(p[a], p[b], cameraAspect);
      const visibleSize = Math.max(distance(p[5], p[17], cameraAspect), distance(p[0], p[9], cameraAspect));
      const palm = Math.max(measure(5, 17), measure(0, 9));
      if (visibleSize < 0.025 || palm < 0.0001) continue;
      const ratio = measure(4, 8) / palm;
      const selectingMode = id === modeOwner;
      // Estimated depth can disagree with visible fingertip contact. For chart
      // pinches, only admit the image cue after seeing these fingers apart, and
      // cap the 3D gap so distant fingers crossing in projection aren't enough.
      const imageGap = distance(p[4], p[8], cameraAspect) / visibleSize;
      const previous = this.tracks.get(id);
      const wasPinched = previous?.pinched;
      const tapContact = selectingMode && (ratio < (wasPinched ? .55 : .5)
        || imageGap < (wasPinched ? .34 : .25));
      // A pinching index can bend toward the wrist like a fist. Preserve that
      // tap only while the index tip is still outside the compact fist region.
      const indexOutsideFist = measure(8,0) > measure(5,0) * .9;
      const imageContact = Boolean(previous?.imageOpened) && imageGap < (wasPinched ? .28 : .2) && ratio < 1.1;
      const chartContact = ratio < (wasPinched ? .78 : .5) || imageContact;
      const tapOutsideFist = (selectingMode ? tapContact : chartContact) && indexOutsideFist;
      // A roomy, bent-finger grab differs from straight fingers and a tight fist.
      // Use joint angles in 3D; screen projection alone cannot resolve a claw.
      let straight = 0;
      let fullyExtended = 0;
      const bent = [8,12,16,20].filter(tip => {
        const a=measure(tip-3,tip-2), b=measure(tip,tip-2), c=measure(tip,tip-3);
        const cosine=(a*a+b*b-c*c)/Math.max(2*a*b,.00000001);
        if(a > palm*.1 && b > palm*.1 && cosine < -.94) straight++;
        if(a > palm*.1 && b > palm*.1 && cosine < -.82 && measure(tip,0) > measure(tip-2,0)*1.08) fullyExtended++;
        return a > palm*.1 && b > palm*.1 && cosine > -.94 && cosine < .75 && measure(tip,tip-3)/palm > .4;
      }).length;
      let facing = 0;
      if (world) {
        // Use the palm centerline crossed with its full width, not a triangle
        // rooted on one knuckle. Mirroring either hand preserves this score.
        const a={x:world[9].x-world[0].x,y:world[9].y-world[0].y,z:world[9].z-world[0].z};
        const b={x:world[17].x-world[5].x,y:world[17].y-world[5].y,z:world[17].z-world[5].z};
        const normal={x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x};
        facing=Math.abs(normal.z)/Math.max(Math.hypot(normal.x,normal.y,normal.z),.00000001);
      }
      // The palm plane must face the camera. Wrist roll keeps this true, while
      // the edge-on swipe pose does not. Allow moderate tilt during a held claw.
      const claw = facing > (this.tracks.get(id)?.claw ? .45 : .65) && ratio > .7 && bent >= 3;
      // Mirrored screen angle: zero upright, positive clockwise. Palm joints
      // stay steadier than fingertips while curling around an imaginary knob.
      const knuckles = [5,9,13,17].reduce((sum,i)=>({x:sum.x+p[i].x/4,y:sum.y+p[i].y/4}),{x:0,y:0});
      const knobAngle = Math.atan2((p[0].x-knuckles.x)*cameraAspect, p[0].y-knuckles.y);
      // A fully curled index AND spare fingers mutes this hand, even during
      // zoom. Spare-finger relaxation alone still preserves the improved pinch.
      const curled = [8,12,16,20].every(tip => measure(tip,0) < measure(tip-2,0) * (this.fists.has(id) ? 1.18 : 1.05));
      if (curled && !claw && !tapOutsideFist) {
        fists.add(id);
        const palmPoint=[0,5,9,13,17].reduce((sum,i)=>({x:sum.x+(1-p[i].x)/5,y:sum.y+p[i].y/5}),{x:0,y:0});
        fistHands.push({id,palm:palmPoint,knobAngle});
        continue;
      }
      // Spare fingers can curl naturally; only a compact full fist mutes input.
      const raw = { x: clamp(1 - p[8].x, 0, 1), y: clamp(p[8].y, 0, 1) };
      let old = this.tracks.get(id);
      if (old && distance(raw, old) > 0.3) {
        // A rapid expansion must not erase an already held Drawing pinch.
        if(!stabilizeDrawingPinch || !old.pinched) old=undefined;
        this.resetMotion();
      }
      const imageOpened = Boolean(old?.imageOpened || imageGap > .35);
      const armed = Boolean(old?.armed || ratio > .6 || imageGap > .35);
      let pinched = selectingMode ? armed && tapContact
        : armed && chartContact && (!claw || imageContact);
      let uncertainSince:number|null=null;
      const clearRelease=ratio>.9 && imageGap>.35;
      if(stabilizeDrawingPinch && !selectingMode && old?.pinched && !pinched && !clearRelease) {
        uncertainSince=old.uncertainSince??now;
        pinched=now-uncertainSince<120;
      }
      const pinchUncertain=pinched && uncertainSince!==null;
      const openPalm = !claw && !pinched && ratio > 0.7 && [8,12,16,20].filter(tip => measure(tip, 0) > measure(tip - 2, 0) * 1.15).length >= 3;
      // Confirm a mode only with clearly straightened fingers, not merely when
      // turning changes the palm-facing or claw classification for one frame.
      const modeRelease = openPalm && straight >= 3;
      // Scroll is intentionally an upright, edge-on hand, not a palm presented
      // flat to the camera. Wide exit margins prevent pose chatter during a swipe.
      const holdingSwipe = this.swipe?.id === id;
      const sideways = world ? Math.abs(world[5].z-world[17].z) / Math.max(measure(5,17), .0001) : 0;
      const upright = world ? (world[0].y-world[9].y) / Math.max(measure(0,9), .0001) : 0;
      const swipePose = openPalm && sideways > (holdingSwipe ? .35 : .55) && upright > (holdingSwipe ? .35 : .55);
      // Wheel entry requires all four fingers extended and the thumb apart.
      // Allow a small tilt margin, with hysteresis at the facing boundary.
      const palmFacing = facing > (old?.palmFacing ? .85 : .89);
      const wheelPalm = palmFacing && fullyExtended === 4 && ratio > .65 && !pinched && !swipePose;
      // Palm motion is steadier than fingertip motion when fingers flex during a swipe.
      const center = [0,5,9,13,17].reduce((sum, i) => ({ x: sum.x + (1-p[i].x)/5, y: sum.y + p[i].y/5 }), {x:0,y:0});
      const palmPoint = old ? {x:old.palm.x+(center.x-old.palm.x)*alpha, y:old.palm.y+(center.y-old.palm.y)*alpha} : center;
      const depthScale=palmDepthScale(p,world,cameraAspect);
      next.set(id, { id, depthScale, x: old ? old.x + (raw.x - old.x) * alpha : raw.x, y: old ? old.y + (raw.y - old.y) * alpha : raw.y, pinched, pinchUncertain, armed, imageOpened, seenAt:now, uncertainSince, openPalm, palmFacing, wheelPalm, modeRelease, swipePose, claw, palm: palmPoint, knobAngle });
    }
    if ([...this.tracks.keys()].some(id => !next.has(id))) { this.grip = null; this.swipe = null; this.pending = 0; }
    this.tracks = new Map(next);
    if(stabilizeDrawingPinch) {
      // Missing hands do not produce pointers. Retain only their recent pinch
      // state so a same-hand recovery doesn't require reopening both fingers.
      for(const [id,track] of previousTracks) {
        if(!next.has(id) && !fists.has(id) && now-track.seenAt<=180) this.tracks.set(id,track);
      }
    }
    this.fists = fists;
    const hands: Hand[] = [...next.values()];
    let zoom: Range | null = null;
    if (hands.length === 2 && hands.every(h => h.pinched) && range && range.to > range.from) {
      const gap = distance(hands[0], hands[1], aspect);
      if (gap >= 0.12) {
        if (!this.pending) this.pending = now;
        if (!this.grip && now - this.pending >= 80) {
          const fraction = (hands[0].x + hands[1].x) / 2;
          this.grip = { distance: gap, range: { ...range }, fraction, anchor: range.from + fraction * (range.to - range.from), moved: false };
        }
        if (this.grip) {
          const g = this.grip;
          const movement = Math.log(gap / g.distance);
          const factor = clamp(Math.exp(Math.sign(movement) * Math.max(0, Math.abs(movement) - 0.025)), 0.125, 8);
          const span = (g.range.to - g.range.from) / factor;
          if (factor !== 1) g.moved = true;
          if (g.moved) zoom = { from: g.anchor - g.fraction * span, to: g.anchor + (1 - g.fraction) * span };
        }
      } else { this.grip = null; this.pending = 0; }
    } else { this.grip = null; this.pending = 0; }
    let pan: Range | null = null;
    // One upright, angled hand scrolls; two hands reserve pinch zoom.
    // A brief arming interval and horizontal dead zone reject entry motion/jitter.
    if (hands.length === 1 && hands[0].swipePose && range && range.to > range.from) {
      const hand = hands[0];
      if (!this.swipe || this.swipe.id !== hand.id) this.swipe = {id:hand.id, since:now, origin:{...hand.palm}, range:{...range}, active:false};
      const swipe = this.swipe;
      if (now - swipe.since < 160) { swipe.origin = {...hand.palm}; swipe.range = {...range}; }
      else {
        const dx = hand.palm.x - swipe.origin.x;
        const dy = hand.palm.y - swipe.origin.y;
        if (!swipe.active && Math.abs(dx) > .025 && Math.abs(dx)*aspect > Math.abs(dy)*1.3) swipe.active = true;
        if (swipe.active) {
          const travel = Math.sign(dx) * Math.max(0, Math.abs(dx)-.025);
          const offset = -travel * (swipe.range.to-swipe.range.from);
          pan = {from:swipe.range.from+offset, to:swipe.range.to+offset};
        }
      }
    } else this.swipe = null;
    return { hands, fistHands, inactiveHands: [...fists], zoom, pan, panning: this.swipe?.active ?? false, zooming: this.grip !== null, anchor: this.grip?.fraction ?? null };
  }
}
