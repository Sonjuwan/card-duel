import type { BattleVisualEvent, Card, Catalog, HeroClass, PlayerId, PlayerView, Target } from '../../../packages/engine/src/index.ts';
import type { BattleAnimation } from '../../../packages/protocol.ts';
import { cardArtRecipe } from './local-art-model.ts';
import type {FxQuality} from './battle-fx-quality.ts';

export type FxTheme='steel'|'fire'|'ice'|'lightning'|'arcane'|'shadow'|'holy'|'nature'|'gold'|'dust';
export const FX_COLORS:Record<FxTheme,readonly [string,string,string]>={
  steel:['#ffffff','#ffd694','#c26d44'],fire:['#fff3af','#ff9d32','#da351c'],ice:['#ffffff','#71d8ff','#2078df'],
  lightning:['#fffbdc','#90d9ff','#797dff'],arcane:['#ffffff','#c38aff','#7536f2'],shadow:['#f1c5ff','#ad6be2','#451550'],
  holy:['#fffbd5','#ffdf61','#e7a731'],nature:['#efffc0','#a8e375','#318d48'],gold:['#fff9d1','#f6bc55','#aa6134'],dust:['#fff4ce','#d5b78b','#8d6346'],
};
/** Rendering budgets change only presentation. Keep impact timing and damage
 * labels at every quality level, while avoiding oversized mobile canvases. */
export function fxRenderBudget(width:number,height:number,deviceDpr:number,cores:number|undefined,reduced:boolean,quality:FxQuality='auto'){
  const w=Math.max(1,Number.isFinite(width)?width:1),h=Math.max(1,Number.isFinite(height)?height:1),compact=w<=660,limited=typeof cores==='number'&&Number.isFinite(cores)&&cores>0&&cores<=4;
  const requested=Number.isFinite(deviceDpr)&&deviceDpr>0?deviceDpr:1;
  // Explicit economy always caps cost; rich never defeats accessibility or
  // the hard safety limit for low-core devices and oversized canvases.
  const economy=quality==='economy',rich=quality==='rich'&&!reduced&&!limited;
  const pixels=economy?800_000:rich&&compact?1_800_000:compact||limited||reduced?1_200_000:3_200_000;
  const maxDpr=economy?1.1:rich&&compact?1.75:compact||limited||reduced?1.5:2;
  const particleDensity=reduced ? 0 : economy ? .35 : rich ? (compact ? .9 : 1.25) : compact||limited ? .65 : 1;
  return {dpr:Math.min(requested,maxDpr,Math.sqrt(pixels/(w*h))),particleDensity,frameInterval:economy||reduced||limited?1000/30:0};
}
/** On an overloaded device auto mode may lower particle cost.
 * A single scheduling hiccup does not degrade quality or change impact time. */
export function fxFramePressure(previous:number,deltaMs:number){return Number.isFinite(deltaMs)&&deltaMs>=50?Math.min(3,previous+1):0;}
/** Turn/choice cues with no public visual result still need their scheduled
 * audio/impact callback, but not a high-DPR canvas or 60fps paint loop. */
export function fxNeedsCanvasAnimation(animation:BattleAnimation,impacts:readonly FxImpact[]):boolean{
  return (animation.kind!=='turn'&&animation.kind!=='choice')||impacts.length>0||!!animation.events?.some(e=>e.kind==='secretTriggered');
}
export const FX_AUTO_RECOVERY_MS=8000;
/** Carry short-lived pressure across cues rather than paying the detection
 * cost again on each action. Explicit quality and reduced motion always win. */
export function fxAutoAdaptation(previousUntil:number,now:number,pressure:number,quality:FxQuality,reduced:boolean){
  if(quality!=='auto'||reduced||!Number.isFinite(now))return {active:false,until:0};
  const until=pressure>=3?now+FX_AUTO_RECOVERY_MS:Number.isFinite(previousUntil)&&previousUntil>now?previousUntil:0;
  return {active:until>now,until};
}
/** A fixed-size cue canvas cannot safely keep its old spatial geometry after
 * a rotation/reflow. Ignore subpixel rounding, not actual size changes. */
