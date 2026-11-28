import {useEffect,useState} from 'react';
import {LandscapeExperience} from './LandscapeExperience.tsx';
import {catalog,catalogHash} from './data.ts';
import {readDecks} from './named-decks.ts';
import {SOLO_SLOTS,readSelectedSlot,soloSlotStorage} from './solo-slots.ts';
import type {SoloSlot} from './solo-slots.ts';
import type {LocalRequest,LocalResponse,LocalSlotOverview} from './local-duel.ts';

/** A user must choose the owner of all cards/decks/progression before opening
 * the game. This preview-only gate does not migrate or modify another slot. */
export function SlotGateway({workerFactory,onSelect}:{workerFactory:()=>Worker;onSelect:(slot:SoloSlot)=>void}){
  const [slots,setSlots]=useState<Partial<Record<SoloSlot,LocalSlotOverview|null>>>({});
  const [retry,setRetry]=useState(0);
  const previous=readSelectedSlot();
  useEffect(()=>{
    let stopped=false,active:Worker|undefined,timer:ReturnType<typeof setTimeout>|undefined;
    setSlots({});
    const pending=[...SOLO_SLOTS];
    const next=()=>{
      if(stopped)return;
      const slot=pending.shift();if(!slot)return;
      let done=false;
      const finish=(value:LocalSlotOverview|null)=>{
        if(stopped||done)return;done=true;
        if(timer!==undefined)clearTimeout(timer);
        active?.terminate();active=undefined;
        setSlots(old=>({...old,[slot]:value}));
        next();
      };
      try{
        const worker=workerFactory();active=worker;
        timer=setTimeout(()=>finish(null),6000);
        worker.onmessage=({data}:MessageEvent<LocalResponse>)=>{
          if(data.type==='slotInfo')finish(data.overview);
          else if(data.type==='error')finish(null);
        };
        worker.onerror=()=>finish(null);
        worker.postMessage({type:'selectSlot',slot,namespace:'ui-preview'});
        worker.postMessage({type:'inspectSlot',catalogHash,catalog} satisfies LocalRequest);
      }catch{finish(null);}
    };
    next();
    return()=>{stopped=true;if(timer!==undefined)clearTimeout(timer);active?.terminate();};
  },[workerFactory,retry]);
  return <main className="lobby-main slot-entry" data-game-viewport="landscape">
    <header className="app-header"><div className="brand"><h1>RUNEHALL</h1></div><div className="connection"><span className="good">● 오프라인 솔로</span></div></header><LandscapeExperience/>
    <section className="slot-entry-content" aria-label="시작할 저장 슬롯 선택">
      <div className="slot-entry-title"><div><h2>저장 슬롯을 선택하세요</h2><p>먼저 슬롯을 고르면 그 슬롯의 보유 카드·덱·랭크·전적으로 플레이합니다. 서로 다른 슬롯의 데이터는 섞이지 않습니다.</p></div>
        <button className="secondary" type="button" onClick={()=>setRetry(n=>n+1)}>슬롯 기록 다시 확인</button></div>
      <div className="slot-entry-grid">
        {SOLO_SLOTS.map(slot=>{
          const summary=slots[slot],stored=soloSlotStorage(slot,undefined,'ui-preview');
          let names:string[]=[];try{names=readDecks(stored).map(x=>x.name);}catch{/* A storage failure is indicated by the worker. */}
          const loading=summary===undefined,failed=summary===null;
          return <section className="slot-entry-card" key={slot} aria-label={`저장 슬롯 ${slot}`}>
            <h3>슬롯 {slot} {previous===slot&&<small>최근 사용</small>}</h3>
            <div className="slot-entry-stats">
              <span>{loading?'기록 확인 중…':failed?'기록을 확인할 수 없습니다':`랭크 ${summary.rank}/25 · XP ${summary.xp}`}</span>
              <span>보유 카드 {summary&&typeof summary==='object'?summary.ownedCards:'—'}종</span>
              <span>저장된 덱 {names.length}개</span>
              {names.length>0&&<span className="slot-entry-deck-names">{names.slice(0,2).join(' · ')}{names.length>2?' 외':''}</span>}
              {summary?.save&&<span>{summary.save.phase==='finished'?'지난 경기 결과 있음':'지난 미완료 경기 · 입장 시 패배 정산'}</span>}
            </div>
            <button type="button" className="slot-entry-choose" disabled={loading||failed} onClick={()=>onSelect(slot)}>슬롯 {slot} 선택</button>
          </section>;
        })}
      </div>
      <p className="slot-entry-note">처음 시작하는 슬롯은 기본 보유 카드로 덱을 구성할 수 있습니다. 기존 v0.298과 UI 테스트판의 저장 데이터는 자동으로 합치지 않습니다.</p>
    </section>
  </main>;
}
