import type { ScreenGapZone } from './fair-value-gaps';
import { insideField, fieldHorizontalSpan, glassPoint, type FieldWindow } from './vision-field-geometry.ts';
import { structureInWindow, type ScreenStructureLevel } from './market-structure.ts';
export type CandleNode = { x:number; y:number; high:number; low:number; up:boolean };
type Window = FieldWindow;
type Spark = { x:number; y:number; vx:number; vy:number; life:number; max:number };
export function energyNodes(nodes:CandleNode[], rect:Window) {
  const inside=nodes.filter(n=>insideField(n,rect));
  // Evenly sample dense charts: the effect cost must not grow with candle count.
  const selected=inside.length<=72?inside:Array.from({length:72},(_,i)=>inside[Math.round(i*(inside.length-1)/71)]);
  return selected.map(n=>({...n,x:n.x-rect.x,y:n.y-rect.y,high:n.high-rect.y,low:n.low-rect.y}));
}
export function energySurface(width:number,height:number,dpr:number) {
  // Quantize dimensions to avoid reallocating a large bitmap for every fingertip
  // tremor. One million pixels total, independent of display size and Retina DPR.
  const w=Math.ceil(Math.max(1,width)/32)*32,h=Math.ceil(Math.max(1,height)/32)*32;
  const scale=Math.min(Math.max(1,dpr),1.5,Math.sqrt(1_000_000/(w*h)));
  return {width:Math.max(1,Math.floor(w*scale)),height:Math.max(1,Math.floor(h*scale))};
}

