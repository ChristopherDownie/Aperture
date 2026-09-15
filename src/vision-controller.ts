import { INSPECT_CONCEPTS, conceptName, FVG_SOURCE } from './inspect-concepts';
import { VisionPressure } from './vision-pressure';
import { VisionEnergy } from './vision-energy';
import type { VelaWorkspace } from '@luxalgo/vela/workspace';
import { VisionGestures, type Point, type WorldPoint, type Hand } from './vision-gestures';
import { VisionModes, type MenuChoice } from './vision-modes';
import { VisionFrames } from './vision-frames';
import { visionGeometry, onVisionGeometryChange, visionCandleNodes, visionStructureLevels, visionGapZones, visionPressureCandles } from './vision-geometry';

type Result = { type: 'result'; timestamp: number; landmarks: Point[][]; worldLandmarks?: WorldPoint[][]; handedness: { categoryName: string; score: number }[][] };
const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

export function createVisionController(workspace: VelaWorkspace, setActive: (active: boolean) => void) {
  const gestures = new VisionGestures();
  const modes = new VisionModes();
  const drawingFrames = new VisionFrames();
  const panel = document.createElement('aside');
  panel.className = 'vision-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Vision controls');
  panel.innerHTML = `<header><strong><span class="vision-led"></span>Vision</strong><button type="button" aria-label="Stop Vision">Stop ✕</button></header>
    <div class="vision-camera"><video autoplay playsinline muted></video><canvas width="640" height="480"></canvas><div class="vision-camera-label">LOCAL CAMERA <span class="vision-rate"></span></div></div>
    <div class="vision-details"><button type="button" class="vision-mode-button" aria-label="Choose Vision mode">Mode · Navigate ▾</button><p class="vision-state" role="status" aria-live="polite">Starting…</p><progress class="vision-palm-hold" aria-label="Open palm hold progress" max="1" value="0" hidden></progress><div class="vision-hand-states"><span data-hand="Left">Left · not visible</span><span data-hand="Right">Right · not visible</span></div><details class="vision-guide"><summary>Gesture guide</summary><p><b>Mode:</b> hold one fully open palm facing the camera for 1.5 seconds. Keep the other hand off-screen or in a fist. Swipe up for Navigate or down for Inspect, then touch thumb and index briefly to select. Inspect opens a second menu: swipe up for Market Structure or down for Fair Value Gaps, and tap again.</p><p><b>Scroll:</b> hold one hand upright, fingers up and edge toward the camera. Swipe left or right. Turn your palm forward to stop.</p><p><b>Fist:</b> switches that pointer off. Keep the fist in view and use your other hand. Open it to reactivate.</p><div class="vision-drawing-help"><p><b>Energy field:</b> pinch one hand and hold it, then pinch the other to activate. Keep both pinches closed while moving the window. Release either pinch to disconnect. Opposite corners follow your index fingertips. Raise one hand and lower the other to rotate; move apart to enlarge. Bring one hand closer to the camera to tilt the glass in depth. Each grab starts flat; the proportions stay fixed during the grab. Make a fist to dismiss.</p><p><b>Structure:</b> 5-bar confirmed swings. Solid BOS / CHOCH lines mark closing breaks; dashed levels are unbroken. The latest candle is excluded until the next bar arrives.</p><p><b>Fair Value Gaps:</b> three closed candles form a zone when the outer wicks do not overlap. Dashed lines mark the midpoint; a later wick reaching the far boundary fills the zone. No size filter. The newest candle is excluded. Displays up to 32 visible zones from the latest 240 gaps.</p><p class="vision-library-status">Library · local reference</p><a class="vision-library-source" href="https://www.luxalgo.com/library/concept/fair-value-gap/" target="_blank" rel="noopener noreferrer">LuxAlgo Library reference ↗</a><p><b>Pressure heatmap:</b> above the glass, cool-to-warm contours estimate buy/sell pressure from each candle’s close within its range, weighted by total volume. Older candles are on the left. It uses whole candles touched by the field, not actual trade delta or volume at a price level. The smooth terrain interpolates whole-candle estimates across the covered area; it is not measured volume at each price.</p><div class="vision-frame-actions"><button type="button" class="vision-frame-clear">Clear frame</button></div></div><p><b>Zoom:</b> open thumb and index first. Pinch one hand and hold it, then pinch the other. Move apart or together.</p><div class="vision-hints"><span>Fist = pointer off</span><span>Esc to exit</span></div></details></div>`;
  document.body.append(panel);
  const video = panel.querySelector('video')!;
  const preview = panel.querySelector('canvas')!;
  const context = preview.getContext('2d')!;
  const state = panel.querySelector<HTMLElement>('.vision-state')!;
  const rate = panel.querySelector<HTMLElement>('.vision-rate')!;
  const handStates = [...panel.querySelectorAll<HTMLElement>('.vision-hand-states span')];
  const stopButton = panel.querySelector('header button')!;
  const modeButton = panel.querySelector<HTMLButtonElement>('.vision-mode-button')!;
  const modeMenu = document.createElement('div');
  modeMenu.className = 'vision-mode-menu'; modeMenu.hidden = true;
  modeMenu.setAttribute('role','group'); modeMenu.setAttribute('aria-label','Vision mode menu');
  modeMenu.innerHTML = `<div class="vision-menu-heading">Vision mode <span>↕</span></div><div class="vision-menu-items"><button type="button" data-mode="charting" aria-label="Navigate mode"><span>↔</span><div>Navigate<small>Zoom & scroll</small></div><i>↑</i></button><button type="button" data-mode="drawing" aria-label="Inspect mode"><span>✎</span><div>Inspect<small>Choose a concept</small></div><i>↓</i></button></div><p>Swipe up / down · Tap thumb + index to select</p><button class="vision-menu-cancel" type="button">Cancel</button>`;
  document.body.append(modeMenu);
  const effect=document.createElement('div'); effect.className='vision-energy-frame'; effect.hidden=true;
  effect.setAttribute('aria-label','Candle energy window');
  effect.innerHTML='<canvas aria-hidden="true"></canvas><span class="vision-frame-label">GLASS FIELD · STRUCTURE</span><button type="button" aria-label="Remove candle energy window">✕</button>';
  document.body.append(effect);
  const energy=new VisionEnergy(effect.querySelector('canvas')!,()=>visionCandleNodes(workspace.active.host),()=>modes.concept==='structure'?visionStructureLevels(workspace.active.host):[],()=>modes.concept==='fair-value-gap'?visionGapZones(workspace.active.host):[]);
  const pressure=new VisionPressure();
  function frameContext() { return workspace.active.id; }
  function positionPanel() {
    const g=visionGeometry(workspace.active.host);
    if(!g) return;
    panel.style.right=`${Math.max(12,window.innerWidth-g.left-g.width+12)}px`;
    panel.style.bottom=`${Math.max(12,window.innerHeight-g.top-g.height+12)}px`;
    panel.style.width=`${Math.min(400,Math.max(0,g.width-24))}px`;
    panel.style.maxHeight=`${Math.max(0,g.height-24)}px`;
  }
  function renderFrame() {
    positionPanel();
    const rect=drawingFrames.visible(frameContext());
    const g=rect ? visionGeometry(workspace.active.host) : null;
    effect.hidden=!rect || !g || rect.width<=0 || rect.height<=0;
    if(rect && g) {
      effect.style.left=`${g.left+rect.x*g.width}px`; effect.style.top=`${g.top+rect.y*g.height}px`;
      effect.style.width=`${rect.width*g.width}px`; effect.style.height=`${rect.height*g.height}px`;
      effect.dataset.following=String(drawingFrames.following);
      effect.dataset.rotated='true';
      const top=rect.corners.reduce((a,b)=>a.y<b.y?a:b);
      const close=effect.querySelector<HTMLButtonElement>('button')!;
      const closeX=Math.max(4,Math.min(rect.width*g.width-26,(top.x-rect.x)*g.width-11));
      close.style.left=`${closeX}px`;close.style.right='auto';
      close.style.top=`${Math.max(4,(top.y-rect.y)*g.height+6)}px`;
      const label=effect.querySelector<HTMLElement>('.vision-frame-label')!;
      label.textContent=`GLASS FIELD · ${modes.concept==='structure'?'STRUCTURE':'FAIR VALUE GAPS'}`;
      label.style.left=`${Math.max(4,closeX-180)}px`;
      label.style.top=close.style.top;
      label.hidden=closeX<184 || rect.height*g.height<60;
      const field={x:rect.x*g.width,y:rect.y*g.height,width:rect.width*g.width,height:rect.height*g.height,tilt:rect.tilt,weights:rect.weights,corners:rect.corners.map(p=>({x:p.x*g.width,y:p.y*g.height}))};
      energy.update(field);
      pressure.update(field,g,()=>visionPressureCandles(workspace.active.host,field));
    }
    if(effect.hidden) {energy.stop();pressure.hide();}
    panel.querySelector<HTMLButtonElement>('.vision-frame-clear')!.disabled=!rect;
  }
  const stopFrameGeometry=onVisionGeometryChange(renderFrame);
  const clearFrame=()=>{drawingFrames.clear();renderFrame();};
  effect.querySelector('button')!.addEventListener('click',clearFrame);
  panel.querySelector('.vision-frame-clear')!.addEventListener('click',clearFrame);
  const modeChoices = [...modeMenu.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  const menuHeading=modeMenu.querySelector('.vision-menu-heading')!;
  const cancelChoice=modeMenu.querySelector<HTMLButtonElement>('.vision-menu-cancel')!;
  const choiceName=(choice:MenuChoice)=>choice==='charting'?'Navigate':choice==='drawing'?'Inspect':conceptName(choice);
  let referenceStarted=false;
  const referenceAbort=new AbortController();
  async function connectLibrary() {
    if(referenceStarted) return;
    referenceStarted=true;
    const label=panel.querySelector('.vision-library-status')!;
    label.textContent='Library · connecting…';
    try {
      const response=await fetch('/api/library/inspect',{signal:referenceAbort.signal});
      if(!response.ok) throw new Error('Library unavailable');
      const data=await response.json();
      if(data.status!=='connected' || data.url!==FVG_SOURCE) throw new Error('Invalid reference');
      label.textContent='Library · connected';
    } catch { if(!referenceAbort.signal.aborted) label.textContent='Library · offline — local concepts available'; }
  }
  let renderedMenuStage='';
  let menuGeometry: ReturnType<typeof visionGeometry> = null;
  function renderMode() {
    positionPanel();
    const hold = panel.querySelector<HTMLProgressElement>('.vision-palm-hold')!;
    hold.hidden = !modes.gesturePending;
    hold.value = modes.holdProgress;
    modeButton.textContent = `Mode · ${modes.mode === 'charting' ? 'Navigate' : `Inspect · ${conceptName(modes.concept)}`} ▾`;
    modeButton.setAttribute('aria-expanded', String(Boolean(modes.menu)));
    panel.dataset.mode = modes.mode;
    modeMenu.hidden = !modes.menu;
    if (!modes.menu || !menuGeometry) return;
    const g=menuGeometry;
    const x=Math.max(150, Math.min(window.innerWidth-150, g.left+modes.menu.origin.x*g.width));
    const y=Math.max(150, Math.min(window.innerHeight-230, g.top+modes.menu.origin.y*g.height));
    modeMenu.style.left=`${x}px`; modeMenu.style.top=`${y}px`;
    const inspecting=modes.menu.stage==='concept';
    if(renderedMenuStage!==modes.menu.stage) {
    renderedMenuStage=modes.menu.stage;
    menuHeading.textContent=inspecting?'Inspect concept ↕':'Vision mode ↕';
    modeMenu.setAttribute('aria-label',inspecting?'Inspect concept menu':'Vision mode menu');
    cancelChoice.textContent=inspecting?'Back':'Cancel';
    if(inspecting) void connectLibrary();
    modeChoices.forEach((choice,index)=>{
      const item=INSPECT_CONCEPTS[index];
      choice.dataset.mode=modes.choices[index];
      choice.setAttribute('aria-label',inspecting?item.name:`${index===0?'Navigate':'Inspect'} mode`);
      choice.querySelector('div')!.replaceChildren(document.createTextNode(inspecting?item.name:index===0?'Navigate':'Inspect'),Object.assign(document.createElement('small'),{textContent:inspecting?item.description:index===0?'Zoom & scroll':'Choose a concept'}));
    });
    }
    for(const choice of modeChoices) {
      choice.dataset.highlighted=String(choice.dataset.mode===modes.menu.selection);
      choice.setAttribute('aria-pressed', String(choice.dataset.mode===(inspecting?modes.concept:modes.mode)));
    }
  }
  function chooseMode(mode: MenuChoice) { drawingFrames.cancel(); renderFrame(); modes.select(mode,performance.now()); gestures.reset(); clearPointers(); renderMode(); }
  modeChoices.forEach(button=>button.addEventListener('click',()=>chooseMode(button.dataset.mode as MenuChoice)));
  cancelChoice.addEventListener('click',()=>{if(modes.menu?.stage==='concept') modes.back(); else modes.cancel(); gestures.reset(); renderMode();});
  modeButton.addEventListener('click',()=>{
    if(!active) return;
    menuGeometry=visionGeometry(workspace.active.host);
    if(!menuGeometry) return;
    gestures.reset(); clearPointers();
    if(modes.menu) modes.cancel(); else modes.open({x:.5,y:.45});
    renderMode();
  });
  const ns = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(ns, 'svg');
  overlay.classList.add('vision-overlay');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);
  const line = document.createElementNS(ns, 'line'); line.classList.add('vision-link'); overlay.append(line);
  const target = document.createElementNS(ns, 'circle'); target.classList.add('vision-anchor'); target.setAttribute('r', '6'); overlay.append(target);
  const cursors = ['Left', 'Right'].map((id) => {
    const group = document.createElementNS(ns, 'g'); group.classList.add('vision-pointer');
    group.dataset.hand = id;
    group.innerHTML = '<circle class="vision-ring" r="13"/><circle class="vision-dot" r="3"/>';
    overlay.append(group); return group;
  });
  let worker: Worker | null = null;
  let stream: MediaStream | null = null;
  let active = false;
  let generation = 0;
  let frameId = 0;
  let inFlight = false;
  let sentAt = 0;
  let lastVideoTime = -1;
  let lastResult = 0;
  let cancelInit: (() => void) | null = null;
  let lastBounds = '';
  let anchorY = 0;
  let wasZooming = false;
  let ignoreThrough = 0;
  let rateStart = 0;
  let frames = 0;

  const status = (message: string) => { if (state.textContent !== message) state.textContent = message; };
  const clearPointers = () => {
    cursors.forEach(c => c.style.display = 'none');
    line.style.display = target.style.display = 'none'; wasZooming = false;
    handStates.forEach(label => { label.textContent = `${label.dataset.hand} · not visible`; label.dataset.pinched = 'false'; });
  };
  const resetGesture = () => { drawingFrames.cancel(); renderFrame(); gestures.reset(); modes.cancel(); renderMode(); ignoreThrough = performance.now(); clearPointers(); };
  clearPointers();

  function stop(message?: string) {
    generation++; active = false; setActive(false);
    cancelAnimationFrame(frameId); cancelInit?.(); cancelInit = null;
    worker?.terminate(); worker = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.pause(); video.srcObject = null;
    context.clearRect(0, 0, preview.width, preview.height);
    inFlight = false; lastVideoTime = -1; lastResult = 0; lastBounds = '';
    rateStart = 0; frames = 0; rate.textContent = '';
    resetGesture(); panel.dataset.running = 'false';
    panel.hidden = !message;
    stopButton.textContent = 'Close ✕';
    if (message) status(message);
  }

  function paint(data: Result) {
    lastResult = performance.now();
    if (!rateStart) rateStart = lastResult;
    frames++;
    if (lastResult - rateStart >= 1000) {
      rate.textContent = `· ${Math.round(frames * 1000 / (lastResult - rateStart))} fps`;
      rateStart = lastResult; frames = 0;
    }
    if (lastResult - data.timestamp > 250 || data.timestamp <= ignoreThrough) { resetGesture(); return; }
    const geometry = visionGeometry(workspace.active.host);
    if (!geometry) { resetGesture(); status('Waiting for chart data…'); return; }
    const key = [workspace.active.id, workspace.chart.market.symbol, workspace.chart.market.timeframe, geometry.width, geometry.height].join(':');
    if (lastBounds && key !== lastBounds) resetGesture();
    lastBounds = key;
    const observations = data.landmarks.flatMap((points, index) => {
      const label = data.handedness[index]?.[0];
      return label && label.score >= 0.6 && ['Left','Right'].includes(label.categoryName) ? [{ id: label.categoryName, points, worldPoints: data.worldLandmarks?.[index] }] : [];
    });
    // Duplicate identities are ambiguous: neither hand may drive zoom.
    if (new Set(observations.map(h => h.id)).size !== observations.length) observations.length = 0;
    menuGeometry = geometry;
    const result = gestures.update(observations, data.timestamp, modes.paused ? null : geometry.range, geometry.width / geometry.height, video.videoWidth / video.videoHeight, modes.menu?.owner, modes.mode==='drawing' && !modes.menu);
    const selectingMode=Boolean(modes.menu) || modes.gesturePending;
    modes.update(result.hands, data.timestamp);
    if(selectingMode && !modes.menu && !modes.gesturePending) gestures.resetMotion();
    drawingFrames.update(result.hands,data.timestamp,frameContext(),modes.mode==='drawing' && !modes.menu && !modes.gesturePending && !selectingMode,24/geometry.width,24/geometry.height,result.inactiveHands.length>0,geometry.width/geometry.height);
    renderFrame();
    renderMode();
    for (const label of handStates) {
      const hand = result.hands.find(h => h.id === label.dataset.hand);
      const inactive = result.inactiveHands.includes(label.dataset.hand!);
      label.textContent = `${label.dataset.hand} · ${inactive ? 'fist · off' : !hand ? 'not visible' : hand.pinched ? hand.pinchUncertain ? 'pinch · steadying' : 'pinched' : hand.wheelPalm ? 'palm ready' : hand.claw ? 'claw' : hand.swipePose ? 'swipe ready' : hand.openPalm ? 'open palm' : !hand.armed ? 'open to arm' : 'ready'}`;
      label.dataset.pinched = String(Boolean(hand?.pinched));
    }
    const position = (h: Hand) => ({ x: geometry.left + h.x * geometry.width, y: geometry.top + h.y * geometry.height });
    for (const cursor of cursors) {
      const hand = result.hands.find(h => h.id === cursor.dataset.hand);
      cursor.style.display = hand ? '' : 'none';
      if (!hand) continue;
      const p = position(hand);
      cursor.setAttribute('transform', `translate(${p.x} ${p.y})`);
      cursor.classList.toggle('pinched', hand.pinched);
      cursor.classList.toggle('panning', result.panning && !modes.paused);
      cursor.classList.toggle('claw', hand.claw);
    }
    line.style.display = target.style.display = result.zooming && !modes.paused ? '' : 'none';
    if (result.zooming) {
      const [a,b] = result.hands.map(position);
      line.setAttribute('x1', String(a.x)); line.setAttribute('y1', String(a.y));
      line.setAttribute('x2', String(b.x)); line.setAttribute('y2', String(b.y));
      if (!wasZooming) anchorY = (a.y + b.y) / 2;
      target.setAttribute('cx', String(geometry.left + result.anchor! * geometry.width)); target.setAttribute('cy', String(anchorY));
    }
    wasZooming = result.zooming;
    if (result.zoom && !modes.paused && !selectingMode) workspace.chart.setVisibleRange(result.zoom);
    else if (result.pan && !modes.paused && !selectingMode) workspace.chart.setVisibleRange(result.pan);
    const pinches = result.hands.filter(h => h.pinched).length;
    status(modes.confirmation && data.timestamp-modes.confirmation.at<900 ? `${modes.confirmation.mode==='charting'?'Navigate':`Inspect · ${conceptName(modes.concept)}`} selected ✓` : modes.menu ? modes.menu.tap?.mode ? 'Tap detected · selecting…' : modes.menu.selection ? `Touch thumb + index to select ${choiceName(modes.menu.selection)}` : 'Swipe up or down to choose a mode' : modes.triggerHint ? modes.triggerHint : modes.mode === 'drawing' ? drawingFrames.recovering ? 'Hold steady · recovering hand tracking' : drawingFrames.following ? `Glass tilt ${Math.round((drawingFrames.visible(frameContext())?.tilt??0)*180/Math.PI)}° · hold both pinches` : 'Pinch one hand, hold it, then pinch the other'  : result.zooming ? 'Zooming · release either pinch to stop' : result.panning ? 'Scrolling · turn palm forward to stop' : pinches === 2 ? 'Hold both pinches with hands apart' : pinches === 1 ? 'First pinch held · pinch the other hand' : result.hands.length === 2 ? 'Two hands · pinch both to zoom' : result.hands.length === 1 ? result.hands[0].swipePose ? 'Swipe left or right to scroll' : 'Hold hand upright, edge toward camera' : result.inactiveHands.length ? 'Pointers off · open a hand to resume' : 'Show one hand to scroll, two to zoom');
    panel.dataset.zooming = String(result.zooming);
    panel.dataset.panning = String(result.panning);
    if (preview.width !== video.videoWidth) preview.width = video.videoWidth;
    if (preview.height !== video.videoHeight) preview.height = video.videoHeight;
    context.clearRect(0, 0, preview.width, preview.height);
    context.shadowColor = '#00000099'; context.shadowBlur = 2;
    context.lineWidth = 2; context.strokeStyle = '#ededed'; context.fillStyle = '#ededed';
    const labelScale = preview.width / Math.max(1, preview.getBoundingClientRect().width);
    const fontSize = 4.5 * labelScale;
    context.font = `${fontSize}px ui-monospace, SFMono-Regular, monospace`;
    const labelBoxes: {x:number;y:number;width:number;height:number}[]=[];
    for (const points of data.landmarks) {
      // Coordinate leaders use thinner strokes; reset before each hand outline.
      context.lineWidth = 2;
      context.strokeStyle = '#ededed'; context.fillStyle = '#ededed';
      for (const [a,b] of connections) {
        context.beginPath(); context.moveTo((1-points[a].x)*preview.width, points[a].y*preview.height); context.lineTo((1-points[b].x)*preview.width, points[b].y*preview.height); context.stroke();
      }
      for (const index of [4,8,12,16,20]) {
        const point=points[index];
        if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        const x=(1-point.x)*preview.width, y=point.y*preview.height;
        context.fillStyle='#ededed'; context.beginPath(); context.arc(x,y,1*labelScale,0,Math.PI*2); context.fill();
        // Normalized mirrored preview coordinates, not model confidence.
        const text=`${String(index).padStart(2,'0')} ${(1-point.x).toFixed(2)},${point.y.toFixed(2)}`;
        const width=context.measureText(text).width+3*labelScale, height=7*labelScale;
        const lx=Math.max(0,Math.min(preview.width-width,x+3*labelScale));
        let ly=Math.max(0,Math.min(preview.height-height,y-height));
        for(let attempt=0;attempt<12;attempt++) {
          if(!labelBoxes.some(b=>lx<b.x+b.width && lx+width>b.x && ly<b.y+b.height && ly+height>b.y)) break;
          ly=(ly+height+2*labelScale)%(preview.height-height);
        }
        labelBoxes.push({x:lx,y:ly,width,height});
        context.strokeStyle='#ffffff55'; context.lineWidth=labelScale*.35;
        context.beginPath();context.moveTo(x,y);context.lineTo(lx,ly+height/2);context.stroke();
        context.fillStyle='#08080899';context.fillRect(lx,ly,width,height);
        context.fillStyle='#ffffffcc';context.fillText(text,lx+1.5*labelScale,ly+5.2*labelScale);
      }
    }
  }

  function tick(now: number) {
    if (!active) return;
    frameId = requestAnimationFrame(tick);
    if (lastResult && now - lastResult > 250) { resetGesture(); status('Tracking paused · show both hands again'); }
    if (inFlight && now - sentAt > 4000) { stop('Tracking stopped responding. Close this panel and try Vision again.'); return; }
    if (inFlight || !worker || video.readyState < 2 || video.currentTime === lastVideoTime || now - sentAt < 30) return;
    lastVideoTime = video.currentTime; inFlight = true; sentAt = now;
    const token = generation;
    createImageBitmap(video).then(frame => {
      if (!active || token !== generation || !worker) { frame.close(); return; }
      worker.postMessage({ type:'frame', frame, timestamp: now }, [frame]);
    }).catch(() => { if (token === generation) stop('Could not read the camera. Close this panel and try again.'); });
  }

  async function start() {
    if (active) { stop(); return; }
    const token = ++generation;
    modes.choose('charting');
    gestures.reset();renderMode();
    active = true; setActive(true); panel.hidden = false; panel.dataset.running = 'true'; stopButton.textContent = 'Stop ✕';
    status('Loading hand tracker…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const instance = new Worker(new URL(`${import.meta.env.BASE_URL}vision-worker.js`, location.origin));
      worker = instance;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('tracker')), 25000);
        cancelInit = () => { clearTimeout(timer); reject(new Error('cancelled')); };
        instance.onerror = () => { clearTimeout(timer); reject(new Error('tracker')); };
        instance.onmessage = ({ data }) => {
          if (data.type === 'ready') { clearTimeout(timer); cancelInit = null; resolve(); }
          else if (data.type === 'error') { console.error('Vision tracker:', data.message); clearTimeout(timer); reject(new Error('tracker')); }
        };
        instance.postMessage({ type: 'init' });
      });
      if (token !== generation) return;
      status('Allow camera access to start Vision…');
      const camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 30, max: 30 } }, audio: false });
      if (token !== generation) { camera.getTracks().forEach(t => t.stop()); return; }
      stream = camera;
      camera.getVideoTracks().forEach(track => track.addEventListener('ended', () => { if (active) stop('Camera disconnected. Reconnect it and try Vision again.'); }));
      video.srcObject = camera; await video.play();
      if (token !== generation) return;
      instance.onerror = () => stop('Hand tracking failed. Close this panel and try again.');
      instance.onmessage = ({ data }) => {
        if (token !== generation) return;
        inFlight = false;
        if (data.type === 'result') paint(data);
        else if (data.type === 'error') { console.error('Vision tracker:', data.message); stop('Hand tracking failed. Close this panel and try again.'); }
      };
      status('Show your hands to begin');
      frameId = requestAnimationFrame(tick);
    } catch (error) {
      if (token !== generation) return;
      const name = error instanceof Error ? error.name : '';
      stop(name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser, then try Vision again.' : name === 'NotFoundError' ? 'No camera found. Connect a webcam and try Vision again.' : name === 'NotReadableError' ? 'The camera is busy. Close other camera apps and try again.' : 'Vision could not start. Check your camera and reload the page to retry.');
    }
  }
  const keydown = (event: KeyboardEvent) => {
    if(modes.menu && ['Escape','ArrowUp','ArrowDown','Enter'].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if(event.key==='Escape') { if(modes.menu.stage==='concept') modes.back(); else modes.cancel(); gestures.reset(); }
      else if(event.key==='ArrowUp') modes.menu.selection=modes.choices[0];
      else if(event.key==='ArrowDown') modes.menu.selection=modes.choices[1];
      else if(modes.menu.selection) chooseMode(modes.menu.selection);
      renderMode(); return;
    }
    if (event.key === 'Escape' && !panel.hidden) stop();
  };
  const hidden = () => { if (document.hidden && active) stop(); };
  const pagehide = () => { if (active) stop(); };
  const interrupt = () => { if (active) resetGesture(); };
  const disposers = ['cell:active','layout:changed','cell:maximized'].map(event => workspace.on(event, interrupt));
  stopButton.addEventListener('click', () => stop());
  document.addEventListener('keydown', keydown, true);
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('resize', interrupt);
  workspace.active.host.parentElement?.addEventListener('wheel', interrupt, { passive: true });
  const wheelHost = workspace.active.host.parentElement;
  return {
    toggle: () => { void start(); },
    destroy: () => {
      stop(); disposers.forEach(dispose => dispose());
      document.removeEventListener('keydown', keydown, true); document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pagehide); window.removeEventListener('resize', interrupt);
      wheelHost?.removeEventListener('wheel', interrupt);
      referenceAbort.abort(); stopFrameGeometry(); pressure.destroy(); effect.remove(); panel.remove(); overlay.remove(); modeMenu.remove();
    },
  };
}
