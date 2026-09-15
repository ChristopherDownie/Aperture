import type { FieldWindow } from './vision-field-geometry.ts';
import { pressureHeatmap, type PressureCandle } from './vision-pressure-model.ts';
import { pressureSurface, pressureColor, surfaceContours, type PressureSurface } from './vision-pressure-surface.ts';
export { candlePressure, pressureHeatmap, type PressureCandle } from './vision-pressure-model.ts';

export class VisionPressure {
  private element:HTMLElement;
  private canvas:HTMLCanvasElement;
  private bitmap=document.createElement('canvas');
  private summary:HTMLElement;
  private caption:HTMLElement;
  private lastPaint=-Infinity;
  constructor() {
    this.element=document.createElement('aside');this.element.className='vision-pressure';this.element.hidden=true;
    this.element.setAttribute('aria-label','Estimated buy and sell pressure for candles under the glass');
    this.element.innerHTML='<header><strong>EST. PRESSURE TERRAIN</strong><span class="vision-pressure-bias"></span></header><canvas class="vision-pressure-surface" aria-hidden="true"></canvas><div class="vision-pressure-scale"><span>Sell</span><i></i><span>Buy</span><span class="vision-pressure-empty">Blank: no samples</span></div><footer><span class="vision-pressure-caption"></span><span>Smoothed estimate · not trade delta</span></footer>';
    this.canvas=this.element.querySelector('canvas')!;
    this.summary=this.element.querySelector('.vision-pressure-bias')!;this.caption=this.element.querySelector('.vision-pressure-caption')!;
    document.body.append(this.element);
  }
  update(rect:FieldWindow,plot:{left:number;top:number;width:number;height:number},getBars:()=>PressureCandle[],now=performance.now()) {
    this.element.hidden=false;
    const width=Math.min(420,Math.max(300,rect.width),Math.max(0,plot.width-16));
    const left=Math.max(plot.left+8,Math.min(plot.left+plot.width-width-8,plot.left+rect.x+rect.width/2-width/2));
    const top=Math.max(plot.top+8,plot.top+rect.y-212);
    this.element.style.left=`${left}px`;this.element.style.top=`${top}px`;this.element.style.width=`${width}px`;
    if(now-this.lastPaint<150) return;this.lastPaint=now;
    const bars=getBars();
    const result=pressureHeatmap(bars,rect);
    this.paintSurface(pressureSurface(bars,rect),width-24);
    const known=result.count-result.missing;
    this.summary.textContent=!result.count?'No candles':!known?'No volume':result.volume===0?'No traded volume':Math.abs(result.bias)<.005?'Balanced':`${result.bias>0?'+':''}${Math.round(result.bias*100)}% bias`;
    this.summary.dataset.side=result.bias>=0?'buy':'sell';
    this.caption.textContent=`${result.count} candles${result.missing?` · ${result.missing} missing volume`:''}${result.forming?' · live bar':''}`;
    this.element.setAttribute('aria-label',`Estimated candle pressure: ${this.summary.textContent}. ${this.caption.textContent}. Candle-based estimate, not actual trade delta. Smoothed contours interpolate candle pressure across the covered area. Older candles are left, higher prices are above.`);
  }
  private paintSurface(surface:PressureSurface,width:number) {
    const height=136,dpr=Math.min(devicePixelRatio||1,1.5);
    const w=Math.max(1,Math.round(width*dpr)),h=Math.round(height*dpr);
    if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;
    const c=this.canvas.getContext('2d')!;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);
    this.bitmap.width=surface.width;this.bitmap.height=surface.height;
    const bitmap=this.bitmap.getContext('2d')!,pixels=bitmap.createImageData(surface.width,surface.height);
    surface.values.forEach((v,i)=>{
      if(!Number.isFinite(v))return;
      const color=pressureColor(v);pixels.data[i*4]=color[0];pixels.data[i*4+1]=color[1];pixels.data[i*4+2]=color[2];pixels.data[i*4+3]=Math.round(255*surface.coverage[i]);
    });
    bitmap.putImageData(pixels,0,0);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    c.drawImage(this.bitmap,0,0,w,h);
    c.setTransform(w/(surface.width-1),0,0,h/(surface.height-1),0,0);
    for(let i=-18;i<=18;i++) {
      c.beginPath();
      for(const [x1,y1,x2,y2] of surfaceContours(surface,i*.05)) {c.moveTo(x1,y1);c.lineTo(x2,y2);}
      c.strokeStyle=i%4===0?'#fff3d880':'#f4eaff40';c.lineWidth=(i%4===0?.75:.45)*(surface.width-1)/width;c.stroke();
    }
  }
  hide() {this.element.hidden=true;this.lastPaint=-Infinity;}
  destroy() {this.element.remove();}
}
