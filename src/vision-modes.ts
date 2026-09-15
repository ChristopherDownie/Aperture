import type { InspectConcept } from './inspect-concepts';
import type { Hand, Point } from './vision-gestures';

export type VisionMode = 'charting' | 'drawing';
export type MenuChoice = VisionMode | InspectConcept;
const PALM_HOLD_MS = 1500;
export class VisionModes {
  mode: VisionMode = 'charting';
  concept: InspectConcept = 'structure';
  confirmation: {mode:VisionMode;at:number}|null=null;
  menu: { stage: 'mode' | 'concept'; owner: string | null; origin: Point; startY: number; offsetY: number; selection: MenuChoice | null; tap: { mode: MenuChoice | null; since: number } | null; tapArmed: boolean } | null = null;
  private candidate: { id: string; elapsed: number; lastValid: number } | null = null;
  private lastTime = 0;

  cancel() { this.menu=null; this.candidate=null; }
  open(origin: Point, owner: string | null = null) {
    this.menu={stage:'mode',owner, origin:{...origin}, startY:origin.y, offsetY:0, selection:this.mode, tap:null, tapArmed:true}; this.candidate=null;
  }
  choose(mode: VisionMode) { this.mode=mode; this.cancel(); this.confirmation=null; }
  select(choice:MenuChoice,now=0,palm?:Point) {
    if(!this.menu || !this.choices.includes(choice)) return;
    if(choice==='drawing') {
      const menu=this.menu;
      menu.stage='concept';menu.selection=this.concept;menu.tap=null;
      // A held selection pinch cannot select the next screen. Reopen first,
      // then establish a fresh neutral palm position for the concept menu.
      menu.tapArmed=false;menu.offsetY=0;
      menu.startY=palm?.y ?? menu.startY;
      return;
    }
    if(choice==='structure' || choice==='fair-value-gap') {
      this.concept=choice;this.choose('drawing');
      this.confirmation={mode:'drawing',at:now};
    } else { this.choose('charting');this.confirmation={mode:'charting',at:now}; }
  }
  back() {
    if(!this.menu) return;
    const {origin,owner}=this.menu;
    this.open(origin,owner);
    this.menu!.tapArmed=false;
  }
  get choices():MenuChoice[] { return this.menu?.stage==='concept' ? ['structure','fair-value-gap'] : ['charting','drawing']; }
  update(hands: Hand[], now: number) {
    const previousTime=this.lastTime;
    const dt=this.lastTime ? Math.max(0,now-this.lastTime) : 33;
    if(this.lastTime && now-this.lastTime>250) this.cancel();
    this.lastTime=now;
    if(this.menu) {
      if(this.menu.owner===null) {
        // A mouse-opened menu also accepts a hand: establish its neutral
        // vertical position before allowing a fresh tap. An already held pinch cannot select.
        if(hands.length===1 && !hands[0].pinched) {
          this.menu.owner=hands[0].id;
          this.menu.startY=hands[0].palm.y;
          this.menu.tapArmed=true;
        }
        return;
      }
      const hand=hands.find(h=>h.id===this.menu!.owner);
      if(!hand) { this.cancel(); return; }
      // Capture the highlighted choice at contact. Confirm a short stable pinch
      // without depending on a clean release frame; quick releases also select.
      if(hand.pinched) {
        if(this.menu.tapArmed) {
          this.menu.tap={mode:this.menu.selection,since:now};
          this.menu.tapArmed=false;
        }
        const tap=this.menu.tap;
        if(tap?.mode && now-tap.since>=80) this.select(tap.mode,now,hand.palm);
        return;
      }
      if(!this.menu.tapArmed && !this.menu.tap) {
        this.menu.startY=hand.palm.y;this.menu.offsetY=0;
      }
      this.menu.tapArmed=true;
      if(this.menu.tap) {
        const tap=this.menu.tap;
        this.menu.tap=null;
        if(tap.mode && now-tap.since>=20 && now-tap.since<=1000) this.select(tap.mode,now,hand.palm);
        return;
      }
      // Vertical palm motion selects a row. A neutral dead zone prevents jitter
      // and preserves the highlight as the hand relaxes before a selection tap.
      const offset=hand.palm.y-this.menu.startY;
      this.menu.offsetY+=(offset-this.menu.offsetY)*(1-Math.exp(-dt/40));
      this.menu.selection=this.menu.offsetY < -.065 ? this.choices[0]
        : this.menu.offsetY > .065 ? this.choices[1] : this.menu.selection;
      return;
    }
    // Fists are excluded by VisionGestures, so exactly one active hand may
    // start/continue a hold, whether the other is absent or in a fist.
    if(hands.length!==1) { this.candidate=null; return; }
    // Brief pose flicker pauses progress, rather than erasing the hold. Actual
    // hand loss, pinch, or sideways swipe cancels immediately.
    const qualifies = (h: Hand) => h.wheelPalm && !h.pinched && !h.swipePose;
    let hand = hands.find(h=>h.id===this.candidate?.id);
    if(this.candidate && (!hand || hand.pinched || hand.swipePose || (now-this.candidate.lastValid>180 && this.candidate.lastValid!==previousTime))) this.candidate=null;
    if(!this.candidate) {
      hand=hands.find(qualifies);
      if(hand) this.candidate={id:hand.id,elapsed:0,lastValid:now};
    } else if(hand && qualifies(hand)) {
      // Do not count intervals containing an unrecognized pose toward 1.5s.
      if(this.candidate.lastValid===previousTime) this.candidate.elapsed+=dt;
      this.candidate.lastValid=now;
    }
    if(hand && qualifies(hand) && this.candidate && this.candidate.elapsed>=PALM_HOLD_MS) {
      this.open(hand.palm,hand.id);
    }
  }
  get holdProgress() { return this.candidate ? Math.min(1, this.candidate.elapsed/PALM_HOLD_MS) : 0; }
  get gesturePending() { return this.candidate!==null; }
  get triggerHint() { return this.candidate ? `Hold palm open · ${Math.ceil((1-this.holdProgress)*15)/10}s` : null; }
  get paused() { return this.mode==='drawing' || this.menu!==null || this.candidate!==null; }
}
