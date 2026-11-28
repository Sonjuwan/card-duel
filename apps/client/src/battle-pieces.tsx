import {BATTLE_HOLD_DELAY} from './hover-timing.ts';
import { memo, useContext, useRef } from 'react';
import type { DragEvent, KeyboardEvent, ReactNode } from 'react';
import { canAttackMinion, getHeroPower } from '../../../packages/engine/src/index.ts';
import type { Card, Catalog, HeroClass, Minion, PlayerId, PlayerView, PublicPlayer, Rarity, Target } from '../../../packages/engine/src/index.ts';
import { className, heroPowerDescription, keywords, tribes } from './data.ts';
import { LocalCardArt, LocalHeroArt, LocalPowerArt, LocalCardBack } from './local-art.tsx';
import { useCardName, ClassicNamesContext, coinDescription, displayCardName } from './card-names.ts';
import { fanSlot } from './table-visuals.ts';
import { useCardHover } from './hover-context.ts';
import {targetPickerRows,placementOptions,keyboardTargetIndex} from './battle-actions.ts';
import type {TargetPickerRow,Selection} from './battle-actions.ts';

export function targetRowText(row:TargetPickerRow,catalog:Catalog,classic:boolean){
  const owner=row.side==='self'?'내':'상대',name=row.kind==='hero'?(row.heroForm==='jaraxxus'?'군주 자락서스':className[row.heroClass]):catalog[row.cardId]?displayCardName(catalog[row.cardId],classic):row.cardId;
  const baseDetail=row.kind==='hero'?`영웅 · 생명력 ${row.health}${row.armor?` · 방어도 ${row.armor}`:''}`:`전장 ${row.position+1}번 · ${row.attack}/${row.health}`;
  const detail=baseDetail+(row.publicStatuses?.length?` · ${row.publicStatuses.join(' · ')}`:'');
  return {name:`${owner} ${name}`,detail,baseDetail,compact:`${owner} ${name}${row.kind==='hero'?' 영웅':` (${row.position+1}번)`}`};
}