export class VisionEnergy {
  private ctx:CanvasRenderingContext2D;
  private frame=0;
  private previous=0;
  private rect:Window|null=null;
  private sparks:Spark[]=[];
  private motion=matchMedia('(prefers-reduced-motion: reduce)');
  private canvas:HTMLCanvasElement;
  private getNodes:()=>CandleNode[];
  private getGaps:()=>ScreenGapZone[];
  private getStructure:()=>ScreenStructureLevel[];
  constructor(canvas:HTMLCanvasElement,getNodes:()=>CandleNode[],getStructure:()=>ScreenStructureLevel[]=()=>[],getGaps:()=>ScreenGapZone[]=()=>[]) {
    this.getGaps=getGaps;
    this.getStructure=getStructure;
    this.canvas=canvas;this.getNodes=getNodes;
    this.ctx=canvas.getContext('2d')!;
  }
  update(rect:Window|null) {
    if(!rect) { this.stop(); return; }
    if(this.rect) {
      // Keep existing embers aligned with the chart when the window moves.
      const dx=this.rect.x-rect.x,dy=this.rect.y-rect.y;
      this.sparks.forEach(p=>{p.x+=dx;p.y+=dy;});
    }
    this.rect=rect;
    if(!this.frame) this.frame=requestAnimationFrame(this.paint);
  }
  stop() {
    cancelAnimationFrame(this.frame);this.frame=0;this.previous=0;this.rect=null;this.sparks=[];
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  }
  private paint=(now:number)=>{
    this.frame=0;
    const r=this.rect;if(!r) return;
    if(this.previous && now-this.previous<33) {
      this.frame=requestAnimationFrame(this.paint);return;
    }
    const dt=Math.min(.05,this.previous?(now-this.previous)/1000:.016);this.previous=now;
    const surface=energySurface(r.width,r.height,devicePixelRatio||1);
    if(this.canvas.width!==surface.width) this.canvas.width=surface.width;
    if(this.canvas.height!==surface.height) this.canvas.height=surface.height;
    const c=this.ctx;c.setTransform(surface.width/r.width,0,0,surface.height/r.height,0,0);c.clearRect(0,0,r.width,r.height);
    const corners=r.corners?.map(p=>({x:p.x-r.x,y:p.y-r.y})) ?? [{x:0,y:0},{x:r.width,y:0},{x:r.width,y:r.height},{x:0,y:r.height}];
    const trace=()=>{c.beginPath();corners.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();};
    c.save();trace();c.clip();
    const nodes=energyNodes(this.getNodes(),r);
    const tilt=r.tilt??0,weights=r.weights??[1,1,1,1];
    // A faint glass face and a grid projected on the same plane make depth
    // visible without transforming or obscuring the underlying chart data.
    const glass=c.createLinearGradient(0,0,r.width,r.height);
    glass.addColorStop(0,'#91e5ff26');glass.addColorStop(.45,'#12334b0b');glass.addColorStop(1,'#916bdb26');
    c.fillStyle=glass;c.fillRect(0,0,r.width,r.height);
    c.strokeStyle='#99e7ff24';c.lineWidth=.6;c.beginPath();
    for(let i=1;i<12;i++) {
      for(const vertical of [true,false]) {
        const a=glassPoint(corners,weights,vertical?i/12:0,vertical?0:i/12);
        const b=glassPoint(corners,weights,vertical?i/12:1,vertical?1:i/12);
        c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);
      }
    }
    c.stroke();
    const shine=c.createLinearGradient(r.width*(.15+tilt*.2),0,r.width*(.75+tilt*.2),r.height);
    shine.addColorStop(0,'#dcfaff00');shine.addColorStop(.42,'#dcfaff00');shine.addColorStop(.49,'#dcfaff18');shine.addColorStop(.52,'#ffffff24');shine.addColorStop(.58,'#dcfaff00');shine.addColorStop(1,'#dcfaff00');
    c.fillStyle=shine;c.fillRect(0,0,r.width,r.height);c.globalCompositeOperation='lighter';
    const time=this.motion.matches?0:now/1000;
    // Moving emitters around all four edges keep the whole window energized.
    const ports=Array.from({length:8},(_,i)=>{
      const u=.12+.76*(.5+.5*Math.sin(time*.8+i*2.3));
      const a=corners[i%4],b=corners[(i+1)%4];
      return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};
    });
    ports.forEach((port,i)=>{
      const target=nodes.length ? nodes[(i*13+Math.floor(time*3))%nodes.length] : ports[(i+3)%ports.length];
      c.strokeStyle=i%2?'#b08dff66':'#4feaff77';c.lineWidth=.8;

      c.beginPath();c.moveTo(port.x,port.y);
      for(let j=1;j<=7;j++) {
        const t=j/7, bend=j===7?0:Math.sin(time*19+i*3+j*7)*7;
        c.lineTo(Math.max(1,Math.min(r.width-1,port.x+(target.x-port.x)*t+bend)),Math.max(1,Math.min(r.height-1,port.y+(target.y-port.y)*t-bend)));
      }
      c.stroke();
      c.fillStyle='#d7fbff';c.fillRect(port.x-1.5,port.y-1.5,3,3);
      if(!this.motion.matches) {
        const t=(time*1.7+i*.13)%1;
        c.fillStyle='#c4f9ff';c.beginPath();c.arc(port.x+(target.x-port.x)*t,port.y+(target.y-port.y)*t,2,0,Math.PI*2);c.fill();
        if(this.sparks.length<140 && Math.random()<dt*14) {
          const angle=Math.atan2(target.y-port.y,target.x-port.x)+(Math.random()-.5)*.6;
          const speed=100+Math.random()*160,life=.25+Math.random()*.4;
          this.sparks.push({x:port.x,y:port.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life,max:life});
        }
      }
    });
    nodes.forEach((n,i)=>{
      // Nearby candle closes become a connected constellation with moving pulses.
      for(const offset of [1,3]) {
        const next=nodes[i+offset];if(!next || Math.hypot(next.x-n.x,next.y-n.y)>180) continue;
        c.strokeStyle=offset===1?'#58efff88':'#b08dff33';c.lineWidth=offset===1?1:.6;
        c.beginPath();c.moveTo(n.x,n.y);c.lineTo(next.x,next.y);c.stroke();
        if(!this.motion.matches && offset===1) {
          const t=(time*.65+i*.17)%1;
          c.fillStyle='#b5fbff';c.beginPath();c.arc(n.x+(next.x-n.x)*t,n.y+(next.y-n.y)*t,1.6,0,Math.PI*2);c.fill();
        }
      }
      c.strokeStyle='#5cf5ff55';c.lineWidth=1;c.beginPath();c.moveTo(n.x,n.high);c.lineTo(n.x,n.low);c.stroke();
      c.fillStyle='#45f4ff22';c.beginPath();c.arc(n.x,n.y,5,0,Math.PI*2);c.fill();c.strokeStyle='#68f3ff';
      c.beginPath();c.arc(n.x,n.y,3,0,Math.PI*2);c.stroke();
      if(!this.motion.matches && this.sparks.length<140 && Math.random()<dt*5) {
        const life=.3+Math.random()*.6;
        this.sparks.push({x:n.x,y:n.y,vx:(Math.random()-.5)*160,vy:-40-Math.random()*160,life,max:life});
      }
      if(!this.motion.matches) {
        // A compact flame plume rooted on each candle close.
        const height=10+8*(.5+.5*Math.sin(time*8+i*2.4));
        const gradient=c.createLinearGradient(n.x,n.y,n.x,n.y-height);
        gradient.addColorStop(0,'#fff4aa99');gradient.addColorStop(.35,'#ff782888');gradient.addColorStop(1,'#ff321000');
        c.fillStyle=gradient;c.beginPath();c.moveTo(n.x-4,n.y);c.quadraticCurveTo(n.x-3,n.y-height*.6,n.x+Math.sin(time*4+i)*3,n.y-height);c.quadraticCurveTo(n.x+5,n.y-height*.5,n.x+4,n.y);c.fill();
      }
    });
    if(this.motion.matches) this.sparks=[];
    this.sparks=this.sparks.filter(p=>p.life>0 && p.x>=0 && p.x<=r.width && p.y>=0 && p.y<=r.height);
    for(const p of this.sparks) {
      p.life-=dt;p.vy+=90*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
      c.globalAlpha=Math.max(0,p.life/p.max);c.strokeStyle=p.life/p.max>.65?'#fff6bd':'#ff7a27';c.lineWidth=1.2;
      c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*.026,p.y-p.vy*.026);c.stroke();
    }
    c.globalAlpha=1;c.globalCompositeOperation='source-over';
    // Gap zones remain in price/time space, clipped by the same moving glass.
    const gaps=this.getGaps().filter(z=>z.x2>=r.x && z.x1<=r.x+r.width && z.bottom>=r.y && z.top<=r.y+r.height).slice(-32);
    c.font='600 10px ui-monospace, SFMono-Regular, monospace';c.textBaseline='middle';
    const gapLabels:{x:number;y:number;width:number}[]=[];
    for(const z of gaps) {
      const left=Math.max(0,z.x1-r.x),right=Math.min(r.width,z.x2-r.x);
      const top=z.top-r.y,bottom=z.bottom-r.y,mid=(top+bottom)/2;
      if(right<=left || bottom<=top) continue;
      const color=z.direction===1?'#67eedb':'#ffaf76';
      c.save();c.beginPath();c.rect(left,top,right-left,bottom-top);c.clip();
      const fill=c.createLinearGradient(0,top,0,bottom);
      fill.addColorStop(0,color+(z.filled?'10':'38'));fill.addColorStop(.5,color+(z.filled?'08':'12'));fill.addColorStop(1,color+(z.filled?'10':'38'));
      c.fillStyle=fill;c.fillRect(left,top,right-left,bottom-top);
      if(!z.filled && !this.motion.matches) {
        const x=left+((time*.18+z.x1*.001)%1)*(right-left);
        const beam=c.createLinearGradient(x-22,0,x+22,0);
        beam.addColorStop(0,color+'00');beam.addColorStop(.5,color+'22');beam.addColorStop(1,color+'00');
        c.fillStyle=beam;c.fillRect(x-22,top,44,bottom-top);
      }
      c.restore();
      c.strokeStyle=color+(z.filled?'44':'bb');c.lineWidth=1;c.setLineDash(z.filled?[2,4]:[]);
      c.strokeRect(left,top,right-left,bottom-top);
      c.setLineDash([4,5]);c.strokeStyle=color+(z.filled?'33':'99');
      c.beginPath();c.moveTo(left,mid);c.lineTo(right,mid);c.stroke();c.setLineDash([]);
      const text=`${z.direction===1?'BULL':'BEAR'} FVG${z.filled?' · FILLED':''}`;
      const width=c.measureText(text).width+12;
      const y=Math.max(12,Math.min(r.height-12,mid));
      const a=fieldHorizontalSpan(r,r.y+y-8),b=fieldHorizontalSpan(r,r.y+y+8);
      if(!a || !b) continue;
      const x=Math.max(left+4,a[0]-r.x+4,b[0]-r.x+4);
      const limit=Math.min(right-4,a[1]-r.x-4,b[1]-r.x-4);
      if(x+width>limit || gapLabels.some(l=>Math.abs(l.y-y)<18 && x<l.x+l.width && x+width>l.x)) continue;
      gapLabels.push({x,y,width});c.fillStyle='#08171dea';c.fillRect(x,y-8,width,16);
      c.fillStyle=color+(z.filled?'77':'ff');c.fillText(text,x+6,y);
    }
    // Price levels stay fixed to the candles; only the revealing window moves.
    const occupied:{x:number;y:number;width:number}[]=[];
    c.font='600 10px ui-monospace, SFMono-Regular, monospace';c.textBaseline='middle';
    for(const l of structureInWindow(this.getStructure(),r)) {
      const color=l.direction===1?'#71f3bd':'#ff91ad';
      c.strokeStyle='#07121de6';c.lineWidth=3;c.setLineDash([]);
      c.beginPath();c.moveTo(l.x1,l.y);c.lineTo(l.x2,l.y);c.stroke();
      c.strokeStyle=color;c.lineWidth=l.broken?1.5:1;c.setLineDash(l.broken?[]:[4,4]);
      c.beginPath();c.moveTo(l.x1,l.y);c.lineTo(l.x2,l.y);c.stroke();c.setLineDash([]);
      const width=c.measureText(l.label).width+12;
      if(r.width<width+8 || r.height<36) continue;
      let placement:{x:number;y:number}|null=null;
      for(const y of [l.y-10,l.y+10]) {
        const top=fieldHorizontalSpan(r,r.y+y-8),bottom=fieldHorizontalSpan(r,r.y+y+8);
        if(!top || !bottom) continue;
        const left=Math.max(top[0],bottom[0])-r.x+4,right=Math.min(top[1],bottom[1])-r.x-4;
        if(right-left<width) continue;
        const x=Math.max(left,Math.min(right-width,(l.x1+l.x2-width)/2));
        if(occupied.some(b=>Math.abs(b.y-y)<17 && x<b.x+b.width+4 && x+width>b.x-4)) continue;
        placement={x,y};break;
      }
      if(!placement) continue;
      const {x,y}=placement;
      occupied.push({x,y,width});c.fillStyle='#0b1726ed';c.fillRect(x,y-8,width,16);
      c.fillStyle=color;c.fillText(l.label,x+6,y);
    }

    c.restore();
    trace();c.strokeStyle='#5ab7da55';c.lineWidth=4;c.stroke();
    corners.forEach((p,i)=>{
      const next=corners[(i+1)%4];
      const brightness=(weights[i]+weights[(i+1)%4])/2;
      c.strokeStyle=brightness<1?'#d8fbffed':'#7795d3aa';c.lineWidth=brightness<1?1.8:1;
      c.beginPath();c.moveTo(p.x,p.y);c.lineTo(next.x,next.y);c.stroke();
    });
    for(const p of corners) { c.fillStyle='#e1fbff';c.fillRect(p.x-2,p.y-2,4,4); }
    if(!this.motion.matches) this.frame=requestAnimationFrame(this.paint);
  };
}