export function fxCanvasGeometryChanged(width:number,height:number,nextWidth:number,nextHeight:number):boolean{
  return ![width,height,nextWidth,nextHeight].every(n=>Number.isFinite(n)&&n>0)||Math.abs(width-nextWidth)>1||Math.abs(height-nextHeight)>1;
}
const powerTheme:Record<HeroClass,FxTheme>={warrior:'steel',shaman:'lightning',rogue:'steel',paladin:'holy',hunter:'nature',druid:'nature',warlock:'shadow',mage:'fire',priest:'holy'};
export function animationTheme(animation:BattleAnimation,card?:Card,heroClass?:HeroClass):FxTheme{
  if(animation.kind==='attack'||animation.kind==='heroAttack'||animation.kind==='weapon')return 'steel';
  // Summons inherit the card's visual identity; generic dust is only a fallback.
  if(animation.kind==='summon'&&!card)return 'dust';
  if(animation.kind==='secret')return 'shadow';
  if(animation.kind==='coin')return 'gold';
  if(animation.kind==='power')return heroClass?powerTheme[heroClass]:'arcane';
  if(!card)return 'arcane';
  const recipe=cardArtRecipe(card),effects=card.kind==='spell'?(card.choices?.[animation.choice??-1]?.effects??card.effects??[]):[];
  if(effects.some(e=>e.kind==='freeze')||recipe.subject==='ice'||recipe.theme==='frost')return 'ice';
  if(/lightning|storm|shock|thunder|overload/.test(card.id)||recipe.subject==='lightning')return 'lightning';
  if(effects.some(e=>e.kind==='heal'||e.kind==='healFull'))return 'holy';
  if(/pyro|fire|flame|lava|infernal|ember/.test(card.id)||recipe.subject==='fire'||recipe.subject==='fireball')return 'fire';
  if(recipe.theme==='abyss')return 'shadow';
  if(recipe.theme==='forest'||recipe.subject==='nature')return 'nature';
  if(recipe.theme==='gold'||recipe.subject==='holy')return 'holy';
  return recipe.theme==='steel'?'steel':'arcane';
}
export type ImpactKind='damage'|'heal'|'leave'|'summon'|'shield'|'shieldGain'|'armorGain'|'armorHit'|'buff'|'freeze'|'transform';
export interface FxImpact{target:Target;kind:ImpactKind;amount?:number;side:PlayerId;death?:boolean;hitCount?:number;}
export type ImpactFeedback={kind:'damage'|'armor'|'blocked'|'shield'|'protect'|'heal'|'neutral';strength:number;shake:number;armor?:boolean;extraHits?:number};
/** Use the accepted public outcomes, not the printed attack value, for impact
 * feedback. A shielded or canceled hit should never sound like full damage. */
