import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Catalog, PlayerId, Target } from '../../../packages/engine/src/index.ts';
import { BattleCard } from './battle-pieces.tsx';
import { LocalCardBack } from './local-art.tsx';
import type { PlaybackCue } from './battle-playback.ts';
import { animationTheme, FX_COLORS, impactChanges } from './battle-fx-model.ts';
import type { FxTheme, FxImpact } from './battle-fx-model.ts';
import { playBattleSound } from './battle-sound.ts';

type Point={x:number;y:number};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const point=(a:Point,b:Point,t:number):Point=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});
const targetKey=(target:Target)=>target.kind==='hero'?'hero:'+target.player:'minion:'+target.instanceId;
function elementFor(arena:HTMLElement,target:Target,seat:PlayerId):HTMLElement|undefined{
  if(target.kind==='hero')return arena.querySelector<HTMLElement>(target.player===seat?'.self-hero-zone .hero-portrait':'.enemy-hero-zone .hero-portrait')??undefined;
  return [...arena.querySelectorAll<HTMLElement>('[data-preview-minion]')].find(el=>el.dataset.previewMinion===target.instanceId);
}
function radial(ctx:CanvasRenderingContext2D,p:Point,r:number,colors:readonly string[],opacity:number){
  ctx.save();ctx.globalAlpha=opacity;const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,Math.max(1,r));
  g.addColorStop(0,colors[0]);g.addColorStop(.23,colors[1]);g.addColorStop(.58,colors[2]+'b0');g.addColorStop(1,colors[2]+'00');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(1,r),0,Math.PI*2);ctx.fill();ctx.restore();
}
function ring(ctx:CanvasRenderingContext2D,p:Point,r:number,color:string,opacity:number,width=3,flatten=1){
  ctx.save();ctx.globalAlpha=opacity;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.ellipse(p.x,p.y,Math.max(1,r),Math.max(1,r*flatten),0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function random(seed:number){const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n);}
/** Original canvas particles: deterministic radii keep frames smooth and the
 * same cue evokes the same impact for both players, mirrored by their seats. */
function burst(ctx:CanvasRenderingContext2D,p:Point,t:number,theme:FxTheme,scale=1,seed=0){
  const colors=FX_COLORS[theme],u=clamp(t),alpha=1-u;
  radial(ctx,p,(34+90*u)*scale,colors,alpha*(u<.15?1:.65));
  ring(ctx,p,(15+105*u)*scale,colors[1],alpha*.85,Math.max(1,6-5*u),theme==='dust' ? .45 : 1);
  if(theme==='steel'||theme==='lightning'||theme==='ice')ring(ctx,p,(7+80*u)*scale,colors[0],alpha*.8,2);
  for(let i=0;i<(scale>1.3?28:19);i++){
    const angle=random(seed+i*3)*Math.PI*2,velocity=(.45+random(seed+i*3+1))*scale;
    const r=(12+125*u)*velocity,x=p.x+Math.cos(angle)*r,y=p.y+Math.sin(angle)*r+(theme==='dust'?u*u*25:theme==='fire'?-u*u*35:0);
    const size=(2+5*random(seed+i*3+2))*scale*(1-u*.72);
    ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=colors[i%3];ctx.strokeStyle=colors[i%3];ctx.lineWidth=Math.max(1,size*.5);
    if(theme==='steel'||theme==='ice'||theme==='lightning'){
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(angle)*size*3,y-Math.sin(angle)*size*3);ctx.stroke();
    }else if(theme==='nature'){
      ctx.translate(x,y);ctx.rotate(angle+u*2);ctx.beginPath();ctx.ellipse(0,0,size*1.6,size*.65,0,0,Math.PI*2);ctx.fill();
    }else {ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  if(theme==='steel'&&u<.48){
    ctx.save();ctx.globalAlpha=(1-u/.48)*.85;ctx.strokeStyle='#fff5d2';ctx.lineWidth=6*(1-u)+1;
    ctx.beginPath();ctx.moveTo(p.x-48*scale,p.y+38*scale);ctx.quadraticCurveTo(p.x+3*scale,p.y-8*scale,p.x+52*scale,p.y-38*scale);ctx.stroke();ctx.restore();
  }
  if(theme==='ice'){
    // Six crystal branches radiate from the struck target, then crack apart.
    ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle=colors[0];ctx.globalAlpha=alpha*.91;ctx.lineWidth=2.4;
    for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);const l=(15+65*u)*scale;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-l);ctx.moveTo(0,-l*.62);ctx.lineTo(-l*.2,-l*.78);ctx.moveTo(0,-l*.62);ctx.lineTo(l*.2,-l*.78);ctx.stroke();}
    ctx.restore();
  }
  if(theme==='lightning'){
    ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=alpha*.9;ctx.strokeStyle=colors[0];ctx.lineWidth=2.8;ctx.shadowColor=colors[1];ctx.shadowBlur=10;
    for(let i=0;i<5;i++){ctx.rotate(Math.PI*2/5);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(12,-18);ctx.lineTo(-7,-32);ctx.lineTo(19,-(35+40*u)*scale);ctx.stroke();}
    ctx.restore();
  }
  if(theme==='arcane'||theme==='shadow'){
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(u*Math.PI*.85);ctx.globalAlpha=alpha*.74;ctx.strokeStyle=colors[1];ctx.lineWidth=2.5;
    const r=(25+45*u)*scale;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4;i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(r,0);}ctx.closePath();ctx.stroke();
    if(theme==='shadow'){for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(r*.35,-r*.7,-r*.6,-r*.7,0,-r*1.25);ctx.stroke();}}
    ctx.restore();
  }
  if(theme==='holy'||theme==='gold'){
    ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=alpha*.85;ctx.strokeStyle=colors[0];ctx.lineWidth=4;const r=(22+52*u)*scale;
    for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(0,-r*.3);ctx.lineTo(0,-r);ctx.stroke();}ctx.restore();
    ring(ctx,p,(17+78*u)*scale,colors[0],alpha*.65,4,.65);
  }
}
function bolt(ctx:CanvasRenderingContext2D,from:Point,to:Point,t:number,theme:FxTheme,heavy:boolean){
  const colors=FX_COLORS[theme],p=point(from,to,t),radius=heavy?28:17;
  if(theme==='lightning'){
    ctx.save();ctx.strokeStyle=colors[1];ctx.lineWidth=heavy?9:5;ctx.shadowBlur=17;ctx.shadowColor=colors[0];ctx.beginPath();ctx.moveTo(from.x,from.y);
    for(let i=1;i<8;i++){const q=point(from,p,i/8);ctx.lineTo(q.x+(random(i+Math.floor(t*12))*2-1)*15,q.y+(random(i+20)-.5)*18);}
    ctx.lineTo(p.x,p.y);ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle=colors[0];ctx.stroke();ctx.restore();
  }else{
    for(let i=1;i<=10;i++){const q=point(from,to,Math.max(0,t-i*.024));radial(ctx,q,radius*(1-i/14),colors,(11-i)/18);}
    radial(ctx,p,radius*1.5,colors,.9);radial(ctx,p,radius*.43,colors,1);
    if(theme==='ice'){
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(t*4);ctx.strokeStyle=colors[0];ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*radius,Math.sin(a)*radius);}ctx.stroke();ctx.restore();
    }
  }
}
function damageNumber(ctx:CanvasRenderingContext2D,p:Point,value:number,kind:'damage'|'heal',t:number){
  const u=clamp(t),scale=Math.min(1.15,.7+u*2);ctx.save();ctx.globalAlpha=u>.65?(1-u)/.35:1;ctx.translate(p.x,p.y-15-u*30);ctx.scale(scale,scale);
  ctx.font='1000 39px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#2b160e';ctx.lineWidth=7;ctx.lineJoin='round';
  const v=(kind==='damage'?'−':'+')+value;ctx.strokeText(v,0,0);ctx.fillStyle=kind==='damage'?'#fff0aa':'#aaffac';ctx.fillText(v,0,0);ctx.restore();
}
export function BattleEffects({cue,arenaRef,catalog}:{cue:PlaybackCue|null;arenaRef:RefObject<HTMLDivElement|null>;catalog:Catalog}){
  const canvas=useRef<HTMLCanvasElement>(null),cardReveal=useRef<HTMLDivElement>(null);
  const card=cue?.animation.cardId?catalog[cue.animation.cardId]:undefined;
  useEffect(()=>{
    const arena=arenaRef.current,layer=canvas.current;
    if(!cue||!arena||!layer||!cue.before.state||!cue.after.state)return;
    const a=cue.animation,seat=cue.before.seat,side=a.actor===seat?'self':'enemy',rect=arena.getBoundingClientRect();
    const center=(el?:Element|null):Point|undefined=>{if(!el)return;const b=el.getBoundingClientRect();return{x:b.left+b.width/2-rect.left,y:b.top+b.height/2-rect.top};};
    const row=arena.querySelector(side==='self'?'.friendly-minions':'.enemy-board .minion-row');
    const boardCenter=center(row)??{x:rect.width*.5,y:rect.height*.5};
    const heroTarget:Target={kind:'hero',player:a.actor};
    const actorClass=a.actor===seat?cue.before.state.self.heroClass:cue.before.state.opponent.heroClass;
    const theme=animationTheme(a,card,actorClass);
    const attack=a.kind==='attack'||a.kind==='heroAttack';
    const caster=attack&&a.attackerId?elementFor(arena,{kind:'minion',instanceId:a.attackerId},seat):a.kind==='power'?arena.querySelector<HTMLElement>(side==='self'?'.self-hero-zone .hero-power':'.enemy-hero-zone .hero-power'):elementFor(arena,heroTarget,seat);
    const from=center(caster)??boardCenter;
    const intended=a.target?center(elementFor(arena,a.target,seat)):undefined;
    const impacts=impactChanges(cue.before.state,cue.after.state,seat,a.events);
    const positions=new Map<string,Point>();
    for(const impact of impacts){const p=center(elementFor(arena,impact.target,seat));if(p)positions.set(targetKey(impact.target),p);}
    const afterBoard=a.actor===seat?cue.after.state.self.board:cue.after.state.opponent.board;
    const beforeBoard=a.actor===seat?cue.before.state.self.board:cue.before.state.opponent.board;
    const summoned=afterBoard.find(m=>!beforeBoard.some(n=>n.instanceId===m.instanceId)&&m.cardId===a.cardId);
    let destination=boardCenter;
    if(summoned&&row){
      const index=afterBoard.indexOf(summoned),gap=side==='self'?row.querySelectorAll('.position-slot')[index]:undefined;
      destination=center(gap)??{x:boardCenter.x+(index-(afterBoard.length-1)/2)*Math.min(125,row.getBoundingClientRect().width/Math.max(1,afterBoard.length)),y:boardCenter.y};
    }
    const hit=impacts.find(i=>i.side!==a.actor&&(i.kind==='damage'||i.kind==='leave'||i.kind==='shield'));
    const hitPoint=hit?positions.get(targetKey(hit.target)):undefined;
    const to=attack?(intended??hitPoint??boardCenter):a.kind==='summon'?destination:intended??hitPoint??(a.kind==='weapon'||a.kind==='coin'||a.kind==='secret'?from:boardCenter);
    const affected=[...new Map(impacts.filter(i=>i.kind==='damage'||i.kind==='heal'||i.kind==='freeze'||i.kind==='leave').flatMap(i=>{
      const p=positions.get(targetKey(i.target));return p?[[targetKey(i.target),p] as const]:[];
    })).values()];
    const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animations:Animation[]=[],timeouts:ReturnType<typeof setTimeout>[]=[],ghosts:HTMLElement[]=[];
    const departures=impacts.filter(i=>i.kind==='leave').flatMap(i=>{
      const el=elementFor(arena,i.target,seat);
      return el?[{ghost:el.cloneNode(true) as HTMLElement,box:el.getBoundingClientRect(),death:i.death!==false,isAttacker:i.target.kind==='minion'&&i.target.instanceId===a.attackerId}]:[];
    });
    if(attack&&caster&&!reduced&&typeof caster.animate==='function'){
      const dx=to.x-from.x,dy=to.y-from.y,at=cue.impact/cue.duration,reach=a.blocked ? .60 : .91;
      const box=caster.getBoundingClientRect(),ghost=caster.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('data-preview-minion');ghost.removeAttribute('data-preview-card');ghost.removeAttribute('data-action-source');
      ghost.classList.add('fx-actor');ghost.classList.remove('is-ready','is-targeted','is-selected','is-hit','is-entering');
      ghost.tabIndex=-1;ghost.setAttribute('aria-hidden','true');layer.parentElement?.append(ghost);ghosts.push(ghost);
      const geometry={left:`${box.left-rect.left}px`,top:`${box.top-rect.top}px`,width:`${box.width}px`,height:`${box.height}px`};
      const dies=a.attackerId&&impacts.some(i=>i.kind==='leave'&&i.target.kind==='minion'&&i.target.instanceId===a.attackerId);
      animations.push(caster.animate([{opacity:0},{opacity:0}],{duration:cue.duration,fill:'none'}));
      animations.push(ghost.animate([
        {...geometry,transform:'translate(0,0) scale(1)',opacity:1,offset:0},
        {...geometry,transform:`translate(${-dx*.12}px,${-dy*.12}px) scale(1.10)`,opacity:1,offset:at*.52,easing:'ease-in'},
        {...geometry,transform:`translate(${dx*reach}px,${dy*reach}px) scale(1.13)`,opacity:1,offset:at,easing:'ease-out'},
        {...geometry,transform:`translate(${dx*.50}px,${dy*.50}px) scale(.97)`,opacity:dies?0:1,offset:Math.min(.85,at+.16)},
        {...geometry,transform:'translate(0,0) scale(1)',opacity:dies?0:1,offset:1}
      ],{duration:cue.duration,fill:'both'}));
    }
    const reveal=cardReveal.current;
    if(reveal&&typeof reveal.animate==='function'&&!reduced){
      const r=center(reveal)??boardCenter,hand=arena.querySelector(side==='self'?'.own-hand':'.hidden-hand');
      const source=center(hand)??from;
      const end=a.kind==='summon'?destination:a.kind==='weapon'||a.kind==='secret'||a.kind==='coin'?from:to;
      animations.push(reveal.animate([
        {opacity:.1,transform:`translate(${source.x-r.x}px,${source.y-r.y}px) scale(.38) rotate(${side==='self'?9:-9}deg)`,offset:0},
        {opacity:1,transform:'translate(0,0) scale(1) rotate(0)',offset:.23,easing:'ease-in-out'},
        {opacity:1,transform:'translate(0,0) scale(1)',offset:Math.max(.25,cue.impact/cue.duration-.12)},
        {opacity:.1,transform:`translate(${end.x-r.x}px,${end.y-r.y}px) scale(.28)`,offset:Math.min(.85,cue.impact/cue.duration+.13)},
        {opacity:0,transform:`translate(${end.x-r.x}px,${end.y-r.y}px) scale(.2)`,offset:1},
      ],{duration:cue.duration,fill:'both'}));
    }
    const dpr=Math.min(devicePixelRatio||1,2);layer.width=Math.max(1,Math.round(rect.width*dpr));layer.height=Math.max(1,Math.round(rect.height*dpr));
    const ctx=layer.getContext('2d');if(ctx)ctx.scale(dpr,dpr);
    let frame=0,impacted=false,leftSound=false;
    const start=performance.now();
    playBattleSound(a,theme,'start');
    const impact=()=>{
      if(impacted)return;impacted=true;playBattleSound(a,theme,'impact');
      const violent=attack||impacts.some(i=>i.kind==='damage'||i.kind==='leave');
      if(violent&&!reduced&&typeof arena.animate==='function'){
        const strength=a.heavy||a.kind==='heroAttack'?9:5;
        animations.push(arena.animate([{transform:'translate(0,0)'},{transform:`translate(${-strength}px,${strength*.55}px)`},{transform:`translate(${strength}px,${-strength*.4}px)`},{transform:`translate(${-strength*.5}px,0)`},{transform:'translate(0,0)'}],{duration:310,easing:'ease-out'}));
      }
      if(departures.some(d=>d.death))timeouts.push(setTimeout(()=>{if(!leftSound){leftSound=true;playBattleSound(a,theme,'leave');}},120));
      if(!reduced&&layer.parentElement)for(const {ghost,box,death,isAttacker} of departures){
        if(isAttacker)continue;
        ghost.removeAttribute('data-preview-minion');ghost.removeAttribute('data-preview-card');ghost.removeAttribute('data-action-source');
        ghost.tabIndex=-1;ghost.setAttribute('aria-hidden','true');ghost.classList.add('fx-departure');ghost.classList.remove('is-ready','is-targeted','is-selected');
        layer.parentElement.append(ghost);ghosts.push(ghost);
        if(typeof ghost.animate==='function'){
          const geometry={left:`${box.left-rect.left}px`,top:`${box.top-rect.top}px`,width:`${box.width}px`,height:`${box.height}px`};
          animations.push(ghost.animate([
            {...geometry,opacity:1,transform:'scale(1)',filter:death?'brightness(1.8)':'none'},
            {...geometry,opacity:.8,transform:'scale(1.09) rotate(7deg)',filter:'brightness(1.18)'},
            {...geometry,opacity:0,transform:death?'translateY(15px) scale(.38) rotate(-12deg)':'translateY(-55px) scale(.34)',filter:death?'grayscale(1)':'none'},
          ],{duration:Math.min(600,cue.duration-cue.impact),fill:'both'}));
        }
      }
    };
    const paint=(now:number)=>{
      const elapsed=now-start,p=clamp(elapsed/cue.impact),u=clamp((elapsed-cue.impact)/Math.max(1,cue.duration-cue.impact));
      if(elapsed>=cue.impact)impact();
      if(ctx){
        ctx.clearRect(0,0,rect.width,rect.height);
        if(!reduced&&elapsed<cue.impact){
          if(a.kind==='spell'||a.kind==='power'){
            radial(ctx,from,28+20*p,FX_COLORS[theme],.5*(1-p));
            const travel=clamp((p-.24)/.76);
            if(affected.length>=3){
              const middle={x:affected.reduce((n,v)=>n+v.x,0)/affected.length,y:affected.reduce((n,v)=>n+v.y,0)/affected.length};
              ring(ctx,middle,35+120*travel,FX_COLORS[theme][1],travel*.8,4,.58);
              for(const q of affected)radial(ctx,q,12+35*travel,FX_COLORS[theme],travel*.7);
            }else if(travel>0){
              if(affected.length>1)for(const q of affected)bolt(ctx,from,q,travel,theme,!!a.heavy);
              else bolt(ctx,from,to,travel,theme,!!a.heavy);
            }
          }else if(attack&&p>.65)bolt(ctx,point(from,to,p-.16),to,clamp((p-.65)/.35),'steel',false);
          else if(a.kind==='summon')ring(ctx,destination,20+45*p,FX_COLORS.dust[1],p*.65,2,.38);
        }
        if(elapsed>=cue.impact){
          if(!reduced&&a.kind!=='turn'&&a.kind!=='choice')burst(ctx,to,u,a.blocked?'gold':theme,a.heavy?1.65:1.0,a.revision);
          for(const [i,event] of impacts.entries()){
            const pt=positions.get(targetKey(event.target))??center(elementFor(arena,event.target,seat))??(event.kind==='summon'?destination:undefined);
            if(!pt)continue;
            const col:FxTheme=event.kind==='heal'?'nature':event.kind==='freeze'?'ice':event.kind==='shield'?'gold':event.kind==='leave'?'dust':theme;
            if(!reduced&&Math.hypot(pt.x-to.x,pt.y-to.y)>20)burst(ctx,pt,u,col,event.kind==='leave'?1.15:.72,a.revision+i*11);
            if(!reduced&&event.kind==='leave')radial(ctx,pt,40+45*u,FX_COLORS.dust,(1-u)*.6);
            if(event.kind==='damage'||event.kind==='heal')damageNumber(ctx,{...pt,y:pt.y+(event.kind==='heal'&&impacts.some(i=>i.kind==='damage'&&targetKey(i.target)===targetKey(event.target))?42:0)},event.amount??0,event.kind,u);
          }
          if(a.blocked||a.events?.some(e=>e.kind==='secretTriggered')){
            ctx.save();ctx.globalAlpha=1-u;ctx.font='900 25px system-ui,sans-serif';ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='#25112c';ctx.fillStyle='#f4c2ff';
            const label=a.events?.some(e=>e.kind==='secretTriggered')?'비밀 발동!':'공격 차단';ctx.strokeText(label,to.x,to.y-70);ctx.fillText(label,to.x,to.y-70);ctx.restore();
          }
        }
      }
      if(elapsed<cue.duration)frame=requestAnimationFrame(paint);
      else {if(!impacted)impact();ctx?.clearRect(0,0,rect.width,rect.height);}
    };
    frame=requestAnimationFrame(paint);
    timeouts.push(setTimeout(impact,cue.impact));
    return()=>{cancelAnimationFrame(frame);for(const t of timeouts)clearTimeout(t);for(const animation of animations)animation.cancel();for(const ghost of ghosts)ghost.remove();ctx?.clearRect(0,0,rect.width,rect.height);};
  },[cue,arenaRef,card]);
  if(!cue)return null;
  const a=cue.animation,own=a.actor===cue.before.seat,showCard=!!card||a.kind==='secret';
  return <div className="battle-fx-layer" aria-hidden="true" data-fx-kind={a.kind} data-fx-side={own?'own':'enemy'} key={a.revision}>
    <canvas ref={canvas} className="battle-fx-canvas"/>
    {showCard&&<div className="fx-play-card" ref={cardReveal} data-card-reveal-kind={a.kind}>{card?<BattleCard card={card}/>:<div className="fx-secret-card"><LocalCardBack/><strong>비밀 설치</strong></div>}</div>}
  </div>;
}
