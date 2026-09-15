import { fieldHorizontalSpan, type FieldWindow } from './vision-field-geometry.ts';
export type StructureBar = { time:number; high:number; low:number; close:number };
export type StructureLevel = {
  from:number; to:number; price:number; direction:1|-1;
  label:'BOS'|'CHOCH'|'BREAK'|'SWING HIGH'|'SWING LOW'; broken:boolean;
};
export type ScreenStructureLevel = Omit<StructureLevel,'from'|'to'|'price'> & {x1:number;x2:number;y:number};

// Confirm pivots only after `strength` closed bars on their right. The last bar
// may still be forming, so it never confirms a pivot or break. This is our own
// swing-based model, not an implementation of LuxAlgo's proprietary settings.
export function marketStructure(bars:readonly StructureBar[],strength=5):StructureLevel[] {
  if(!Number.isInteger(strength)||strength<1) throw new RangeError('Swing strength must be a positive integer');
  const result:StructureLevel[]=[];
  let high:{index:number;price:number}|null=null,low:{index:number;price:number}|null=null;
  let trend:1|-1|0=0;
  for(let i=0;i<bars.length-1;i++) {
    const bar=bars[i];
    if(![bar.high,bar.low,bar.close].every(Number.isFinite)) { high=low=null;trend=0;continue; }
    const pivot=i-strength;
    if(pivot>=strength) {
      const p=bars[pivot];let isHigh=true,isLow=true;
      for(let j=pivot-strength;j<=i;j++) {
        if(j===pivot) continue;
        const b=bars[j];
        // For equal highs/lows, prefer the last candle in the plateau.
        if(!Number.isFinite(b.high)||(j<pivot?b.high>p.high:b.high>=p.high)) isHigh=false;
        if(!Number.isFinite(b.low)||(j<pivot?b.low<p.low:b.low<=p.low)) isLow=false;
      }
      if(isHigh && Number.isFinite(p.high)) high={index:pivot,price:p.high};
      if(isLow && Number.isFinite(p.low)) low={index:pivot,price:p.low};
    }
    const direction:1|-1|0=high && bar.close>high.price?1:low && bar.close<low.price?-1:0;
    if(direction) {
      const level=direction===1?high!:low!;
      result.push({from:level.index,to:i,price:level.price,direction,
        label:trend===0?'BREAK':trend===direction?'BOS':'CHOCH',broken:true});
      trend=direction;
      if(direction===1) high=null;else low=null;
    }
  }
  if(high) result.push({from:high.index,to:bars.length-2,price:high.price,direction:1,label:'SWING HIGH',broken:false});
  if(low) result.push({from:low.index,to:bars.length-2,price:low.price,direction:-1,label:'SWING LOW',broken:false});
  return result;
}

// Compare closed-bar values when Vela renders, including in-place historical
// corrections. Box motion and effect animation only read the cached result.
export class StructureCache {
  private closed:StructureBar[]=[];
  levels:StructureLevel[]=[];
  update(bars:readonly StructureBar[]) {
    const length=Math.max(0,bars.length-1);
    const changed=length!==this.closed.length || this.closed.some((b,i)=>
      b.time!==bars[i].time || b.high!==bars[i].high || b.low!==bars[i].low || b.close!==bars[i].close);
    if(changed) {
      this.closed=bars.slice(0,length).map(b=>({time:b.time,high:b.high,low:b.low,close:b.close}));
      this.levels=marketStructure(bars);
    }
    return this.levels;
  }
}

export function structureInWindow(levels:ScreenStructureLevel[],rect:FieldWindow) {
  return levels.flatMap(l=>{
    const span=fieldHorizontalSpan(rect,l.y);
    if(!span || l.x2<span[0] || l.x1>span[1]) return [];
    return [{...l,x1:Math.max(span[0],l.x1)-rect.x,x2:Math.min(span[1],l.x2)-rect.x,y:l.y-rect.y}];
  }).slice(-48);
}