export function impactFeedback(animation:BattleAnimation,impacts:readonly FxImpact[]):ImpactFeedback{
  const hits=impacts.filter(i=>i.kind==='damage'&&(i.amount??0)>0),peak=Math.max(0,...hits.map(i=>i.amount??0));
  const armor=impacts.filter(i=>i.kind==='armorHit'&&(i.amount??0)>0),extraHits=Math.min(3,Math.max(0,...[...hits,...armor].map(i=>(i.hitCount??1)-1)));
  if(peak>0){const strength=Math.min(1.45,.65+peak*.055+Math.min(3,hits.length-1)*.10);return {kind:'damage',strength,shake:Math.min(10,Math.round(2+peak*.65+Math.min(3,hits.length-1))),...(armor.length?{armor:true}:{}),...(extraHits?{extraHits}:{})};}
  if(armor.length){const peakArmor=Math.max(...armor.map(i=>i.amount??0));return {kind:'armor',strength:Math.min(1.1,.55+peakArmor*.045),shake:Math.min(4,1+Math.ceil(peakArmor/5)),...(extraHits?{extraHits}:{})};}
  if(animation.blocked)return {kind:'blocked',strength:.65,shake:2};
  if(impacts.some(i=>i.kind==='shield'))return {kind:'shield',strength:.75,shake:0};
  if(impacts.some(i=>i.kind==='heal'))return {kind:'heal',strength:.8,shake:0};
  if(impacts.some(i=>i.kind==='shieldGain'||i.kind==='armorGain'))return {kind:'protect',strength:.75,shake:0};
  return {kind:'neutral',strength:1,shake:impacts.some(i=>i.kind==='leave'&&i.death)?4:0};
}
export function defenseImpactLabel(impact:FxImpact):string|null{
  if(impact.kind==='armorHit')return `방어도 −${impact.amount??0}`;
  if(impact.kind==='armorGain')return `방어도 +${impact.amount??0}`;
  if(impact.kind==='shieldGain')return '보호막 획득';
  if(impact.kind==='shield')return '보호막 소모';
  return null;
}
export type FxLabelGroup={key:string;position:{x:number;y:number};impacts:readonly FxImpact[]};
export type FxLabel={kind:'damage'|'heal'|'defense'|'repeat';text:string;x:number;y:number;fontSize:number;maxWidth:number;floatUp:number};
export type FxRect={left:number;right:number;top:number;bottom:number};
export type FxAnchor={x:number;y:number;fullyVisible:boolean;edge?:'left'|'right'};
/** A scroll-clipped board unit must not launch a ghost or damage text over
 * an unrelated rail. Partial units anchor to their visible intersection;
 * fully hidden units report their edge instead of masquerading as a unit. */
export function clipBoardFxAnchor(bounds:FxRect,clip:FxRect):FxAnchor|undefined{
  if(![bounds.left,bounds.right,bounds.top,bounds.bottom,clip.left,clip.right,clip.top,clip.bottom].every(Number.isFinite)||bounds.right<=bounds.left||bounds.bottom<=bounds.top||clip.right<=clip.left||clip.bottom<=clip.top)return;
  const top=Math.max(bounds.top,clip.top),bottom=Math.min(bounds.bottom,clip.bottom);if(bottom<=top)return;
  const y=(top+bottom)/2,margin=Math.min(8,(clip.right-clip.left)/2);
  if(bounds.right<=clip.left)return {x:clip.left+margin,y,fullyVisible:false,edge:'left'};
  if(bounds.left>=clip.right)return {x:clip.right-margin,y,fullyVisible:false,edge:'right'};
  return {x:(Math.max(bounds.left,clip.left)+Math.min(bounds.right,clip.right))/2,y,fullyVisible:bounds.left>=clip.left&&bounds.right<=clip.right&&bounds.top>=clip.top&&bounds.bottom<=clip.bottom};
}
export type FxEdgeMarker={edge:'left'|'right';side:PlayerId;count:number;x:number;y:number};
/** Markers identify which player's hidden minions were hit, rather than a
 * generic count whose meaning disappears in a crowded or scrolled board. */
export function fxEdgeMarkerLabel(marker:FxEdgeMarker,seat:PlayerId):string{
  const text=`${marker.side===seat?'아군':'상대'} ${marker.count}명`;
  return marker.edge==='left'?`◀ ${text}`:`${text} ▶`;
}
/** Contain the entire marker within its canvas, including on short landscape
 * phone viewports or during a responsive reflow. */
export function fxEdgeMarkerBounds(marker:FxEdgeMarker,width:number,height:number){
  const w=Math.min(Math.max(1,width),Math.min(112,Math.max(16,width/2-4)));
  const h=Math.min(20,Math.max(1,height));
  return {w,h,x:Math.max(0,Math.min(width-w,marker.edge==='left'?marker.x:marker.x-w)),y:Math.max(0,Math.min(height-h,marker.y-34))};
}
/** Aggregate one marker per board edge; multiple accepted effects on the
 * same hidden minion count once. Exact outcomes remain in impact history. */
