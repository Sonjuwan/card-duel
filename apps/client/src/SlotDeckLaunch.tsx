import {useState} from 'react';
import type {Deck} from '../../../packages/engine/src/index.ts';
import type {AccountProfile} from '../../../packages/account-protocol.ts';
import type {SoloSlot,SlotStorage} from './solo-slots.ts';
import {readDecks} from './named-decks.ts';
import {catalog} from './data.ts';
import {offlineGrowth} from './offline-growth.ts';
import {ownedDeck,recommendedOwnedDeck} from '../../../packages/progression.ts';

type Props={
  slot:SoloSlot;
  storage:SlotStorage;
  profile?:AccountProfile;
  deck:Deck;
  ready:boolean|undefined;
  blocked:boolean|undefined;
  busy:boolean;
  onDeck:(deck:Deck)=>void;
  onManage:()=>void;
  onStart:()=>void;
};
export function SlotDeckLaunch({slot,storage,profile,deck,ready,blocked,busy,onDeck,onManage,onStart}:Props){
  const [message,setMessage]=useState('');
  let decks:ReturnType<typeof readDecks>=[];
  try{decks=readDecks(storage);}catch{/* Keep existing saved bytes intact on errors. */}
  const current=decks.findIndex(d=>d.deck.heroClass===deck.heroClass&&d.deck.cards.length===deck.cards.length&&d.deck.cards.every((id,i)=>id===deck.cards[i]));
  let owned=false;
  if(profile)try{ownedDeck(deck,catalog,profile);owned=true;}catch{/* Invalid or unowned decks are never started in player mode. */}
  const playable=!!profile&&ready===true&&!blocked&&!busy&&owned;
  const useSaved=(value:string)=>{
    const index=Number(value),selected=Number.isInteger(index)?decks[index]:undefined;
    if(!selected)return;
    onDeck(structuredClone(selected.deck));setMessage(`슬롯 ${slot}의 저장 덱 ‘${selected.name}’을 선택했습니다.`);
  };
  const recommend=()=>{
    if(!profile)return;
    try{
      onDeck(recommendedOwnedDeck(catalog,offlineGrowth(catalog),deck.heroClass,profile,Date.now()>>>0));
      setMessage(`슬롯 ${slot}의 보유 카드로 덱을 구성했습니다.`);
    }catch{setMessage('보유 카드 덱을 구성하지 못했습니다. 덱 만들기에서 카드 보유 현황을 확인하세요.');}
  };
  return <section className="slot-deck-launch" aria-label={`슬롯 ${slot} · 보유 카드와 덱`}>
    <div className="slot-deck-launch-heading"><strong>슬롯 {slot} · 내 카드와 덱</strong><span>{profile?`보유 카드 ${profile.ownedCards.length}종 · 랭크 ${profile.rank} · XP ${profile.xp}`:'보유 카드 확인 중…'}</span></div>
    <div className="slot-deck-launch-actions">
      <label>현재 사용할 덱
        <select aria-label="선택한 슬롯의 저장 덱" value={current>=0?String(current):''} disabled={busy} onChange={e=>useSaved(e.target.value)}>
          <option value="">직접 편집한 덱 ({deck.cards.length}/30)</option>
          {decks.map((d,i)=><option key={i} value={i}>{d.name} · {d.deck.cards.length}/30</option>)}
        </select>
      </label>
      <button type="button" className="secondary" disabled={busy||!profile} onClick={recommend}>보유 카드로 덱 구성</button>
      <button type="button" className="secondary" disabled={busy} onClick={onManage}>덱 목록·편집</button>
      <button type="button" className="slot-deck-primary" disabled={!playable} onClick={onStart}>이 덱으로 랭크 대전 시작</button>
    </div>
    <small className={owned?'good':'warn'}>{message||(!profile?'슬롯의 카드 보유 현황을 불러오고 있습니다.':owned?'선택한 슬롯의 보유 카드만으로 구성된 덱입니다.':'현재 덱이 미완성이거나 보유하지 않은 카드가 있습니다. 보유 카드 추천 덱을 구성해 주세요.')}</small>
  </section>;
}
