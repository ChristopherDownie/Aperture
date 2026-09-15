import { fieldHorizontalSpan, type FieldWindow } from './vision-field-geometry.ts';
export type PressureCandle={x:number;top:number;bottom:number;high:number;low:number;close:number;volume?:number;forming?:boolean};
export function candlePressure(bar:Pick<PressureCandle,'high'|'low'|'close'|'volume'>) {
  const {high,low,close,volume}=bar;
  if(![high,low,close].every(Number.isFinite)||high<low||volume===undefined||!Number.isFinite(volume)||volume<0) return null;
  const position=high===low?0:Math.max(-1,Math.min(1,(2*close-high-low)/(high-low)));
  return {volume,delta:volume*position};
}
export function pressureHeatmap(bars:PressureCandle[],rect:FieldWindow) {
  // Transpose the polygon to intersect each candle's vertical high-low span.
  const transposed={x:rect.y,y:rect.x,width:rect.height,height:rect.width,corners:rect.corners?.map(p=>({x:p.y,y:p.x}))};
  const cells=Array.from({length:24},()=>({volume:0,delta:0,count:0,missing:0}));
  let count=0,missing=0,volume=0,delta=0,forming=false;
  for(const bar of bars) {
    const span=fieldHorizontalSpan(transposed,bar.x);
    if(!span || ![bar.top,bar.bottom].every(Number.isFinite)||bar.bottom<span[0]||bar.top>span[1]) continue;
    const index=Math.max(0,Math.min(23,Math.floor((bar.x-rect.x)/Math.max(1,rect.width)*24))),cell=cells[index];
    count++;forming ||= Boolean(bar.forming);
    const estimate=candlePressure(bar);
    if(!estimate) {missing++;cell.missing++;continue;}
    cell.count++;cell.volume+=estimate.volume;cell.delta+=estimate.delta;
    volume+=estimate.volume;delta+=estimate.delta;
  }
  return {cells,count,missing,volume,delta,bias:volume>0?delta/volume:0,forming};
}