export function offscreenFxMarkers(impacts:readonly FxImpact[],positionFor:(target:Target)=>FxAnchor|undefined):FxEdgeMarker[]{
  const markers=new Map<string,FxEdgeMarker>(),seen=new Set<string>();
  for(const impact of impacts){const targetKey=key(impact.target),p=positionFor(impact.target);if(!p?.edge||seen.has(targetKey))continue;seen.add(targetKey);const id=`${impact.side}:${p.edge}`,old=markers.get(id);if(old)old.count++;else markers.set(id,{edge:p.edge,side:impact.side,count:1,x:p.x,y:p.y});}
  return [...markers.values()];
}
/** Allocate label lanes between nearby characters, then fit the entire stack
 * inside the canvas. Small bounds never move the underlying battlefield. */
export function layoutImpactLabels(groups:readonly FxLabelGroup[],width:number,height:number):FxLabel[]{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<12||height<12)return [];
  const result:FxLabel[]=[],compact=width<=660;
  for(const group of groups){const p=group.position;if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    let left=0,right=width;
    for(const other of groups){if(other===group||!Number.isFinite(other.position.y)||Math.abs(other.position.y-p.y)>(compact?38:60))continue;const x=other.position.x;if(!Number.isFinite(x))continue;if(x<p.x)left=Math.max(left,(x+p.x)/2);else if(x>p.x)right=Math.min(right,(x+p.x)/2);}
    left=Math.max(0,Math.min(width-4,left));right=Math.max(left+4,Math.min(width,right));
    const margin=Math.min(3,(right-left)/4),maxWidth=Math.max(1,Math.min(right-left-2*margin,compact?110:155)),x=Math.max(left+maxWidth/2+margin,Math.min(right-maxWidth/2-margin,p.x));
    const labels:Array<Pick<FxLabel,'kind'|'text'|'fontSize'>>=[],repeats=Math.max(0,...group.impacts.map(i=>i.hitCount??0));
    const small=Math.max(10,Math.min(compact?14:18,maxWidth/3)),large=Math.max(14,Math.min(compact?30:39,maxWidth*.64));
    if(repeats>1)labels.push({kind:'repeat',text:`${repeats}연타`,fontSize:small});
    for(const kind of ['damage','heal'] as const)for(const impact of group.impacts)if(impact.kind===kind&&(impact.amount??0)>0)labels.push({kind,text:(kind==='damage'?'−':'+')+impact.amount,fontSize:large});
    for(const impact of group.impacts){const text=defenseImpactLabel(impact);if(text)labels.push({kind:'defense',text:maxWidth<65&&impact.kind==='shield'?'보호막−':maxWidth<65&&impact.kind==='shieldGain'?'보호막+':text,fontSize:small});}
    let total=labels.reduce((n,label)=>n+label.fontSize+7,0);const factor=Math.min(1,(height-8)/Math.max(1,total));total*=factor;
    let top=Math.max(4,Math.min(height-total-4,p.y-total/2-6));const floatUp=Math.min(10,top-4);
    for(const label of labels){const row=(label.fontSize+7)*factor;result.push({...label,x,y:top+row/2,fontSize:label.fontSize*factor,maxWidth,floatUp});top+=row;}
  }
  return result;
}
const key=(target:Target)=>target.kind==='hero'?'h'+target.player:'m'+target.instanceId;
/** Derive actual results exclusively from public snapshots; a canceled or
 * redirected attack never invents damage, and hand/deck contents stay private. */
