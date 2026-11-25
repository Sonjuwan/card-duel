import {stopDialogueVoice} from './dialogue-voice.ts';
import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Catalog, PlayerId, Target } from '../../../packages/engine/src/index.ts';
import { BattleCard } from './battle-pieces.tsx';
import { LocalCardArt, LocalCardBack } from './local-art.tsx';
import type { PlaybackCue } from './battle-playback.ts';
import { animationTheme, FX_COLORS, impactChanges, impactFeedback, defenseImpactLabel, fxRenderBudget,fxFramePressure,fxAutoAdaptation,fxCanvasGeometryChanged,fxNeedsCanvasAnimation,departureVisual,departureSoundKind,summonVisuals,projectedSummonX,clipBoardFxAnchor,offscreenFxMarkers,fxEdgeMarkerBounds,fxEdgeMarkerLabel,createImpactLabelCache,createParticleCache,fxRandom } from './battle-fx-model.ts';
import type { FxTheme,FxLabel,FxAnchor,FxEdgeMarker } from './battle-fx-model.ts';
import { playBattleSound,playBattleDepartureSound,stopBattleSound } from './battle-sound.ts';
import {playBattleHaptic,stopBattleHaptics} from './battle-haptics.ts';
import {battleFxQuality} from './battle-fx-quality.ts';
import {prepareFxGhost} from './battle-fx-ghost.ts';
import {paintBurstParticles} from './battle-fx-particles.ts';

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
/** Original canvas particles: deterministic radii keep frames smooth and the
 * same cue evokes the same impact for both players, mirrored by their seats. */
