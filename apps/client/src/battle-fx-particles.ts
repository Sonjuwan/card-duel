import { createParticleCache, FX_COLORS } from './battle-fx-model.ts';
import type { FxTheme } from './battle-fx-model.ts';

type Point={x:number;y:number};
/** Paint the exact precomputed particle positions of a combat burst.
 * Most themes use no transforms, so a single canvas state boundary is enough
 * for the entire burst instead of a save/restore pair per particle. Nature's
 * individually rotated leaves keep their own transform boundaries. */
export function paintBurstParticles(
  ctx:CanvasRenderingContext2D,p:Point,t:number,theme:FxTheme,scale:number,seed:number,density:number,
  particlesFor:ReturnType<typeof createParticleCache>,
):number{
  const u=Math.max(0,Math.min(1,t)),alpha=1-u;
  const count=Math.round((scale>1.3?28:19)*density);
  if(count<=0||alpha<=0)return 0;
  const particles=particlesFor(seed,scale,count),colors=FX_COLORS[theme];
  ctx.save();ctx.globalAlpha=alpha;
  for(let i=0;i<count;i++){
    const {angle,cos,sin,velocity,size:baseSize}=particles[i];
    const r=(12+125*u)*velocity,x=p.x+cos*r,y=p.y+sin*r+(theme==='dust'?u*u*25:theme==='fire'?-u*u*35:0);
    const size=baseSize*(1-u*.72),color=colors[i%3];
    ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,size*.5);
    if(theme==='steel'||theme==='ice'||theme==='lightning'){
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-cos*size*3,y-sin*size*3);ctx.stroke();
    }else if(theme==='nature'){
      ctx.save();ctx.translate(x,y);ctx.rotate(angle+u*2);ctx.beginPath();ctx.ellipse(0,0,size*1.6,size*.65,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }else {ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
  return count;
}