export function impactChanges(before:PlayerView,after:PlayerView,seat:PlayerId,events?:readonly BattleVisualEvent[]):FxImpact[]{
  const result:FxImpact[]=[],enemy:PlayerId=seat===0?1:0;
  const boards=[...before.self.board,...before.opponent.board],nextBoards=[...after.self.board,...after.opponent.board];
  const old=new Map(boards.map(m=>[m.instanceId,m])),next=new Map(nextBoards.map(m=>[m.instanceId,m]));
  for(const [side,prior,now] of [[seat,before.self,after.self],[enemy,before.opponent,after.opponent]] as const){
    const target:Target={kind:'hero',player:side},delta=now.health-prior.health;
    if(delta&&!events)result.push({side,target,kind:delta<0?'damage':'heal',amount:Math.abs(delta)});
    if(now.armor>prior.armor)result.push({side,target,kind:'armorGain',amount:now.armor-prior.armor});
    // Older traces lack armor metadata. Only use observed armor loss if the
    // hero did not change form (a transformation can clear armor without a hit).
    if(!events&&now.armor<prior.armor&&now.heroForm===prior.heroForm)result.push({side,target,kind:'armorHit',amount:prior.armor-now.armor});
    for(const m of prior.board){
      const target:Target={kind:'minion',instanceId:m.instanceId},n=next.get(m.instanceId);
      if(!n){result.push({side,target,kind:'leave',...(events?{death:events.some(e=>e.kind==='death'&&key(e.target)===key(target))}:{})});continue;}
      if(m.cardId!==n.cardId){result.push({side,target,kind:'transform'});continue;}
      if(m.health!==n.health&&!events)result.push({side,target,kind:n.health<m.health?'damage':'heal',amount:Math.abs(n.health-m.health)});
      const hadShield=!!m.keywords?.includes('divineShield'),hasShield=!!n.keywords?.includes('divineShield');
      // A real absorbed hit is explicit in the engine trace. Legacy snapshots
      // may fall back to a loss, except when silence itself removed the shield.
      if(hadShield&&!hasShield&&!events&&!!m.silenced===!!n.silenced)result.push({side,target,kind:'shield'});
      if(!hadShield&&hasShield)result.push({side,target,kind:'shieldGain'});
      if(m.attack!==n.attack||m.maxHealth!==n.maxHealth)result.push({side,target,kind:'buff'});
      if(m.frozenThroughTurn===undefined&&n.frozenThroughTurn!==undefined)result.push({side,target,kind:'freeze'});
    }
    for(const m of now.board)if(!old.has(m.instanceId))result.push({side,target:{kind:'minion',instanceId:m.instanceId},kind:'summon'});
  }
  if(events){
    // Exact hits include overkill, retaliations, interrupted attacks and
    // damage/healing in the same transaction. Group repeated missiles on
    // one target for a readable impact number.
    const totals=new Map<string,FxImpact>(),hitCounts=new Map<string,number>();
    const legacyArmor=new Map<PlayerId,number>();
    for(const [side,prior,now] of [[seat,before.self,after.self],[enemy,before.opponent,after.opponent]] as const){
      const heroHits=events.filter(e=>e.kind==='damage'&&e.target.kind==='hero'&&e.target.player===side);
      if(prior.heroForm===now.heroForm&&heroHits.every(e=>e.kind==='damage'&&e.armorAbsorbed===undefined))legacyArmor.set(side,Math.max(0,prior.armor-now.armor));
    }
    const append=(e:{side:PlayerId;target:Target},kind:'damage'|'heal'|'armorHit',amount:number)=>{
      if(!(amount>0))return;const id=kind+key(e.target),existing=totals.get(id);
      if(existing)existing.amount=(existing.amount??0)+amount;
      else totals.set(id,{kind,side:e.side,target:e.target,amount});
    };
    for(const e of events)if(e.kind==='damage'||e.kind==='heal'){
      if(e.kind==='damage'&&e.amount>0){const id=key(e.target);hitCounts.set(id,(hitCounts.get(id)??0)+1);}
      if(e.kind==='damage'&&e.target.kind==='hero'){
        const fallback=legacyArmor.get(e.side)??0,absorbed=Math.min(e.amount,Math.max(0,e.armorAbsorbed??fallback));
        if(e.armorAbsorbed===undefined)legacyArmor.set(e.side,Math.max(0,fallback-absorbed));
        append(e,'armorHit',absorbed);append(e,'damage',e.amount-absorbed);
      }else append(e,e.kind,e.amount);
    }else if(e.kind==='shield'&&!result.some(i=>i.kind==='shield'&&key(i.target)===key(e.target)))result.push({kind:'shield',side:e.side,target:e.target});
    for(const impact of totals.values()){const count=hitCounts.get(key(impact.target))??0;if(impact.kind!=='heal'&&count>1)impact.hitCount=count;result.push(impact);}
  }
  return result;
}

