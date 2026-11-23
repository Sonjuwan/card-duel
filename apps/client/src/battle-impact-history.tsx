import {useEffect,useRef,useState} from 'react';
import {LocalCardArt,LocalHeroArt} from './local-art.tsx';
import {Sigil} from './battle-pieces.tsx';
import type {Card,Catalog} from '../../../packages/engine/src/index.ts';
import type {RoomView} from '../../../packages/protocol.ts';
import {advanceImpactHistory} from './battle-impact-history-model.ts';
import type {ImpactHistoryEntry,ImpactPortrait} from './battle-impact-history-model.ts';
export function useImpactHistory(room:RoomView,connected:boolean,catalog:Catalog,name:(card:Card)=>string){
  const key=`${room.code}:${room.seat}`,before=useRef<RoomView|null>(null),[history,setHistory]=useState<{key:string;entries:ImpactHistoryEntry[]}>({key,entries:[]});
  useEffect(()=>{if(!connected||!room.state){before.current=null;setHistory({key,entries:[]});return;}
    const prior=before.current;before.current=room;setHistory(old=>({key,entries:advanceImpactHistory(prior,room,old.key===key?old.entries:[],catalog,name)}));
  },[room.code,room.seat,room.state?.revision,connected]);
  return connected&&history.key===key?history.entries:[];
}
const actionLabel={summon:'소환',attack:'공격',heroAttack:'영웅 공격',spell:'주문',weapon:'무기',secret:'비밀',coin:'동전',power:'영웅 능력',turn:'턴 변경',choice:'카드 선택'};

function Portrait({item,catalog}:{item:ImpactPortrait;catalog:Catalog}){
  const card=item.cardId?catalog[item.cardId]:undefined;
  return <span className="impact-portrait">{card?<LocalCardArt card={card}/>:item.hero?<LocalHeroArt heroClass={item.hero} heroForm={item.heroForm}/>:<Sigil kind="shield"/>}</span>;
}

function ImpactDetail({entry,catalog}:{entry:ImpactHistoryEntry;catalog:Catalog}){
  return <>
    <strong>{entry.actor} · {entry.turn}턴 · {actionLabel[entry.kind]}</strong>
    {(entry.source||entry.target)&&<div className="impact-matchup">
      {entry.source&&<div><Portrait item={entry.source} catalog={catalog}/><span>{entry.source.label}</span></div>}
      {entry.target&&<><span aria-label="대상">→</span><div><Portrait item={entry.target} catalog={catalog}/><span>{entry.target.label}</span></div></>}
    </div>}
    {entry.effects.length>0?<ul className="impact-effects">{entry.effects.map((item,index)=><li key={index}><Portrait item={item} catalog={catalog}/><span>{item.label}{item.health!==undefined&&` · 체력 ${item.health}`}{item.armor!==undefined&&` · 방어도 ${item.armor}`}</span></li>)}</ul>:<ul>{entry.lines.map((line,index)=><li key={index}>{line}</li>)}</ul>}
  </>;
}

export function ImpactRail({entries,catalog}:{entries:readonly ImpactHistoryEntry[];catalog:Catalog}){
  const [selected,setSelected]=useState<number|null>(null);
  const [hovered,setHovered]=useState<number|null>(null);
  const [focused,setFocused]=useState<number|null>(null);
  return <div className="impact-rail" aria-label="최근 행동">
    {entries.map(entry=>{
      const portrait=entry.source??entry.effects[0]??entry.target;
      const open=(hovered??focused??selected)===entry.revision;
      const previewId=`impact-preview-${entry.revision}`;
      return <div className="impact-rail-entry" key={entry.revision} onPointerEnter={event=>{if(event.pointerType==='mouse')setHovered(entry.revision);}} onPointerLeave={()=>setHovered(null)}
        onKeyDown={event=>{if(event.key==='Escape'){setSelected(null);setHovered(null);setFocused(null);}}}>
        <button type="button" className="secondary impact-icon" aria-label={`${entry.actor} ${actionLabel[entry.kind]} · ${entry.source?.label??entry.lines[0]}`} aria-controls={previewId} aria-expanded={open}
          onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))setFocused(entry.revision);}} onBlur={()=>setFocused(null)} onClick={()=>setSelected(selected===entry.revision?null:entry.revision)}>
          {portrait?<Portrait item={portrait} catalog={catalog}/>:<Sigil kind={entry.kind==='secret'?'secret':'spell'}/>}
          <span className="impact-kind" aria-hidden="true">{entry.kind==='attack'||entry.kind==='heroAttack'?'⚔':entry.kind==='summon'?'+':entry.kind==='spell'?'✦':'•'}</span>
        </button>
        <div className="impact-preview" id={previewId} data-open={open}><ImpactDetail entry={entry} catalog={catalog}/></div>
      </div>;
    })}
  </div>;
}

export function ImpactHistory({entries,catalog}:{entries:readonly ImpactHistoryEntry[];catalog:Catalog}){
  return <details className="impact-history"><summary>최근 전투 결과 ({entries.length})</summary>{entries.length?<ol className="impact-history-list">{entries.map(entry=><li key={entry.revision}><ImpactDetail entry={entry} catalog={catalog}/></li>)}</ol>:<p>아직 기록 없음</p>}</details>;
}
