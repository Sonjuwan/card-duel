import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createHoverTiming } from './hover-timing.ts';
import { HoverContext } from './hover-context.ts';
import type { CardPreview } from './hover-context.ts';
import { CardFace,cardDescription, factionLabel, cardKindLabel, minionTags } from './battle-pieces.tsx';
import { useCardName } from './card-names.ts';
import { keywords } from './data.ts';
import { cardSetLabel } from './card-sets.ts';
import type { Keyword } from '../../../packages/engine/src/index.ts';

const keywordHelp:Record<Keyword,string>={taunt:'적은 도발 하수인부터 공격해야 합니다.',charge:'소환한 턴에도 바로 공격할 수 있습니다.',divineShield:'처음 받는 피해를 한 번 막습니다.',windfury:'한 턴에 두 번 공격할 수 있습니다.',stealth:'상대가 대상으로 지정하거나 공격할 수 없습니다. 공격하거나 피해를 주면 풀립니다.',poisonous:'피해를 입힌 상대 하수인을 파괴합니다.'};

export function CardHoverPanel({preview,example=false}:{preview:CardPreview;example?:boolean}){
  const {card,minion,weapon,cost,reason}=preview.item;
  const name=useCardName(card);
  const tags=minion?minionTags(minion):[];
  const rarity=card.kind==='coin'?'basic':card.rarity;
  const powers=card.kind==='minion'?new Set<Keyword>(minion?minion.keywords??[]:card.keywords??[]):new Set<Keyword>();
  if(minion?.auraCharge)powers.add('charge');if(minion?.auraWindfury)powers.add('windfury');if(minion?.stealthUntilStartOf!==undefined)powers.add('stealth');
  return <aside className={`card-hover-panel hover-${preview.side}${example?' hover-example':''}`} role="tooltip" aria-label={`${name} 확대 카드`} data-hover-preview>
    <div className={`battle-card hover-large-card faction-${card.kind==='coin'?'coin':card.class} kind-${card.kind} rarity-${rarity}`}>
      <CardFace card={card} name={name} cost={cost} attack={minion?.attack??weapon?.attack} health={minion?.health??weapon?.durability}/>
    </div>
    <div className="hover-details"><span className="hover-caption">카드 상세 · {cardSetLabel(card)}</span><strong>{name}</strong><span className="hover-class">{factionLabel(card)} · {cardKindLabel[card.kind]} · {rarity==='legendary'?'전설':rarity==='epic'?'영웅':rarity==='rare'?'희귀':rarity==='common'?'일반':'기본'}</span>
      <div className="hover-description">{cardDescription(card)}{minion?.silenced&&<small>침묵 (원래 카드 효과 제거)</small>}</div>
      {minion&&<div className="hover-live"><b>전장 능력치</b><span>공격 {minion.attack} · 생명력 {minion.health}/{minion.maxHealth}</span>{card.kind==='minion'&&!minion.silenced&&!!((card.spellDamage??0)+(minion.bonusSpellDamage??0))&&<span>주문 공격력 +{(card.spellDamage??0)+(minion.bonusSpellDamage??0)}</span>}{tags.length>0&&<span>{tags.join(' · ')}</span>}</div>}
      {weapon&&<div className="hover-live"><b>장착 중인 능력치</b><span>공격 {weapon.attack} · 내구도 {weapon.durability}</span></div>}
      {powers.size>0&&<dl className="hover-keywords">{[...powers].map(k=><div key={k}><dt>{keywords[k]}</dt><dd>{keywordHelp[k]}</dd></div>)}</dl>}
      {reason&&<small className="hover-reason">{reason}</small>}<small className="hover-dismiss">다른 곳을 터치하거나 Esc로 닫기 · 마우스는 영역 밖으로 이동</small>
    </div>
  </aside>;
}

export function HoverPreviewProvider({children,resetKey,refreshKey}:{children:ReactNode;resetKey:string;refreshKey?:number|string}){
  const [preview,setPreview]=useState<CardPreview|null>(null);
  const controls=useMemo(()=>createHoverTiming<CardPreview>(setPreview),[]);
  // Clean synchronously before the next painted board; no stale battle states.
  useLayoutEffect(()=>{controls.clear();},[controls,resetKey]);
  useLayoutEffect(()=>{controls.refresh();},[controls,refreshKey]);
  useEffect(()=>{
    const close=()=>controls.clear(),outside=()=>controls.dismissPinned(),key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};
    window.addEventListener('pointerdown',outside,true);window.addEventListener('blur',close);window.addEventListener('keydown',key);window.addEventListener('resize',close);
    window.addEventListener('dragstart',close,true);document.addEventListener('visibilitychange',close);
    return()=>{window.removeEventListener('pointerdown',outside,true);window.removeEventListener('blur',close);window.removeEventListener('keydown',key);window.removeEventListener('resize',close);window.removeEventListener('dragstart',close,true);document.removeEventListener('visibilitychange',close);controls.clear();};
  },[controls]);
  return <HoverContext.Provider value={controls}>{children}{preview&&typeof document!=='undefined'&&createPortal(<CardHoverPanel preview={preview}/>,document.body)}</HoverContext.Provider>;
}