/** Explicit, large touch alternatives for selected targets on crowded boards. */
export function TargetPicker({view,seat,targets,catalog,sourceLabel,onChoose}:{view:PlayerView;seat:PlayerId;targets:readonly Target[];catalog:Catalog;sourceLabel?:string;onChoose:(target:Target,keyboard:boolean)=>void}){
  const classic=useContext(ClassicNamesContext),detailsRef=useRef<HTMLDetailsElement>(null),rows=targetPickerRows(view,seat,targets);if(!rows.length)return null;
  const closeList=()=>{const details=detailsRef.current;if(!details)return;details.open=false;details.querySelector<HTMLElement>('summary')?.focus();};
  const navigateTargets=(event:KeyboardEvent<HTMLDetailsElement>)=>{
    const details=detailsRef.current;
    if(!details?.open||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    const buttons=[...details.querySelectorAll<HTMLButtonElement>('.target-picker-row')];
    const next=keyboardTargetIndex(event.key,buttons.indexOf(event.target as HTMLButtonElement),buttons.length);
    if(next===null)return;
    event.preventDefault();event.stopPropagation();buttons[next].focus();
  };
  return <details ref={detailsRef} className="target-picker" onKeyDown={navigateTargets}><summary aria-label={sourceLabel?`${sourceLabel} · 선택 가능한 대상 ${rows.length}개`:`선택 가능한 대상 ${rows.length}개`} title="방향키로 이동, PageUp/PageDown으로 5개씩 이동, Enter로 선택">대상 목록 {rows.length}</summary><div className="target-picker-panel" role="group" aria-label={sourceLabel?`${sourceLabel} · 합법 대상 목록`:"합법 대상 목록"}><button type="button" className="target-picker-close" onClick={closeList} aria-label="대상 목록 닫기">{sourceLabel&&<span className="target-picker-source" aria-hidden="true">{sourceLabel}</span>}<span>대상 목록 닫기</span></button>{rows.map(row=>{
    const {name,detail,baseDetail}=targetRowText(row,catalog,classic);
    return <button type="button" key={row.target.kind==='hero'?`hero:${row.target.player}`:`minion:${row.target.instanceId}`} className={`target-picker-row ${row.side}`} aria-label={`${name}, ${detail}`} onClick={e=>onChoose(row.target,e.detail===0)}><strong>{name}</strong><small>{baseDetail}</small>{!!row.publicStatuses?.length&&<span className="target-picker-flags" aria-hidden="true">{row.publicStatuses.map(tag=><span key={tag} className={`target-flag-${tag==='천상의 보호막'?'shield':tag==='빙결'?'freeze':tag==='면역'?'immune':'taunt'}`}>{tag}</span>)}</span>}</button>;
  })}</div></details>;
}

/** A native select gives touch and keyboard users access to every gap even
 * if the actual battlefield slot is only a few pixels wide or off-screen. */
export function PlacementPicker({view,seat,catalog,selection,position,onChoose}:{view:PlayerView;seat:PlayerId;catalog:Catalog;selection:Selection|null;position:number;onChoose:(position:number)=>void}){
  const classic=useContext(ClassicNamesContext),options=placementOptions(view,seat,catalog,selection);
  if(options.length<=1)return null;
  const name=(id:string)=>catalog[id]?displayCardName(catalog[id],classic):id;
  return <label className="placement-picker"><span>배치 {position+1}/{options.length}</span><select aria-label="하수인 배치 위치 선택" value={position} onChange={e=>{const next=Number(e.currentTarget.value);if(options.some(o=>o.position===next))onChoose(next);}}>{options.map(o=><option key={o.position} value={o.position}>{o.position+1}번 · {o.leftCardId&&o.rightCardId?`${name(o.leftCardId)} / ${name(o.rightCardId)} 사이`:o.leftCardId?'오른쪽 끝':'왼쪽 끝'}</option>)}</select></label>;
}

type Glyph = HeroClass|'neutral'|'minion'|'spell'|'weapon'|'secret'|'coin'|'deck'|'blood'|'life'|'shield'|'mana'|'beast'|'demon'|'dragon'|'murloc'|'pirate'|'totem';
const glyphs:Record<Glyph,ReactNode>={
  warrior:<><path d="m13 12 33 33-8 8L5 20zM38 14 16 36m28-16L22 42M8 46l10 10 10-10"/><path d="m45 5 10 4-4 10-7 1-4-4z"/></>,
  shaman:<><path d="M34 4 12 35h19l-2 25 23-34H33z"/><path d="m9 9 5 7m42 35-6-6"/></>,
  rogue:<><path d="M9 8 48 33 31 42 22 57zM55 8 16 33l17 9 9 15z"/><path d="M22 22 42 42M42 22 22 42"/></>,
  paladin:<><path d="M32 6v52M6 32h52M14 14l36 36m0-36L14 50"/><circle cx="32" cy="32" r="17"/><circle cx="32" cy="32" r="8"/></>,
  hunter:<><path d="M19 5c31 14 31 40 0 54l5-27zM8 32h48m-9-7 9 7-9 7"/><path d="m19 5 5 27-5 27"/></>,
  druid:<><path d="M52 8C25 8 9 25 15 43c18 6 35-10 37-35ZM12 55l29-29M18 38l15 1m4-16-1 13"/></>,
  warlock:<><path d="M32 5 7 46h50zM13 25c4-10 14-15 19-15s15 5 19 15c-7 9-13 12-19 12s-12-3-19-12Z"/><circle cx="32" cy="25" r="5"/><path d="M32 46v13"/></>,
  mage:<><path d="m12 53 29-29M38 13l10-7 10 10-7 10-10-2zM15 10v14M8 17h14M50 40v13m-7-6h14"/></>,
  priest:<><path d="M32 5v54M13 21h38"/><path d="M32 8C12 8 7 20 7 31c0 14 12 25 25 25s25-11 25-25C57 20 52 8 32 8Z"/></>,
  neutral:<><path d="M32 4 56 18v28L32 60 8 46V18Z"/><path d="m32 15 15 17-15 17-15-17Z"/></>,
  minion:<><circle cx="32" cy="19" r="11"/><path d="M10 56v-9c0-12 10-20 22-20s22 8 22 20v9Z"/></>,
  beast:<><ellipse cx="12" cy="22" rx="7" ry="10" transform="rotate(-24 12 22)"/><ellipse cx="26" cy="13" rx="7" ry="10"/><ellipse cx="43" cy="15" rx="7" ry="10" transform="rotate(15 43 15)"/><ellipse cx="53" cy="29" rx="6" ry="9" transform="rotate(24 53 29)"/><path d="M20 38c7-11 19-11 24 0 4 6 10 15 3 20-5 3-10-4-16-4s-11 7-17 3c-7-5 1-14 6-19Z"/></>,
  demon:<><path d="M9 5c2 18 3 22 13 23M55 5c-2 18-3 22-13 23M14 25c3-8 11-13 18-13s15 5 18 13v14c0 13-10 20-18 20s-18-7-18-20Z"/><path d="m21 32 7 5m15-5-7 5m-13 9 9 5 9-5"/></>,
  dragon:<><path d="M8 54c2-21 12-26 27-22L27 12l27-7-4 20 9 7-20 4c-4 15-12 21-31 25Z"/><path d="M12 42 5 13l24 14m12-8 5 2m-6 21 9 9"/></>,
  murloc:<><path d="M6 32c11-16 28-23 43-7l9-8v30l-9-8C34 55 17 48 6 32Z"/><circle cx="24" cy="30" r="5"/><path d="m29 45 10-8m-9-22 2-9 12 13"/></>,
  pirate:<><path d="M10 15c0-7 8-12 22-12s22 5 22 12l-5 20H15Z"/><path d="M11 35h42M15 54 49 42M15 42l34 12"/><circle cx="24" cy="24" r="4"/><circle cx="40" cy="24" r="4"/><path d="m30 31 2-3 2 3"/></>,
  totem:<><path d="M16 5h32v54H16ZM7 17h50M7 33h50M7 49h50"/><path d="m24 10 8 5 8-5m-16 16 8 5 8-5m-16 16 8 5 8-5"/></>,
  spell:<><path d="M32 4 38 24l22 8-22 8-6 20-6-20L4 32l22-8Z"/><path d="m52 8 4 4m-44 40 4 4"/></>,
  weapon:<><path d="m47 5 12 1-1 12-35 34-11-11zM7 36l21 21M9 55l-4 4"/></>,
  secret:<><path d="M8 31c14-21 34-21 48 0-14 21-34 21-48 0Z"/><circle cx="32" cy="31" r="10"/><path d="M32 5v8m0 38v8"/></>,
  coin:<><circle cx="32" cy="32" r="26"/><circle cx="32" cy="32" r="18"/><path d="M32 19v26m8-22h-11c-13 0-13 11 0 11h6c13 0 13 11 0 11H24"/></>,
  deck:<><rect x="14" y="5" width="36" height="54" rx="6"/><path d="M22 13h20v38H22zM32 23l8 9-8 9-8-9Z"/></>,
  blood:<path d="M32 4c-5 15-21 26-21 39a21 21 0 0 0 42 0C53 30 37 19 32 4Z"/>,
  life:<path d="M32 56 8 31C-7 7 23-2 32 17 41-2 71 7 56 31Z"/>,
  shield:<path d="M32 5 55 14v19c0 12-12 21-23 27C21 54 9 45 9 33V14Z"/>,
  mana:<path d="M32 3 54 19v26L32 61 10 45V19Z M32 3v58M10 19l22 13 22-13M10 45l22-13 22 13"/>,
};
export const Sigil=memo(function Sigil({kind,className:extra=''}:{kind:Glyph;className?:string}){
  return <svg className={`sigil sigil-${kind} ${extra}`} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{glyphs[kind]}</svg>;
});
export function cardDescription(card:Card){return card.kind==='coin'?coinDescription:card.description||'효과 없음';}
export const cardKindLabel:Record<Card['kind'],string>={coin:'동전',minion:'하수인',spell:'주문',weapon:'무기',secret:'비밀'};
const rarityLabel:Record<Rarity,string>={basic:'기본',common:'일반',rare:'희귀',epic:'영웅',legendary:'전설'};
function printedCardTags(card:Card):string[]{
  const tags:string[]=[];
  if(card.kind==='minion'){
    tags.push(...(card.keywords??[]).map(k=>keywords[k]));
    if(card.battlecry?.length)tags.push('전투의 함성');
    if(card.deathrattle?.length)tags.push('죽음의 메아리');
    if(card.spellDamage)tags.push(`주문 공격력 +${card.spellDamage}`);
  }
  if(card.kind==='weapon'&&card.battlecry?.length)tags.push('전투의 함성');
  if((card.kind==='minion'||card.kind==='spell')&&card.choices?.length)tags.push('선택 효과');
  return [...new Set(tags)];
}
function cardFaction(card:Card):Glyph{return card.kind==='coin'?'coin':card.class;}
export function factionLabel(card:Card){return card.kind==='coin'?'시스템':card.class==='neutral'?'중립':className[card.class];}
export function minionTags(m:Minion):string[]{return [
  ...(m.keywords??[]).map(k=>keywords[k]),
  ...(m.silenced?['침묵']:[]),
  ...(m.auraCharge&&!m.keywords?.includes('charge')?['돌진(지속)']:[]),
  ...(m.auraWindfury&&!m.keywords?.includes('windfury')?['질풍(지속)']:[]),
  ...(m.bonusSpellDamage?[`주문 공격력 +${m.bonusSpellDamage}`]:[]),
  ...(m.stealthUntilStartOf!==undefined?['임시 은신']:[]),
  ...(m.drawOnAttackOwners?.length?['공격 시 드로우']:[]),
  ...(m.deathrattleSummons?.length?['소환 죽음의 메아리']:[]),
  ...(m.frozenThroughTurn!==undefined?['빙결']:[]),
  ...(m.immuneThisTurn?['면역']:[]),
  ...(m.returnController!==undefined?['임시 조종']:[]),
  ...((m.destroyAtStartOf?.length||m.destroyAtEndOf?.length)?['파멸 예정']:[])];}
export type Inspectable={card:Card;minion?:Minion;weapon?:{attack:number;durability:number};cost?:number;reason?:string;title?:string};
type Interactive={enabled?:boolean;ready?:boolean;selected?:boolean;targeted?:boolean;dropTarget?:boolean;sourceId?:string;onClick?:(keyboard:boolean)=>void;onInspect?:(item:Inspectable)=>void;onDragStart?:(event:DragEvent<HTMLButtonElement>)=>void;onDragEnd?:()=>void;onDragOver?:(event:DragEvent<HTMLButtonElement>)=>void;onDrop?:(event:DragEvent<HTMLButtonElement>)=>void;};

export function BattleCard({card,cost=card.cost,reason,enabled=false,ready=false,selected=false,previewOpen=false,onClick,onInspect,onDragStart,onDragEnd,mulligan=false,sourceId,onBlocked,actionLabel}:Omit<Interactive,'onClick'>&{onClick?:(keyboard:boolean,source:HTMLButtonElement)=>void;card:Card;cost?:number;reason?:string;mulligan?:boolean;onBlocked?:()=>void;previewOpen?:boolean;actionLabel?:string}){
  const displayName=useCardName(card);const info={card,cost,reason};const rarity=card.kind==='coin'?'basic':card.rarity;const hover=useCardHover(info,sourceId?.startsWith('card:')?BATTLE_HOLD_DELAY:undefined,Boolean(sourceId?.startsWith('card:')&&!mulligan));
  return <button type="button" className={`battle-card faction-${cardFaction(card)} kind-${card.kind} rarity-${rarity}${ready?' is-ready':''}${selected?' is-selected':''}${previewOpen?' is-preview-expanded':''}${!enabled?' is-disabled':''}${mulligan&&selected?' is-replacing':''}`} data-preview-card={card.id} data-preview-cost={cost} data-action-source={sourceId} aria-disabled={!enabled} aria-expanded={previewOpen||Boolean(sourceId?.startsWith('card:')&&selected)||undefined} aria-description={cardDescription(card)} aria-pressed={mulligan||sourceId?.startsWith('card:')?selected:undefined} aria-label={`${displayName}, 마나 ${cost}, ${cardKindLabel[card.kind]}${card.kind==='minion'?`, 공격력 ${card.attack}, 생명력 ${card.health}`:card.kind==='weapon'?`, 공격력 ${card.attack}, 내구도 ${card.durability}`:''}${reason?`, ${reason}`:''}${mulligan&&selected?', 교체 선택':''}${actionLabel?', '+actionLabel:''}`} onClick={e=>{if(hover.consumeTouchClick(e.nativeEvent))return;hover.clear();if(enabled)onClick?.(e.detail===0,e.currentTarget);else onBlocked?.();}} onPointerEnter={e=>{onInspect?.(info);if(e.pointerType!=='touch')hover.start(e.currentTarget);}} onPointerLeave={hover.leave} onContextMenu={e=>{if(e.nativeEvent instanceof PointerEvent&&e.nativeEvent.pointerType!=='mouse')e.preventDefault();}} {...hover.touchProps} onFocus={e=>{onInspect?.(info);if(e.currentTarget.matches(':focus-visible'))hover.start(e.currentTarget);}} onBlur={hover.leave} draggable={enabled&&!!onDragStart} onDragStart={e=>{hover.clear();onDragStart?.(e);}} onDragEnd={onDragEnd}>
    <span className={`card-mana${cost<card.cost?' discounted':cost>card.cost?' increased':''}`}>{cost}</span>
    <span className="card-art"><LocalCardArt card={card}/></span>
    <span className="card-name"><Sigil kind={cardFaction(card)} className="card-faction-mark"/>{displayName}</span>
    <span className="card-rarity-anchor" aria-label={rarity==='legendary'?'전설 등급':rarity==='epic'?'영웅 등급':rarity==='rare'?'희귀 등급':rarity==='common'?'일반 등급':'기본 카드'}><span className="rarity-gem" aria-hidden="true"/></span>
    <span className="card-copy">{cardDescription(card)}</span>
    {(card.kind==='minion'||card.kind==='weapon')&&<span className="card-statline"><span className="stat stat-attack">{card.attack}</span>{card.kind==='minion'&&card.tribe!=='none'&&tribes[card.tribe]&&<span className="card-tribe">{tribes[card.tribe]}</span>}<span className={card.kind==='weapon'?'stat stat-health stat-durability':'stat stat-health'}>{card.kind==='minion'?card.health:card.durability}</span></span>}
    {mulligan&&selected&&<span className="replace-banner mulligan-replace-cross" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M12 12 L88 88 M88 12 L12 88" /></svg></span>}
  </button>;
}
export function statTone(current:number,base:number){return current>base?'increased':current<base?'reduced':'normal';}

export function BattleMinion({card,minion,catalog,ownTurn,turn,enabled=false,ready=false,selected=false,targeted=false,dropTarget=false,onClick,onInspect,onDragStart,onDragEnd,onDragOver,onDrop,sourceId,entering=false,delta=0,preparing=false,remainingAttacks=minion.attacksRemaining,blocked=false,attackChanged=false}:Interactive&{card:Card;minion:Minion;catalog:Catalog;ownTurn:boolean;turn?:number;entering?:boolean;delta?:number;preparing?:boolean;remainingAttacks?:number;blocked?:boolean;attackChanged?:boolean}){
  const displayName=useCardName(card);const tags=minionTags(minion),status=minion.frozenThroughTurn!==undefined?'빙결':card.kind==='minion'&&card.noAttack&&!minion.silenced?'공격 불가':ownTurn&&canAttackMinion(minion,catalog)?`공격 가능 ${minion.attacksRemaining}회`:'대기';
  const attackTone=card.kind==='minion'?statTone(minion.attack,card.attack):'normal';
  const healthTone=minion.health<minion.maxHealth?'reduced':card.kind==='minion'?statTone(minion.maxHealth,card.health):'normal';
  const info={card,minion};const hover=useCardHover(info,BATTLE_HOLD_DELAY,!targeted);
  const magic=!minion.silenced&&card.kind==='minion'?(card.spellDamage??0)+(minion.bonusSpellDamage??0):0;
  const waiting=ownTurn&&turn!==undefined&&minion.summonedTurn===turn&&minion.attacksRemaining===0&&
    (minion.attacksMadeThisTurn??0)===0&&!minion.auraCharge&&!minion.keywords?.includes('charge');
  const persistent=!minion.silenced&&card.kind==='minion'&&Boolean(card.auras?.length||card.costAuras?.length||card.startTurn?.length||card.endTurn?.length||card.endAnyTurn?.length);
  const taunt=minion.keywords?.includes('taunt'),shield=minion.keywords?.includes('divineShield'),stealth=minion.keywords?.includes('stealth')||minion.stealthUntilStartOf!==undefined;
  return <button type="button" className={`battle-minion faction-${cardFaction(card)}${ready?' is-ready':''}${selected?' is-selected':''}${targeted?' is-targeted':''}${dropTarget?' is-drop-target':''}${taunt?' has-taunt':''}${shield?' has-shield':''}${stealth?' has-stealth':''}${minion.keywords?.includes('windfury')||minion.auraWindfury?' has-windfury':''}${minion.frozenThroughTurn!==undefined?' is-frozen':''}${minion.silenced?' is-silenced':''}${minion.immuneThisTurn?' is-immune':''}${entering?' is-entering':''}${preparing?' is-preparing':''}${blocked?' is-attack-blocked':''}${magic?' has-spell-power':''}${delta<0?' is-hit':delta>0?' is-healed':''}`} data-preview-card={card.id} data-preview-minion={minion.instanceId} data-action-source={sourceId} aria-disabled={!enabled} aria-pressed={sourceId&&!targeted?selected:undefined} aria-description={[minion.silenced?'침묵 (효과 제거)':cardDescription(card),targeted?'선택 가능한 대상':selected?'공격 선택 중, 다시 누르면 취소':ready?'공격 가능':''].filter(Boolean).join(' · ')} aria-label={`${displayName}, 공격력 ${minion.attack}, 생명력 ${minion.health}, ${[...tags,status].join(', ')}`} onClick={e=>{if(hover.consumeTouchClick(e.nativeEvent))return;hover.clear();if(enabled)onClick?.(e.detail===0);}} onFocus={e=>{onInspect?.(info);if(e.currentTarget.matches(':focus-visible'))hover.start(e.currentTarget);}} onBlur={hover.leave} onPointerEnter={e=>{onInspect?.(info);if(e.pointerType!=='touch')hover.start(e.currentTarget);}} onPointerLeave={hover.leave} onContextMenu={e=>{if(e.nativeEvent instanceof PointerEvent&&e.nativeEvent.pointerType!=='mouse')e.preventDefault();}} {...hover.touchProps} draggable={enabled&&!!onDragStart} onDragStart={e=>{hover.clear();onDragStart?.(e);}} onDragEnd={onDragEnd} onDragOver={onDragOver} onDrop={onDrop}>
    <span className="minion-medallion"><LocalCardArt card={card}/>{shield&&<span className="shield-ring"/>}<span className="stealth-veil" aria-hidden="true"/></span>
    <span className="minion-status-icons" aria-hidden="true">{(minion.keywords?.includes('windfury')||minion.auraWindfury)&&<i className="status-wind">≋{ownTurn?remainingAttacks:null}</i>}{!minion.silenced&&(card.kind==='minion'&&!!card.deathrattle||!!minion.deathrattleSummons?.length)&&<i className="status-death">☠</i>}{!minion.silenced&&((card.kind==='minion'?card.spellDamage??0:0)+(minion.bonusSpellDamage??0)>0)&&<i className="status-magic">✦</i>}{minion.keywords?.includes('poisonous')&&<i className="status-poison">☣</i>}{(minion.keywords?.includes('charge')||minion.auraCharge)&&<i className="status-charge">➤</i>}{minion.silenced&&<i className="status-silence">⊘</i>}{waiting&&<i className="status-wait">Zz</i>}{persistent&&<i className="status-persistent">◈</i>}</span>
    <span className="minion-statline" aria-hidden="true"><span className="stat stat-attack" data-stat-tone={attackTone} data-stat-changed={attackChanged||undefined}>{minion.attack}</span><span className={`stat stat-health${minion.health<minion.maxHealth?' damaged':''}`} data-stat-tone={healthTone} data-stat-changed={delta!==0||undefined}>{minion.health}</span></span>{delta!==0&&<span className={`motion-delta ${delta<0?'damage':'heal'}`} aria-hidden="true">{delta>0?'+':''}{delta}</span>}
  </button>;
}
export function HeroPortrait({player,label,shatter=false,enabled=false,ready=false,selected=false,targeted=false,dropTarget=false,onClick,onDragStart,onDragEnd,onDragOver,onDrop,sourceId,delta=0,blocked=false,preparing=false}:Interactive&{blocked?:boolean;preparing?:boolean;player:PublicPlayer;label:string;delta?:number;shatter?:boolean}){
  const attack=player.heroAttack+(player.weapon?.attack??0);
  return <button type="button" className={`hero-portrait faction-${player.heroClass}${ready?' is-ready':''}${selected?' is-selected':''}${targeted?' is-targeted':''}${dropTarget?' is-drop-target':''}${player.heroFrozenThroughTurn!==undefined?' is-frozen':''}${blocked?' is-attack-blocked':''}${preparing?' is-preparing':''}${delta<0?' is-hit':delta>0?' is-healed':''}`} data-shattered={shatter||undefined} data-action-source={sourceId} aria-disabled={!enabled} aria-pressed={sourceId&&!targeted?selected:undefined} aria-description={targeted?'선택 가능한 대상':selected?'공격 선택 중, 다시 누르면 취소':ready?'공격 가능':undefined} aria-label={`${label} · ${(player.heroForm==='jaraxxus'?'군주 자락서스':className[player.heroClass])}, 생명력 ${player.health}, 방어도 ${player.armor}, 공격력 ${attack}${player.heroFrozenThroughTurn!==undefined?', 빙결':''}`} title={`${label} · ${(player.heroForm==='jaraxxus'?'군주 자락서스':className[player.heroClass])} · 생명력 ${player.health}${player.armor?` · 방어도 ${player.armor}`:''} · 공격력 ${attack}${player.heroFrozenThroughTurn!==undefined?' · 빙결':''}${player.heroImmuneThisTurn?' · 면역':''}`} onClick={e=>{if(enabled)onClick?.(e.detail===0);}} draggable={enabled&&!!onDragStart} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver} onDrop={onDrop}>
    <span className="hero-emblem"><LocalHeroArt heroClass={player.heroClass} heroForm={player.heroForm}/></span>
    {shatter&&<span className="hero-break" aria-hidden="true">{[0,1,2,3,4,5].map(i=><span key={i} className="hero-shard"><LocalHeroArt heroClass={player.heroClass} heroForm={player.heroForm}/></span>)}<span className="hero-crack"/>{Array.from({length:8},(_,i)=><i key={i} style={{'--ray':`${i*45}deg`} as React.CSSProperties}/>)}</span>}
    <span className="hero-label">{label} · {(player.heroForm==='jaraxxus'?'군주 자락서스':className[player.heroClass])}</span>
    {attack>0&&<span className="stat stat-attack hero-attack">{attack}</span>}
    {player.armor>0&&<span className="hero-armor"><Sigil kind="shield"/>{player.armor}</span>}
    <span className={`stat stat-health hero-health${player.health<(player.maxHealth??30)?' damaged':''}`}>{player.health}</span>
    {player.heroFrozenThroughTurn!==undefined&&<span className="hero-freeze">빙결</span>}{player.heroImmuneThisTurn&&<span className="hero-freeze hero-immune">면역</span>}{delta!==0&&<span className={`motion-delta ${delta<0?'damage':'heal'}`} aria-hidden="true">{delta>0?'+':''}{delta}</span>}
  </button>;
}
export function HeroPower({player,onClick,enabled=false,ready=false,selected=false,reason,sourceId,onDragStart,onDragEnd}:Interactive&{player:PublicPlayer;reason?:string}){
  const power=getHeroPower(player);
  return <button type="button" className={`hero-power faction-${player.heroClass}${ready?' is-ready':''}${selected?' is-selected':''}${player.heroPowerUsed?' spent':''}`} data-action-source={sourceId} aria-disabled={!enabled} aria-pressed={sourceId&&power.targetRule?selected:undefined} aria-description={selected?'능력 선택 중, 다시 누르면 취소':ready?'사용 가능':undefined} aria-label={`${power.name} (${power.cost}마나)${reason?', '+reason:''}`} title={`${power.name} (${power.cost}마나) · ${(player.heroForm==='jaraxxus'?'6/6 지옥불정령을 소환합니다.':player.shadowformLevel?'캐릭터 하나에게 피해 '+(player.shadowformLevel+1)+'를 줍니다.':heroPowerDescription[player.heroClass])}${reason?' · '+reason:''}`} onClick={e=>{if(enabled)onClick?.(e.detail===0);}} draggable={enabled&&!!onDragStart} onDragStart={onDragStart} onDragEnd={onDragEnd}>
    <span className="power-medallion"><LocalPowerArt heroClass={player.heroClass} shadowformLevel={player.shadowformLevel} heroForm={player.heroForm}/><span className="power-mana">{power.cost}</span></span><span className="power-label">{player.heroPowerUsed?'사용 완료':power.name}</span>
  </button>;
}
export function WeaponSlot({player,catalog,onInspect}:{player:PublicPlayer;catalog:Catalog;onInspect?:(item:Inspectable)=>void}){
  const classicNames=useContext(ClassicNamesContext);
  const weapon=player.weapon,card=weapon?.cardId?catalog[weapon.cardId]:undefined,name=card?displayCardName(card,classicNames):'장착 무기';
  const info=weapon&&card?{card,weapon}:null,hover=useCardHover(info),inspect=()=>{if(info)onInspect?.(info);};
  return <div className={`weapon-slot${weapon?' equipped':''}`} aria-label={weapon?`${name}, 공격력 ${weapon.attack}, 내구도 ${weapon.durability}`:'장착한 무기가 없습니다'} tabIndex={card?0:undefined} onPointerEnter={e=>{inspect();if(card&&e.pointerType!=='touch')hover.start(e.currentTarget);}} onPointerLeave={hover.leave} {...hover.touchProps} onPointerDown={e=>{inspect();hover.touchProps.onPointerDown(e);}} onFocus={e=>{inspect();if(card)hover.start(e.currentTarget);}} onBlur={hover.leave} title={weapon?`${name} · ${weapon.attack}/${weapon.durability}`:'장착한 무기가 없습니다'}><span className="weapon-medallion">{card?<LocalCardArt card={card}/>:<Sigil kind="weapon"/>}{weapon&&<><span className="stat stat-attack">{weapon.attack}</span><span className="stat stat-health">{weapon.durability}</span></>}</span><span className="weapon-label">{weapon?name:'무기 없음'}</span></div>;
}
export function ManaDisplay({player,compact=false,charging=false,previewCost}:{player:PublicPlayer;compact?:boolean;charging?:boolean;previewCost?:number}){
  return <ManaReadout mana={player.mana} maxMana={player.maxMana} lockedMana={player.lockedMana} pendingOverload={player.pendingOverload} compact={compact} charging={charging} previewCost={previewCost}/>;
}
const ManaReadout=memo(function ManaReadout({mana,maxMana,lockedMana,pendingOverload,compact,charging,previewCost}:Pick<PublicPlayer,'mana'|'maxMana'|'lockedMana'|'pendingOverload'>&{compact:boolean;charging:boolean;previewCost?:number}){
  const unlocked=Math.max(0,maxMana-lockedMana),extra=Math.max(0,mana-unlocked);
  const slots=Math.min(10,Math.max(0,maxMana+extra));
  const gem=(i:number)=>i>=slots?'future':i>=unlocked&&i<maxMana?'locked':i<Math.min(mana,unlocked)||i>=maxMana&&i<maxMana+extra?'filled':'spent';
  const spent=Math.max(0,unlocked-Math.min(mana,unlocked));
  const preview=previewCost!==undefined&&previewCost<=mana;
  const filled=Array.from({length:10},(_,i)=>i).filter(i=>gem(i)==='filled');
  const spending=new Set(preview?filled.slice(Math.max(0,filled.length-previewCost!)):[]);
  const resourceLabel=`마나 ${mana}/${maxMana}, 사용한 마나 ${spent}${lockedMana?`, 잠긴 마나 ${lockedMana}`:''}${extra?`, 추가 마나 ${extra}`:''}${pendingOverload?`, 다음 턴 과부하 ${pendingOverload}`:''}${preview?`, 사용 후 예상 마나 ${mana-previewCost!}`:''}`;
  return <div className={`mana-display${compact?' compact':''}`} data-charging={charging||undefined} data-preview-insufficient={previewCost!==undefined&&previewCost>mana||undefined} role="group" aria-label={resourceLabel} title={resourceLabel}>
    <span className="mana-number"><span className="mana-jewel" aria-hidden="true"/>{preview?mana-previewCost!:mana}<small>/{maxMana}</small>{preview&&<small className="mana-preview-label">예상</small>}</span>
    <span className="mana-crystals" aria-hidden="true">{Array.from({length:10},(_,i)=>{const state=gem(i);return <span key={i} className={`mana-crystal ${state}${spending.has(i)?' preview-spend':''}`}>{state==='locked'?'🔒':''}</span>;})}</span>
    {(pendingOverload>0||lockedMana>0)&&<span className="mana-warning">{lockedMana>0?`🔒 ${lockedMana}`:''}{lockedMana>0&&pendingOverload>0?' · ':''}{pendingOverload>0?`다음 과부하 ${pendingOverload}`:''}</span>}
  </div>;
});
export const HiddenHand=memo(function HiddenHand({count}:{count:number}){
  return <div className="hidden-hand" aria-label={`상대 손패 ${count}장`}><div className="card-back-row" aria-hidden="true">{Array.from({length:Math.max(0,Math.min(10,count))},(_,i)=><span key={i} className={`opponent-card-slot ${fanSlot(i,Math.min(10,count))}`}><span className="card-back"><LocalCardBack/></span></span>)}</div><span className="hand-count">손패 {count}/10</span></div>;
});
export function DeckPile({player,label}:{player:PublicPlayer;label:string}){
  return <DeckReadout deckCount={player.deckCount} fatigue={player.fatigue} label={label}/>;
}
const DeckReadout=memo(function DeckReadout({deckCount,fatigue,label}:Pick<PublicPlayer,'deckCount'|'fatigue'>&{label:string}){
  return <div className={`deck-pile${!deckCount?' empty':''}`} aria-label={`${label} 덱 ${deckCount}장${fatigue?`, 탈진 ${fatigue}`:''}`} title={`${label} 덱 ${deckCount}장${fatigue?` · 탈진 ${fatigue}`:''}`}><span className="deck-stack" aria-hidden="true" style={{'--deck-depth':Math.min(9,Math.ceil(deckCount/4)) + 'px'} as React.CSSProperties}>{deckCount>0&&<LocalCardBack/>}</span><span className="deck-number">{deckCount}</span><small>{fatigue?`탈진 ${fatigue}`:`${label} 덱`}</small></div>;
});
function SecretGem({card,name}:{card?:Card;name?:string}){
  const hover=useCardHover(card?{card}:null);
  return <span className="secret-gem" title={name??'비공개 비밀'} tabIndex={card?0:undefined} onPointerEnter={e=>{if(card&&e.pointerType!=='touch')hover.start(e.currentTarget);}} onPointerLeave={hover.leave} onPointerCancel={hover.clear} onFocus={e=>{if(card)hover.start(e.currentTarget);}} onBlur={hover.leave}>?</span>;
}
export function Secrets({count,names,cards}:{count:number;names?:string[];cards?:Card[]}){
  return <div className="secret-row" aria-label={`${names?'내 비밀':'상대 비밀'} ${count}개${names?.length?', '+names.join(', '):''}`} title={names?`내 비밀: ${names.join(', ')||'없음'}`:`상대 비밀 ${count}개 (이름 비공개)`}>{Array.from({length:count},(_,i)=><SecretGem key={i} card={cards?.[i]} name={names?.[i]}/>)}{count===0&&<small>비밀 없음</small>}</div>;
}
export function CardInspector({item,catalog}:{item:Inspectable|null;catalog:Catalog}){
  if(!item)return <div className="card-inspector empty"><Sigil kind="deck"/><b>카드 확인</b><p>카드를 가리키거나 터치하면 능력과 상태가 표시됩니다.</p></div>;
  return <InspectedCard item={item} catalog={catalog}/>;
}
function InspectedCard({item,catalog}:{item:Inspectable;catalog:Catalog}){
  const {card,minion,weapon,cost,reason}=item;const displayName=useCardName(card),printedTags=minion?[]:printedCardTags(card);
  return <div className={`card-inspector faction-${cardFaction(card)}`} role="group" aria-label="카드 상세"><div className="inspect-heading"><span className="inspect-sigil"><LocalCardArt card={card}/></span><div><strong>{displayName}</strong><small>{factionLabel(card)} · {cardKindLabel[card.kind]}{card.kind!=='coin'?` · ${rarityLabel[card.rarity]}`:''}</small></div></div><div className="inspect-stats"><span>마나 <b>{cost??card.cost}</b></span>{card.kind==='minion'&&<><span>공격 <b>{minion?.attack??card.attack}</b></span><span>체력 <b>{minion?.health??card.health}</b>{minion&&<small> / {minion.maxHealth}</small>}</span></>}{card.kind==='weapon'&&<><span>공격 <b>{weapon?.attack??card.attack}</b></span><span>내구 <b>{weapon?.durability??card.durability}</b></span></>}</div><p>{minion?.silenced?'침묵 (효과 제거)':cardDescription(card)}</p>{printedTags.length>0&&<ul className="inspect-ability-tags" aria-label="기본 능력">{printedTags.map(tag=><li key={tag}>{tag}</li>)}</ul>}{minion&&card.kind==='minion'&&(minion.attack!==card.attack||minion.maxHealth!==card.health)&&<small className="inspect-status">기본 공격/체력 {card.attack}/{card.health}</small>}{minion&&!minion.silenced&&card.kind==='minion'&&!!((card.spellDamage??0)+(minion.bonusSpellDamage??0))&&<small>주문 공격력 +{(card.spellDamage??0)+(minion.bonusSpellDamage??0)}</small>}{minion&&<small className="inspect-status">{minionTags(minion).join(' · ')||'추가 상태 없음'}</small>}{weapon&&<small className="inspect-status">현재 장착 중 · 기본 {card.kind==='weapon'?`${card.attack}/${card.durability}`:'—'}</small>}{reason&&<small className="inspect-reason">{reason}</small>}{card.kind==='minion'&&card.tribe!=='none'&&<small>{tribes[card.tribe]}</small>}{minion&&canAttackMinion(minion,catalog)&&<small>남은 공격 {minion.attacksRemaining}회</small>}</div>;
}