/** Missing death metadata is unknown, never evidence of a death. */
export function departureVisual(impact:FxImpact):'death'|'exit'{return impact.kind==='leave'&&impact.death===true?'death':'exit';}
/** One bounded departure cue per accepted action. Unknown legacy removals
 * are intentionally silent, and confirmed deaths outrank simultaneous exits. */
export function departureSoundKind(impacts:readonly FxImpact[]):'death'|'exit'|null{
  if(impacts.some(i=>i.kind==='leave'&&i.death===true))return 'death';
  return impacts.some(i=>i.kind==='leave'&&i.death===false)?'exit':null;
}

/** Every newly public minion has its own visual identity and final board slot,
 * even if it appeared indirectly via a spell, deathrattle or opposing effect. */
export function summonVisuals(before:PlayerView,after:PlayerView,seat:PlayerId,catalog:Catalog){
  const existing=new Set([...before.self.board,...before.opponent.board].map(m=>m.instanceId));
  const result=new Map<string,{side:PlayerId;index:number;count:number;theme:FxTheme}>();
  for(const [side,board] of [[seat,after.self.board],[seat===0?1:0,after.opponent.board]] as const){
    board.forEach((m,index)=>{if(!existing.has(m.instanceId))result.set(m.instanceId,{side,index,count:board.length,theme:animationTheme({kind:'summon',actor:side,revision:after.revision,cardId:m.cardId},catalog[m.cardId])});});
  }
  return result;
}

export function projectedSummonX(center:number,rowWidth:number,index:number,count:number){
  return center+(index-(count-1)/2)*Math.min(125,rowWidth/Math.max(1,count));
}

type FxPoint={x:number;y:number};
/** Group and lay out impact text only when an anchor changes. A normal cue
 * with stable anchors reuses its exact label array for every painted frame. */
export function createImpactLabelCache(impacts:readonly FxImpact[],width:number,height:number){
  const groups=new Map<string,{target:Target;impacts:FxImpact[]}>();
  for(const impact of impacts){
    if(impact.kind!=='damage'&&impact.kind!=='heal'&&!defenseImpactLabel(impact))continue;
    const id=key(impact.target),group=groups.get(id);
    if(group)group.impacts.push(impact);else groups.set(id,{target:impact.target,impacts:[impact]});
  }
  const anchors=new Map<string,FxPoint>();let labels:FxLabel[]=[],dirty=true;
  return (positionFor:(target:Target)=>FxPoint|undefined)=>{
    for(const [id,group] of groups){
      const p=positionFor(group.target),old=anchors.get(id);
      if(p&&(!old||p.x!==old.x||p.y!==old.y)){anchors.set(id,{x:p.x,y:p.y});dirty=true;}
      else if(!p&&old){anchors.delete(id);dirty=true;}
    }
    if(dirty){labels=layoutImpactLabels([...groups].flatMap(([id,group])=>{const position=anchors.get(id);return position?[{key:id,position,impacts:group.impacts}]:[];}),width,height);dirty=false;}
    return labels;
  };
}

/** Cache deterministic particle geometry per accepted cue, so repeated frames
 * do not recompute random seeds or trigonometry. Lower density uses a prefix. */
export function fxRandom(seed:number){const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n);}
export type FxParticle={angle:number;cos:number;sin:number;velocity:number;size:number};
export function createParticleCache(){
  const cached=new Map<string,FxParticle[]>();
  return (seed:number,scale:number,count:number):readonly FxParticle[]=>{
    const id=`${seed}:${scale}`;let particles=cached.get(id);if(!particles){particles=[];cached.set(id,particles);}
    for(let i=particles.length;i<count;i++){
      const angle=fxRandom(seed+i*3)*Math.PI*2;
      particles.push({angle,cos:Math.cos(angle),sin:Math.sin(angle),velocity:(.45+fxRandom(seed+i*3+1))*scale,size:(2+5*fxRandom(seed+i*3+2))*scale});
    }
    return particles;
  };
}
