import { GapCache, type ScreenGapZone } from './fair-value-gaps';
import type { PressureCandle } from './vision-pressure';
import type { FieldWindow } from './vision-field-geometry';
import { StructureCache, type ScreenStructureLevel } from './market-structure';
import { registerRendererLayer, type RendererLayerArgs } from '@luxalgo/vela/plugin';

const views = new Map<HTMLCanvasElement, RendererLayerArgs>();
const structures = new Map<HTMLCanvasElement, StructureCache>();
const gaps = new Map<HTMLCanvasElement, GapCache>();
const listeners = new Set<() => void>();
export function onVisionGeometryChange(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
// Use Vela's public renderer layer coordinates, including empty space past the
// last candle. getVisibleRange() alone clips to bars and would shift the target.
registerRendererLayer({
  id: 'vision.coordinates',
  placement: 'above-data',
  create: () => {
    let canvas: HTMLCanvasElement;
    return {
      mount: (element) => { canvas = element; structures.set(canvas,new StructureCache()); gaps.set(canvas,new GapCache()); },
      render: (args) => { views.set(canvas, args); structures.get(canvas)!.update(args.bars); gaps.get(canvas)!.update(args.bars); listeners.forEach(listener=>listener()); },
      destroy: () => { views.delete(canvas); structures.delete(canvas); gaps.delete(canvas); },
    };
  },
});

export function visionGeometry(host: HTMLElement) {
  for (const [canvas, { coords, bounds }] of views) {
    if (!host.contains(canvas) || !coords.barCount) continue;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || bounds.height <= 0) return null;
    return { left: rect.left, top: rect.top + bounds.top, width: coords.width, height: bounds.height, range: coords.visibleTimeRange() };
  }
  return null;
}

// Actual candle anchors in plot pixels, using the same scale as Vela's renderer.
export function visionCandleNodes(host: HTMLElement) {
  for (const [canvas, { coords, bounds, scale, bars }] of views) {
    if (!host.contains(canvas)) continue;
    const visible=coords.visibleLogicalRange();
    const nodes=[];
    const first=Math.max(0,Math.floor(visible.from));
    const last=Math.min(bars.length-1,Math.ceil(visible.to));
    const step=Math.max(1,Math.ceil((last-first+1)/240));
    for(let i=first;i<=last;i+=step) {
      const bar=bars[i];
      const x=coords.logicalToX(i), y=coords.priceToY(bar.close,scale,bounds)-bounds.top;
      const high=coords.priceToY(bar.high,scale,bounds)-bounds.top;
      const low=coords.priceToY(bar.low,scale,bounds)-bounds.top;
      if([x,y,high,low].every(Number.isFinite)) nodes.push({x,y,high,low,up:bar.close>=bar.open});
    }
    return nodes;
  }
  return [];
}

export function visionStructureLevels(host:HTMLElement):ScreenStructureLevel[] {
  for(const [canvas,{coords,bounds,scale}] of views) {
    if(!host.contains(canvas)) continue;
    const visible=coords.visibleLogicalRange();
    return (structures.get(canvas)?.levels ?? [])
      .filter(l=>l.to>=visible.from && l.from<=visible.to)
      .map(({from,to,price,...level})=>({...level,x1:coords.logicalToX(from),x2:coords.logicalToX(to),y:coords.priceToY(price,scale,bounds)-bounds.top}))
      .filter(l=>[l.x1,l.x2,l.y].every(Number.isFinite));
  }
  return [];
}

// Unlike decorative energy anchors, pressure includes every intersecting candle.
export function visionPressureCandles(host:HTMLElement,rect:FieldWindow):PressureCandle[] {
  for(const [canvas,{coords,bounds,scale,bars}] of views) {
    if(!host.contains(canvas)) continue;
    const first=Math.max(0,Math.floor(coords.xToLogical(rect.x)));
    const last=Math.min(bars.length-1,Math.ceil(coords.xToLogical(rect.x+rect.width)));
    const result:PressureCandle[]=[];
    for(let i=first;i<=last;i++) {
      const b=bars[i],high=coords.priceToY(b.high,scale,bounds)-bounds.top,low=coords.priceToY(b.low,scale,bounds)-bounds.top;
      const x=coords.logicalToX(i);
      if([x,high,low].every(Number.isFinite)) result.push({x,top:Math.min(high,low),bottom:Math.max(high,low),high:b.high,low:b.low,close:b.close,volume:b.volume,forming:i===bars.length-1});
    }
    return result;
  }
  return [];
}

export function visionGapZones(host:HTMLElement):ScreenGapZone[] {
  for(const [canvas,{coords,bounds,scale}] of views) {
    if(!host.contains(canvas)) continue;
    const visible=coords.visibleLogicalRange();
    return (gaps.get(canvas)?.zones ?? [])
      .filter(z=>z.to>=visible.from && z.from<=visible.to)
      .map(({from,to,high,low,...z})=>({...z,x1:coords.logicalToX(from),x2:coords.logicalToX(to),
        top:coords.priceToY(high,scale,bounds)-bounds.top,bottom:coords.priceToY(low,scale,bounds)-bounds.top}))
      .filter(z=>[z.x1,z.x2,z.top,z.bottom].every(Number.isFinite));
  }
  return [];
}
