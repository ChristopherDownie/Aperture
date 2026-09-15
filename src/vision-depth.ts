import type { Point, WorldPoint } from './vision-gestures';
// Image size divided by the hand-local projected skeleton size compensates for
// palm orientation. Only relative changes since grabbing are used: this is a
// visual depth cue, not a measured camera distance or shared world coordinate.
export function palmDepthScale(points:Point[],world:WorldPoint[]|null,aspect:number):number|undefined {
  if(!world) return undefined;
  const ratios=[];
  for(const [a,b] of [[0,5],[0,9],[0,13],[0,17],[5,17]]) {
    const w=world[a],v=world[b];
    const projected=Math.hypot(w.x-v.x,w.y-v.y),length=Math.hypot(w.x-v.x,w.y-v.y,w.z-v.z);
    if(projected<length*.4 || projected<.0001) continue;
    const image=Math.hypot((points[a].x-points[b].x)*aspect,points[a].y-points[b].y);
    if(image>.008) ratios.push(image/projected);
  }
  if(ratios.length<3) return undefined;
  ratios.sort((a,b)=>a-b);return ratios[Math.floor(ratios.length/2)];
}
export function depthTilt(scales:[number,number],baseline:[number,number]) {
  if(![...scales,...baseline].every(n=>Number.isFinite(n)&&n>0)) return 0;
  const difference=Math.log(scales[1]/baseline[1])-Math.log(scales[0]/baseline[0]);
  return Math.sign(difference)*Math.min(.85,Math.max(0,Math.abs(difference)-.07)*1.8);
}
