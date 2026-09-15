import type { StructureBar } from './market-structure.ts';
export type GapZone = { from:number; to:number; high:number; low:number; direction:1|-1; filled:boolean };
export type ScreenGapZone = Omit<GapZone,'from'|'to'|'high'|'low'> & { x1:number; x2:number; top:number; bottom:number };

// Original local implementation of the LuxAlgo Library's three-candle concept:
// https://www.luxalgo.com/library/concept/fair-value-gap/
// No size/displacement filter in this first version. Only closed bars form or
// fill zones. A wick reaching the far boundary counts as a complete fill.
export function fairValueGaps(bars:readonly StructureBar[]):GapZone[] {
  const zones:GapZone[]=[];
  const valid=(b:StructureBar)=>[b.high,b.low,b.close].every(Number.isFinite) && b.high>=b.low && b.close>=b.low && b.close<=b.high;
  for(let i=0;i<bars.length-1;i++) {
    const b=bars[i];
    if(!valid(b)) continue;
    for(const z of zones) {
      if(z.filled) continue;
      z.to=i;
      if(z.direction===1 ? b.low<=z.low : b.high>=z.high) z.filled=true;
    }
    if(i<2 || !valid(bars[i-2]) || !valid(bars[i-1])) continue;
    const a=bars[i-2];
    if(b.low>a.high) zones.push({from:i-2,to:i,low:a.high,high:b.low,direction:1,filled:false});
    else if(b.high<a.low) zones.push({from:i-2,to:i,low:b.high,high:a.low,direction:-1,filled:false});
    // Bounded history and work even on long feeds; keep the most recent zones.
    if(zones.length>240) zones.shift();
  }
  return zones;
}
export class GapCache {
  private closed:StructureBar[]=[];
  zones:GapZone[]=[];
  update(bars:readonly StructureBar[]) {
    const length=Math.max(0,bars.length-1);
    if(length!==this.closed.length || this.closed.some((b,i)=>b.time!==bars[i].time || b.high!==bars[i].high || b.low!==bars[i].low || b.close!==bars[i].close)) {
      this.closed=bars.slice(0,length).map(b=>({time:b.time,high:b.high,low:b.low,close:b.close}));
      this.zones=fairValueGaps(bars);
    }
    return this.zones;
  }
}
