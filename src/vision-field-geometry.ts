export type FieldPoint={x:number;y:number};
export type FieldWindow={x:number;y:number;width:number;height:number;corners?:FieldPoint[];tilt?:number;weights?:number[]};

export function insideField(point:FieldPoint,rect:FieldWindow) {
  if(point.x<rect.x || point.x>rect.x+rect.width || point.y<rect.y || point.y>rect.y+rect.height) return false;
  if(!rect.corners) return true;
  let sign=0;
  for(let i=0;i<rect.corners.length;i++) {
    const a=rect.corners[i],b=rect.corners[(i+1)%rect.corners.length];
    const cross=(b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x);
    if(Math.abs(cross)<1e-7) continue;
    if(sign && Math.sign(cross)!==sign) return false;
    sign=Math.sign(cross);
  }
  return true;
}

// Intersect a horizontal price level with the rotated, convex window. All
// coordinates remain in chart pixels, so rotating the mask cannot rotate data.
export function fieldHorizontalSpan(rect:FieldWindow,y:number):[number,number]|null {
  if(y<rect.y || y>rect.y+rect.height) return null;
  if(!rect.corners) return [rect.x,rect.x+rect.width];
  const xs:number[]=[];
  for(let i=0;i<rect.corners.length;i++) {
    const a=rect.corners[i],b=rect.corners[(i+1)%rect.corners.length];
    if(y<Math.min(a.y,b.y)||y>Math.max(a.y,b.y)) continue;
    if(Math.abs(a.y-b.y)<1e-7) xs.push(a.x,b.x);
    else xs.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y));
  }
  if(!xs.length) return null;
  const left=Math.max(rect.x,Math.min(...xs)),right=Math.min(rect.x+rect.width,Math.max(...xs));
  return right>=left?[left,right]:null;
}

// Perspective-project a rectangular sheet, then align its grabbed diagonal to
// the two screen pointers. This keeps both fingertips attached at every tilt.
export function perspectiveSheet(corners:FieldPoint[],tilt:number,aspect=1,reverseDiagonal=false) {
  const physical=corners.map(p=>({x:p.x*aspect,y:p.y}));
  const width=Math.hypot(physical[1].x-physical[0].x,physical[1].y-physical[0].y);
  const height=Math.hypot(physical[3].x-physical[0].x,physical[3].y-physical[0].y);
  const focal=Math.max(.001,Math.hypot(width,height)*1.15);
  const angle=Math.max(-.85,Math.min(.85,Number.isFinite(tilt)?tilt:0));
  const plane=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>{
    const x=sx*width/2,y=sy*height/2;
    const weight=1-x*Math.sin(angle)/focal;
    return {x:x*Math.cos(angle)/weight,y:y/weight,weight};
  });
  const first=reverseDiagonal?3:0,last=reverseDiagonal?1:2;
  const a=physical[first],b=physical[last],pa=plane[first],pb=plane[last];
  const px=pb.x-pa.x,py=pb.y-pa.y,dx=b.x-a.x,dy=b.y-a.y,denom=px*px+py*py;
  if(denom<1e-12) return {corners,weights:[1,1,1,1]};
  const real=(dx*px+dy*py)/denom,imag=(dy*px-dx*py)/denom;
  return {corners:plane.map(p=>({x:(a.x+real*(p.x-pa.x)-imag*(p.y-pa.y))/aspect,y:a.y+imag*(p.x-pa.x)+real*(p.y-pa.y)})),weights:plane.map(p=>p.weight)};
}

export function glassPoint(corners:FieldPoint[],weights:number[],u:number,v:number):FieldPoint {
  const blend=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v];
  const denominator=blend.reduce((sum,b,i)=>sum+b*weights[i],0);
  return {x:blend.reduce((sum,b,i)=>sum+b*weights[i]*corners[i].x,0)/denominator,
    y:blend.reduce((sum,b,i)=>sum+b*weights[i]*corners[i].y,0)/denominator};
}