function burst(ctx:CanvasRenderingContext2D,p:Point,t:number,theme:FxTheme,scale:number,seed:number,density:number,particlesFor:ReturnType<typeof createParticleCache>){
  const colors=FX_COLORS[theme],u=clamp(t),alpha=1-u;
  radial(ctx,p,(34+90*u)*scale,colors,alpha*(u<.15?1:.65));
  ring(ctx,p,(15+105*u)*scale,colors[1],alpha*.85,Math.max(1,6-5*u),theme==='dust' ? .45 : 1);
  if(theme==='steel'||theme==='lightning'||theme==='ice')ring(ctx,p,(7+80*u)*scale,colors[0],alpha*.8,2);
  paintBurstParticles(ctx,p,u,theme,scale,seed,density,particlesFor);
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
function bolt(ctx:CanvasRenderingContext2D,from:Point,to:Point,t:number,theme:FxTheme,heavy:boolean,density=1){
  const colors=FX_COLORS[theme],p=point(from,to,t),radius=heavy?28:17;
  if(theme==='lightning'){
    ctx.save();ctx.strokeStyle=colors[1];ctx.lineWidth=heavy?9:5;ctx.shadowBlur=17;ctx.shadowColor=colors[0];ctx.beginPath();ctx.moveTo(from.x,from.y);
    for(let i=1;i<8;i++){const q=point(from,p,i/8);ctx.lineTo(q.x+(fxRandom(i+Math.floor(t*12))*2-1)*15,q.y+(fxRandom(i+20)-.5)*18);}
    ctx.lineTo(p.x,p.y);ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle=colors[0];ctx.stroke();ctx.restore();
  }else{
    for(let i=1;i<=Math.round(10*density);i++){const q=point(from,to,Math.max(0,t-i*.024));radial(ctx,q,radius*(1-i/14),colors,(11-i)/18);}
    radial(ctx,p,radius*1.5,colors,.9);radial(ctx,p,radius*.43,colors,1);
    if(theme==='ice'){
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(t*4);ctx.strokeStyle=colors[0];ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*radius,Math.sin(a)*radius);}ctx.stroke();ctx.restore();
    }
  }
}
function drawImpactLabel(ctx:CanvasRenderingContext2D,label:FxLabel,t:number,reduced=false){
  const u=clamp(t),numeric=label.kind==='damage'||label.kind==='heal',scale=reduced||!numeric?1:Math.min(1,.8+u*1.2);ctx.save();ctx.globalAlpha=u>.65?(1-u)/.35:1;ctx.translate(label.x,label.y-(reduced?0:label.floatUp*u));ctx.scale(scale,scale);
  ctx.font=`${numeric?1000:800} ${label.fontSize}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#241a0f';ctx.lineWidth=Math.min(6,Math.max(2,label.fontSize*.15));ctx.lineJoin='round';ctx.fillStyle=label.kind==='heal'?'#aaffac':label.kind==='damage'?'#fff0aa':label.kind==='repeat'?'#f9db8c':'#ffe6a0';
  ctx.strokeText(label.text,0,0,label.maxWidth);ctx.fillText(label.text,0,0,label.maxWidth);ctx.restore();
}
function drawEdgeMarker(ctx:CanvasRenderingContext2D,marker:FxEdgeMarker,t:number,width:number,height:number,seat:PlayerId){
  const {w,h,x,y}=fxEdgeMarkerBounds(marker,width,height);
  ctx.save();ctx.globalAlpha=t>.65?(1-t)/.35:1;ctx.fillStyle='#241a0f';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#f9df97';ctx.lineWidth=1.5;ctx.strokeRect(x+.75,y+.75,Math.max(0,w-1.5),Math.max(0,h-1.5));ctx.fillStyle='#fff0b6';ctx.font='800 12px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(fxEdgeMarkerLabel(marker,seat),x+w/2,y+h/2,Math.max(1,w-8));ctx.restore();
}
export function BattleEffects({cue,arenaRef,catalog}:{cue:PlaybackCue|null;arenaRef:RefObject<HTMLDivElement|null>;catalog:Catalog}){
  const canvas=useRef<HTMLCanvasElement>(null),cardReveal=useRef<HTMLDivElement>(null);
  const adaptiveUntil=useRef(0);
  const card=cue?.animation.cardId?catalog[cue.animation.cardId]:undefined;
  useLayoutEffect(()=>{
    const arena=arenaRef.current,layer=canvas.current;
    if(!cue||!arena||!layer||!cue.before.state||!cue.after.state||document.hidden)return;
    const a=cue.animation,seat=cue.before.seat,side=a.actor===seat?'self':'enemy',rect=arena.getBoundingClientRect();
    const local=(p:FxAnchor|undefined):FxAnchor|undefined=>p?{...p,x:p.x-rect.left,y:p.y-rect.top}:undefined;
    const scrollClips=(row:HTMLElement)=>row.scrollWidth>row.clientWidth+1&&['auto','scroll','hidden','clip'].includes(getComputedStyle(row).overflowX);
    const center=(el?:Element|null):FxAnchor|undefined=>{
      if(!el)return;const b=el.getBoundingClientRect(),clip=el.closest<HTMLElement>('.minion-row');
      if(clip&&el!==clip&&scrollClips(clip))return local(clipBoardFxAnchor(b,clip.getBoundingClientRect()));
      return {x:b.left+b.width/2-rect.left,y:b.top+b.height/2-rect.top,fullyVisible:true};
    };
    const row=arena.querySelector(side==='self'?'.friendly-minions':'.enemy-board .minion-row');
    const boardCenter=center(row)??{x:rect.width*.5,y:rect.height*.5};
    const heroTarget:Target={kind:'hero',player:a.actor};
    const actor=a.actor===seat?cue.before.state.self:cue.before.state.opponent;
    const actorClass=actor.heroClass;
    const theme=a.kind==='power'&&actor.shadowformLevel?'shadow':animationTheme(a,card,actorClass);
    const attack=a.kind==='attack'||a.kind==='heroAttack';
    const caster=attack&&a.attackerId?elementFor(arena,{kind:'minion',instanceId:a.attackerId},seat):a.kind==='power'?arena.querySelector<HTMLElement>(side==='self'?'.self-hero-zone .hero-power':'.enemy-hero-zone .hero-power'):elementFor(arena,heroTarget,seat);
    const from=center(caster)??boardCenter;
    const intended=a.target?center(elementFor(arena,a.target,seat)):undefined;
    const impacts=impactChanges(cue.before.state,cue.after.state,seat,a.events);
    const summons=summonVisuals(cue.before.state,cue.after.state,seat,catalog);
    const summonPosition=(id:string):FxAnchor|undefined=>{
      const visual=summons.get(id);if(!visual)return undefined;
      const target:Target={kind:'minion',instanceId:id},visible=center(elementFor(arena,target,seat));if(visible)return visible;
      const boardRow=arena.querySelector<HTMLElement>(visual.side===seat?'.friendly-minions':'.enemy-board .minion-row'),middle=center(boardRow);
      if(!boardRow||!middle)return;const b=boardRow.getBoundingClientRect();
      if(scrollClips(boardRow)){const width=Math.max(b.width,boardRow.scrollWidth),x=projectedSummonX(b.left-boardRow.scrollLeft+width/2,width,visual.index,visual.count);return local(clipBoardFxAnchor({left:x-.5,right:x+.5,top:b.top,bottom:b.bottom},b));}
      return {x:projectedSummonX(middle.x,b.width,visual.index,visual.count),y:middle.y,fullyVisible:true};
    };
    const positions=new Map<string,FxAnchor>(),fallbacks=new Map<string,FxAnchor>(),unresolved=new Map<string,Target>();
    for(const impact of impacts){
      const id=targetKey(impact.target);if(positions.has(id)||unresolved.has(id))continue;
      const p=center(elementFor(arena,impact.target,seat));if(p)positions.set(id,p);
      else{unresolved.set(id,impact.target);const projected=impact.target.kind==='minion'?summonPosition(impact.target.instanceId):undefined;if(projected)fallbacks.set(id,projected);}
    }
    const impactPosition=(target:Target)=>positions.get(targetKey(target))??fallbacks.get(targetKey(target));
    // Newly summoned elements appear only after the accepted snapshot reaches
    // React. Bound retries so transient/dead-in-one-action targets never cause
    // repeated DOM queries during the full animation.
    let positionRetries=0,markersDirty=true,cachedMarkers:FxEdgeMarker[]=[];
    const resolveNewPositions=()=>{
      if(!unresolved.size||positionRetries>=6)return;positionRetries++;
      const minions=new Map([...arena.querySelectorAll<HTMLElement>('[data-preview-minion]')].map(el=>[el.dataset.previewMinion,el]));
      for(const [id,target] of unresolved){const p=center(target.kind==='minion'?minions.get(target.instanceId):elementFor(arena,target,seat));if(p){positions.set(id,p);unresolved.delete(id);markersDirty=true;}}
    };
    const labelForFrame=createImpactLabelCache(impacts,rect.width,rect.height),particlesFor=createParticleCache();
    const afterBoard=a.actor===seat?cue.after.state.self.board:cue.after.state.opponent.board;
    const beforeBoard=a.actor===seat?cue.before.state.self.board:cue.before.state.opponent.board;
    const summoned=afterBoard.find(m=>!beforeBoard.some(n=>n.instanceId===m.instanceId)&&m.cardId===a.cardId);
    let destination=boardCenter;
    if(summoned&&row){
      const index=afterBoard.indexOf(summoned),gap=side==='self'?row.querySelectorAll('.position-slot')[index]:undefined;
      destination=center(gap)??summonPosition(summoned.instanceId)??boardCenter;
    }
    const hit=impacts.find(i=>i.side!==a.actor&&(i.kind==='damage'||i.kind==='armorHit'||i.kind==='leave'||i.kind==='shield'));
    const hitPoint=hit?positions.get(targetKey(hit.target)):undefined;
    const protection=impacts.find(i=>i.kind==='armorGain'||i.kind==='shieldGain'),protectionPoint=protection?positions.get(targetKey(protection.target)):undefined;
    const ownHeroPoint=center(elementFor(arena,heroTarget,seat))??from;
    const powerSummon=a.kind==='power'?afterBoard.find(m=>!beforeBoard.some(n=>n.instanceId===m.instanceId)):undefined;
    const weaponPoint=actorClass==='rogue'?center(arena.querySelector(side==='self'?'.self-hero-zone .weapon-slot':'.enemy-hero-zone .weapon-slot')):undefined;
    const hunterTarget=actorClass==='hunter'&&actor.heroForm!=='jaraxxus'
      ?center(elementFor(arena,{kind:'hero',player:a.actor===0?1:0},seat)):undefined;
    const powerTarget=a.kind==='power'?(intended??hunterTarget??hitPoint??protectionPoint??weaponPoint??(powerSummon?summonPosition(powerSummon.instanceId):undefined)??ownHeroPoint):undefined;
    const powerProjectile=a.kind==='power'&&actor.heroForm!=='jaraxxus'&&(actorClass==='mage'||actorClass==='hunter'||!!actor.shadowformLevel);
    const to=powerTarget??(attack?(intended??hitPoint??boardCenter):a.kind==='summon'?destination:intended??hitPoint??protectionPoint??(a.kind==='weapon'||a.kind==='coin'||a.kind==='secret'?from:boardCenter));
    const affected=[...new Map(impacts.filter(i=>i.kind==='damage'||i.kind==='heal'||i.kind==='freeze'||i.kind==='leave'||!!defenseImpactLabel(i)).flatMap(i=>{
      const p=positions.get(targetKey(i.target));return p&&!p.edge?[[targetKey(i.target),p] as const]:[];
    })).values()];
    const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animations:Animation[]=[],timeouts:ReturnType<typeof setTimeout>[]=[],ghosts:HTMLElement[]=[];
    const departures=reduced?[]:impacts.filter(i=>i.kind==='leave').flatMap(i=>{
      const el=elementFor(arena,i.target,seat);
      return el&&typeof el.animate==='function'&&center(el)?.fullyVisible?[{ghost:el.cloneNode(true) as HTMLElement,box:el.getBoundingClientRect(),death:departureVisual(i)==='death',isAttacker:i.target.kind==='minion'&&i.target.instanceId===a.attackerId,key:targetKey(i.target)}]:[];
    });
    if(attack&&caster&&center(caster)?.fullyVisible&&!reduced&&typeof caster.animate==='function'){
      const dx=to.x-from.x,dy=to.y-from.y,at=cue.impact/cue.duration,reach=a.blocked ? .60 : .91;
      const box=caster.getBoundingClientRect(),ghost=caster.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('data-preview-minion');ghost.removeAttribute('data-preview-card');ghost.removeAttribute('data-action-source');
      ghost.classList.add('fx-actor');ghost.classList.remove('is-ready','is-targeted','is-selected','is-hit','is-entering');
      prepareFxGhost(ghost);layer.parentElement?.append(ghost);ghosts.push(ghost);
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
    const summon=a.kind==='summon',impactOffset=cue.impact/cue.duration;
    const summonPortrait=reveal?.querySelector<HTMLElement>('.fx-summon-portrait');
    if(reveal&&typeof reveal.animate==='function'&&!reduced){
      const r=center(reveal)??boardCenter,hand=arena.querySelector(side==='self'?'.own-hand':'.hidden-hand');
      const source=center(hand)??from;
      const end=a.kind==='summon'?destination:a.kind==='weapon'?(center(arena.querySelector(side==='self'?'.self-hero-zone .weapon-slot':'.enemy-hero-zone .weapon-slot'))??from):a.kind==='secret'||a.kind==='coin'?from:to;
      if(summonPortrait&&typeof summonPortrait.animate==='function'){
        const target=destination;
        animations.push(summonPortrait.animate([
          {opacity:0,transform:'scale(.96)',offset:0},
          {opacity:0,transform:'scale(.96)',offset:impactOffset*.62},
          {opacity:1,transform:'scale(.72)',offset:impactOffset*.74},
          {opacity:1,transform:`translate(${target.x-r.x}px,${target.y-r.y}px) scale(.40)`,offset:cue.impact/cue.duration},
          {opacity:0,transform:`translate(${target.x-r.x}px,${target.y-r.y}px) scale(.38)`,offset:1},
        ],{duration:cue.duration,fill:'both'}));
      }
      const fullCard=reveal.querySelector<HTMLElement>('.battle-card,.fx-secret-card')??reveal;
      animations.push(fullCard.animate([
        {opacity:.1,transform:`translate(${source.x-r.x}px,${source.y-r.y}px) scale(.38) rotate(${side==='self'?9:-9}deg)`,offset:0},
        {opacity:1,transform:'translate(0,0) scale(1) rotate(0)',offset:summon?.15:.23,easing:'ease-in-out'},
        {opacity:1,transform:'translate(0,0) scale(1)',offset:summon?impactOffset*.65:Math.max(.25,cue.impact/cue.duration-.12)},
        {opacity:0,transform:summon?'scale(.72)':`translate(${end.x-r.x}px,${end.y-r.y}px) scale(.28)`,offset:summon?impactOffset*.79:Math.min(.85,cue.impact/cue.duration+.13)},
        {opacity:0,transform:`translate(${end.x-r.x}px,${end.y-r.y}px) scale(.2)`,offset:1},
      ],{duration:cue.duration,fill:'both'}));
    }
    const quality=battleFxQuality(),held=fxAutoAdaptation(adaptiveUntil.current,performance.now(),0,quality,reduced);adaptiveUntil.current=held.until;
    const budget=fxRenderBudget(rect.width,rect.height,globalThis.devicePixelRatio||1,globalThis.navigator?.hardwareConcurrency,reduced,held.active?'economy':quality),dpr=budget.dpr;
    // Ordinary turn/choice transitions have no canvas visuals. Do not allocate
    // a high-resolution backing buffer or repaint for the whole cue; the
    // accepted impact audio still fires through the independent timer below.
    let ctx:CanvasRenderingContext2D|null=null;
    if(fxNeedsCanvasAnimation(a,impacts)){
      layer.width=Math.max(1,Math.floor(rect.width*dpr));layer.height=Math.max(1,Math.floor(rect.height*dpr));
      try{ctx=layer.getContext('2d');ctx?.scale(dpr,dpr);}catch{ctx=null;}
    }
    let frame=0,impacted=false,lastPaint=-Infinity,lastFrame=0,slowFrames=0,adapted=held.active,spatialInvalid=false,canvasInvalid=false,geometryDirty=false;
    const cancelSpatialMotion=()=>{
      if(spatialInvalid)return;spatialInvalid=true;
      for(const animation of animations)animation.cancel();animations.length=0;
      for(const ghost of ghosts)ghost.remove();ghosts.length=0;
      if(reveal)reveal.style.visibility='hidden';
    };
    const rows=[...arena.querySelectorAll<HTMLElement>('.minion-row')];
    const onBoardScroll=()=>{cancelSpatialMotion();geometryDirty=true;};
    const onResize=()=>{const now=arena.getBoundingClientRect();if(fxCanvasGeometryChanged(rect.width,rect.height,now.width,now.height)){canvasInvalid=true;cancelSpatialMotion();ctx?.clearRect(0,0,rect.width,rect.height);}};
    const refreshScrolledAnchors=()=>{
      if(!geometryDirty)return;geometryDirty=false;markersDirty=true;
      // Never re-use a departed unit's stale screen position after panning.
      // Live units and newly summoned projections are re-measured at most once
      // per painted frame; exact departed-unit results stay in history.
      const checked=new Set<string>();
      for(const event of impacts){const id=targetKey(event.target);if(checked.has(id))continue;checked.add(id);const p=center(elementFor(arena,event.target,seat));
        if(p){positions.set(id,p);fallbacks.delete(id);unresolved.delete(id);}
        else{positions.delete(id);const projected=event.target.kind==='minion'?summonPosition(event.target.instanceId):undefined;if(projected)fallbacks.set(id,projected);else fallbacks.delete(id);}
      }
    };
    for(const boardRow of rows)boardRow.addEventListener('scroll',onBoardScroll,{passive:true});
    window.addEventListener('resize',onResize);
    const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(onResize):undefined;resizeObserver?.observe(arena);
    const start=performance.now(),feedback=impactFeedback(a,impacts);
    const recovery=cue.duration-cue.impact;
    const trace=a.events??[];
    const deathBeat=(key:string)=>{
      const index=trace.findIndex(event=>event.kind==='death'&&targetKey(event.target)===key);
      return Math.min(recovery*.28,240+Math.max(0,index)*55);
    };
    const hasDeath=trace.some(event=>event.kind==='death');
    const secretBeat=Math.max(0,trace.findIndex(event=>event.kind==='secretTriggered'))*35;
    playBattleSound(a,theme,'start');
    const impact=()=>{
      if(impacted||document.hidden)return;impacted=true;playBattleSound(a,theme,'impact',feedback);playBattleHaptic(a,feedback,seat);
      if(feedback.shake>0&&!reduced&&!spatialInvalid&&typeof arena.animate==='function'){
        const strength=feedback.shake;
        animations.push(arena.animate([{transform:'translate(0,0)'},{transform:`translate(${-strength}px,${strength*.55}px)`},{transform:`translate(${strength}px,${-strength*.4}px)`},{transform:`translate(${-strength*.5}px,0)`},{transform:'translate(0,0)'}],{duration:620,easing:'ease-out'}));
      }
      const departureSound=departureSoundKind(impacts);
      if(departureSound)timeouts.push(setTimeout(()=>playBattleDepartureSound(departureSound),hasDeath?Math.min(recovery*.28,240):0));
      if(!reduced&&!spatialInvalid&&layer.parentElement)for(const {ghost,box,death,isAttacker,key} of departures){
        if(isAttacker)continue;
        ghost.removeAttribute('data-preview-minion');ghost.removeAttribute('data-preview-card');ghost.removeAttribute('data-action-source');
        prepareFxGhost(ghost);ghost.classList.add('fx-departure');ghost.classList.remove('is-ready','is-targeted','is-selected');
        layer.parentElement.append(ghost);ghosts.push(ghost);
        if(typeof ghost.animate==='function'){
          const geometry={left:`${box.left-rect.left}px`,top:`${box.top-rect.top}px`,width:`${box.width}px`,height:`${box.height}px`};
          animations.push(ghost.animate([
            {...geometry,opacity:1,transform:'scale(1)',filter:death?'brightness(1.8)':'none'},
            {...geometry,opacity:.8,transform:'scale(1.09) rotate(7deg)',filter:'brightness(1.18)'},
            {...geometry,opacity:0,transform:death?'translateY(15px) scale(.38) rotate(-12deg)':'translateY(-55px) scale(.34)',filter:death?'grayscale(1)':'none'},
          ],{delay:death?deathBeat(key):0,duration:Math.min(1200,recovery-(death?deathBeat(key):0)),fill:'both'}));
        }
      }
    };
    const paint=(now:number)=>{
      if(document.hidden||canvasInvalid)return;
      if(quality==='auto'&&!reduced&&lastFrame>0){slowFrames=fxFramePressure(slowFrames,now-lastFrame);if(slowFrames>=3){adaptiveUntil.current=fxAutoAdaptation(adaptiveUntil.current,now,slowFrames,quality,reduced).until;if(!adapted){adapted=true;budget.particleDensity*=.6;budget.frameInterval=Math.max(budget.frameInterval,1000/30);}}}
      lastFrame=now;
      const elapsed=now-start,p=clamp(elapsed/cue.impact),u=clamp((elapsed-cue.impact)/Math.max(1,cue.duration-cue.impact));
      if(elapsed>=cue.impact)impact();
      if(ctx&&(now-lastPaint>=budget.frameInterval-1||elapsed>=cue.duration)){lastPaint=now;
        refreshScrolledAnchors();
        ctx.clearRect(0,0,rect.width,rect.height);
        if(!reduced&&!spatialInvalid&&elapsed<cue.impact){
          if(a.kind==='power'&&!powerProjectile){
            radial(ctx,to,18+30*p,FX_COLORS[theme],.55*(1-p));
            ring(ctx,to,14+36*p,FX_COLORS[theme][1],p*.7,3);
            if(powerSummon)ring(ctx,to,12+32*p,FX_COLORS[theme][0],p*.75,2,.45);
            if(actorClass==='druid'){
              ctx.save();ctx.translate(to.x,to.y);ctx.strokeStyle=FX_COLORS.nature[0];ctx.globalAlpha=p*.8;ctx.lineWidth=3;
              for(const x of [-8,0,8]){ctx.beginPath();ctx.moveTo(x-9,15);ctx.quadraticCurveTo(x+9,-2,x+13,-17);ctx.stroke();}
              ctx.restore();
            }
          }else if(a.kind==='spell'||a.kind==='power'){
            radial(ctx,from,28+20*p,FX_COLORS[theme],.5*(1-p));
            const travel=clamp((p-.24)/.76);
            if(affected.length>=3){
              const middle={x:affected.reduce((n,v)=>n+v.x,0)/affected.length,y:affected.reduce((n,v)=>n+v.y,0)/affected.length};
              ring(ctx,middle,35+120*travel,FX_COLORS[theme][1],travel*.8,4,.58);
              for(const q of affected)radial(ctx,q,12+35*travel,FX_COLORS[theme],travel*.7);
            }else if(travel>0){
              if(affected.length>1)for(const q of affected)bolt(ctx,from,q,travel,theme,!!a.heavy,budget.particleDensity);
              else if(a.kind==='power'&&actorClass==='hunter'){
                const tip=point(from,to,travel),tail=point(from,to,Math.max(0,travel-.09));
                ctx.save();ctx.translate(tip.x,tip.y);ctx.rotate(Math.atan2(to.y-from.y,to.x-from.x));
                ctx.strokeStyle=FX_COLORS.nature[0];ctx.lineWidth=3;ctx.beginPath();
                ctx.moveTo(-Math.max(16,Math.hypot(tip.x-tail.x,tip.y-tail.y)),0);ctx.lineTo(0,0);
                ctx.moveTo(-9,-4);ctx.lineTo(0,0);ctx.lineTo(-9,4);ctx.stroke();ctx.restore();
              }else bolt(ctx,from,to,travel,theme,!!a.heavy,budget.particleDensity);
            }
          }else if(attack&&p>.65)bolt(ctx,point(from,to,p-.16),to,clamp((p-.65)/.35),'steel',false,budget.particleDensity);
          else if(a.kind==='summon'){ring(ctx,destination,20+45*p,FX_COLORS[theme][1],p*.65,2,.38);radial(ctx,destination,12+25*p,FX_COLORS[theme],p*.32);}
        }
        if(elapsed>=cue.impact){
          resolveNewPositions();
          if(!reduced&&!spatialInvalid&&a.kind!=='turn'&&a.kind!=='choice')burst(ctx,to,u,a.blocked||feedback.kind==='armor'?'gold':theme,a.heavy&&feedback.kind!=='armor'?1.65:1.0,a.revision,budget.particleDensity,particlesFor);
          for(const [i,event] of impacts.entries()){
            const summon=event.kind==='summon'&&event.target.kind==='minion'?summons.get(event.target.instanceId):undefined;
            const pt=impactPosition(event.target);
            if(!pt||pt.edge)continue;
            const delay=event.kind==='leave'&&event.death?deathBeat(targetKey(event.target)):event.kind==='summon'&&hasDeath?recovery*.38:0;
            if(elapsed-cue.impact<delay)continue;
            const progress=clamp((elapsed-cue.impact-delay)/Math.max(1,recovery-delay));
            const label=defenseImpactLabel(event),col:FxTheme=summon?.theme??(event.kind==='heal'?'nature':event.kind==='freeze'?'ice':label?'gold':event.kind==='leave'?(departureVisual(event)==='death'?'dust':'arcane'):theme);
            if(!reduced&&(spatialInvalid||Math.hypot(pt.x-to.x,pt.y-to.y)>20))burst(ctx,pt,progress,col,event.kind==='leave'?1.15:.72,a.revision+i*11,budget.particleDensity,particlesFor);
            if(!reduced&&summon)ring(ctx,pt,20+38*progress,FX_COLORS[col][1],(1-progress)*.75,2,.42);
            if(!reduced&&event.kind==='leave'){const colors=FX_COLORS[departureVisual(event)==='death'?'dust':'arcane'];radial(ctx,pt,40+45*progress,colors,(1-progress)*.6);}
            if(label&&!reduced)ring(ctx,pt,25+35*u,FX_COLORS.gold[1],(1-u)*.9,3);
          }
          for(const label of labelForFrame(target=>{const p=impactPosition(target);return p?.edge?undefined:p;}))drawImpactLabel(ctx,label,u,reduced);
          if(markersDirty){cachedMarkers=offscreenFxMarkers(impacts,impactPosition);markersDirty=false;}
          for(const marker of cachedMarkers)drawEdgeMarker(ctx,marker,u,rect.width,rect.height,seat);
          if(a.blocked||elapsed-cue.impact>=secretBeat&&trace.some(e=>e.kind==='secretTriggered')){
            ctx.save();ctx.globalAlpha=1-u;ctx.font='900 25px system-ui,sans-serif';ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='#25112c';ctx.fillStyle='#f4c2ff';
            const label=a.events?.some(e=>e.kind==='secretTriggered')?'비밀 발동!':'공격 차단',p=spatialInvalid?boardCenter:to;ctx.strokeText(label,p.x,p.y-70);ctx.fillText(label,p.x,p.y-70);ctx.restore();
          }
        }
      }
      if(ctx&&!reduced&&!canvasInvalid&&summon&&elapsed>=cue.duration*.49&&elapsed<cue.impact){
        const progress=clamp((elapsed-cue.duration*.49)/(cue.impact-cue.duration*.49));
        const colors=FX_COLORS[theme];
        ring(ctx,destination,23+54*progress,colors[1],.76,3,.46);
        ring(ctx,destination,14+36*progress,colors[0],.55,2,.46);
      }
      if(elapsed<cue.duration)frame=requestAnimationFrame(paint);
      else {if(!impacted)impact();ctx?.clearRect(0,0,rect.width,rect.height);}
    };
    if(ctx)frame=requestAnimationFrame(paint);
    timeouts.push(setTimeout(impact,cue.impact));
    return()=>{stopDialogueVoice();stopBattleSound();stopBattleHaptics();cancelAnimationFrame(frame);for(const t of timeouts)clearTimeout(t);for(const animation of animations)animation.cancel();for(const ghost of ghosts)ghost.remove();for(const boardRow of rows)boardRow.removeEventListener('scroll',onBoardScroll);window.removeEventListener('resize',onResize);resizeObserver?.disconnect();if(reveal)reveal.style.removeProperty('visibility');ctx?.clearRect(0,0,rect.width,rect.height);};
  },[cue,arenaRef,card,catalog]);
  if(!cue)return null;
  const a=cue.animation,own=a.actor===cue.before.seat,showCard=!!card||a.kind==='secret';
  return <div className="battle-fx-layer" inert aria-hidden="true" data-fx-revision={a.revision} data-fx-kind={a.kind} data-fx-side={own?'own':'enemy'} key={a.revision}>
    <canvas ref={canvas} className="battle-fx-canvas"/>
    {showCard&&<div className="fx-play-card" ref={cardReveal} data-card-reveal-kind={a.kind}>{card?<><BattleCard card={card}/>{a.kind==='summon'&&<span className="fx-summon-portrait"><LocalCardArt card={card}/></span>}</>:<div className="fx-secret-card"><LocalCardBack/><strong>비밀 설치</strong></div>}</div>}
  </div>;
}
