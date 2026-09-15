import { fieldHorizontalSpan, type FieldWindow } from './vision-field-geometry.ts';
import { candlePressure, type PressureCandle } from './vision-pressure-model.ts';
export const SURFACE_WIDTH=96,SURFACE_HEIGHT=40;
export type PressureSurface={width:number;height:number;values:Float32Array;coverage:Float32Array};
function blur(source:Float64Array,width:number,height:number) {
  const radius=9,sigma=3.4,kernel=Array.from({length:radius*2+1},(_,i)=>Math.exp(-.5*((i-radius)/sigma)**2));
  const horizontal=new Float64Array(source.length),result=new Float64Array(source.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let k=-radius;k<=radius;k++) {
    if(x+k>=0&&x+k<width)horizontal[y*width+x]+=source[y*width+x+k]*kernel[k+radius];
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let k=-radius;k<=radius;k++) {
    if(y+k>=0&&y+k<height)result[y*width+x]+=horizontal[(y+k)*width+x]*kernel[k+radius];
  }
  return result;
}
// Whole-candle pressure is spread around its price-range midpoint. This is an
// interpolated visual surface, never an assertion of executed volume by price.
export function pressureSurface(bars:PressureCandle[],rect:FieldWindow):PressureSurface {
  const width=SURFACE_WIDTH,height=SURFACE_HEIGHT;
  const volumes=new Float64Array(width*height),deltas=new Float64Array(width*height);
  const transposed={x:rect.y,y:rect.x,width:rect.height,height:rect.width,corners:rect.corners?.map(p=>({x:p.y,y:p.x}))};
  for(const bar of bars) {
    const estimate=candlePressure(bar),span=fieldHorizontalSpan(transposed,bar.x);
    if(!estimate || !estimate.volume || !span || ![bar.top,bar.bottom].every(Number.isFinite) || bar.bottom<span[0] || bar.top>span[1])continue;
    const y=(Math.max(span[0],bar.top)+Math.min(span[1],bar.bottom))/2;
    const px=Math.max(0,Math.min(width-1,(bar.x-rect.x)/Math.max(1,rect.width)*(width-1)));
    const py=Math.max(0,Math.min(height-1,(y-rect.y)/Math.max(1,rect.height)*(height-1)));
    // Bilinear deposition avoids a sudden jump between cells as the glass moves.
    const x0=Math.floor(px),y0=Math.floor(py),fx=px-x0,fy=py-y0;
    for(const [dx,dy,weight] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]) {
      if(x0+dx>=width||y0+dy>=height)continue;
      const i=(y0+dy)*width+x0+dx;volumes[i]+=estimate.volume*weight;deltas[i]+=estimate.delta*weight;
    }
  }
  const smoothVolume=blur(volumes,width,height),smoothDelta=blur(deltas,width,height);
  const maximum=Math.max(...smoothVolume),values=new Float32Array(width*height),coverage=new Float32Array(width*height);
  for(let i=0;i<values.length;i++) {
    if(smoothVolume[i]<=maximum*.0005 || !maximum) {values[i]=NaN;continue;}
    values[i]=Math.max(-1,Math.min(1,smoothDelta[i]/smoothVolume[i]));
    coverage[i]=Math.min(1,smoothVolume[i]/(maximum*.025));
  }
  return {width,height,values,coverage};
}
const palette=[[19,7,46],[51,14,100],[25,65,119],[33,130,131],[106,165,74],[235,198,36],[249,109,14],[204,29,43]];
export function pressureColor(value:number):[number,number,number] {
  const t=Math.max(0,Math.min(1,(value+1)/2))*(palette.length-1),i=Math.min(palette.length-2,Math.floor(t)),f=t-i;
  return palette[i].map((v,j)=>Math.round(v+(palette[i+1][j]-v)*f)) as [number,number,number];
}
export function surfaceContours(surface:PressureSurface,level:number) {
  const {width,height,values,coverage}=surface,segments:number[][]=[];
  for(let y=0;y<height-1;y++)for(let x=0;x<width-1;x++) {
    const ids=[y*width+x,y*width+x+1,(y+1)*width+x+1,(y+1)*width+x];
    if(ids.some(i=>!Number.isFinite(values[i]) || coverage[i]<.35))continue;
    const points=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],hits:number[][]=[];
    for(let e=0;e<4;e++) {
      const next=(e+1)%4,a=values[ids[e]],b=values[ids[next]];
      if((a<level)===(b<level))continue;
      const t=(level-a)/(b-a);hits.push([points[e][0]+(points[next][0]-points[e][0])*t,points[e][1]+(points[next][1]-points[e][1])*t]);
    }
    // Ambiguous saddle cells choose connectivity using their center value.
    if(hits.length===4 && (ids.reduce((sum,i)=>sum+values[i],0)/4>=level)!==(values[ids[0]]>=level)) hits.push(hits.shift()!);
    for(let i=0;i+1<hits.length;i+=2)segments.push([...hits[i],...hits[i+1]]);
  }
  return segments;
}
