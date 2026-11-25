import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {LocalCardArt,LocalHeroArt} from './local-art.tsx';
import {Sigil} from './battle-pieces.tsx';
import type {Card,Catalog} from '../../../packages/engine/src/index.ts';
import type {RoomView} from '../../../packages/protocol.ts';
import {advanceImpactHistory} from './battle-impact-history-model.ts';
import type {ImpactHistoryEntry,ImpactPortrait} from './battle-impact-history-model.ts';
function historyStorageKey(key:string){
  return `card-duel:impact:v1:${location.pathname}:${key}`;
}
function restoreHistory(key:string,revision:number):ImpactHistoryEntry[]{
  try{
    const entries:ImpactHistoryEntry[]=JSON.parse(sessionStorage.getItem(historyStorageKey(key))??'[]');
    return entries.filter(entry=>Number.isInteger(entry?.revision)&&entry.revision<=revision&&Array.isArray(entry.lines)&&Array.isArray(entry.effects));
  }catch{return [];}
}
export function useImpactHistory(room:RoomView,connected:boolean,catalog:Catalog,name:(card:Card)=>string){
  const key=`${room.code}:${room.seat}`;
  const before=useRef<RoomView|null>(null);
  const [history,setHistory]=useState<{key:string;entries:ImpactHistoryEntry[]}>(()=>({
    key,entries:room.state?restoreHistory(key,room.state.revision):[],
  }));
  useEffect(()=>{
    if(!connected||!room.state)return;
    const prior=before.current;
    before.current=room;
    setHistory(old=>{
      if(!prior||old.key!==key||!prior.state)return {key,entries:restoreHistory(key,room.state!.revision)};
      const entries=advanceImpactHistory(prior,room,old.entries,catalog,name);
      return entries===old.entries?old:{key,entries};
    });
  },[room.code,room.seat,room.state?.revision,connected]);
  useEffect(()=>{
    if(!history.entries.length)return;
    try{sessionStorage.setItem(historyStorageKey(history.key),JSON.stringify(history.entries));}
    catch{/* Private mode and storage limits can leave history available only in memory. */}
  },[history]);
  return history.key===key?history.entries:[];
}
const actionMark={summon:'＋',attack:'⚔',heroAttack:'⚔',spell:'✦',weapon:'⚒',secret:'?',coin:'◉',power:'ϟ',turn:'↻',choice:'▣',heal:'✚',death:'☠',draw:'▤'};
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
  const press=useRef<{id:number;x:number;y:number;timer:ReturnType<typeof setTimeout>}|null>(null);
  const clearPress=()=>{if(press.current)clearTimeout(press.current.timer);press.current=null;};
  useEffect(()=>()=>{if(press.current)clearTimeout(press.current.timer);},[]);
  const [selected,setSelected]=useState<number|null>(null);
  const [hovered,setHovered]=useState<number|null>(null);
  const [focused,setFocused]=useState<number|null>(null);
  const scroller=useRef<HTMLDivElement>(null);
  const prior=useRef<{revision:number|undefined;height:number}>({revision:undefined,height:0});
  const atLatest=useRef(true);
  const [following,setFollowing]=useState(true);
  const revision=hovered??focused??selected;
  const preview=entries.find(entry=>entry.revision===revision);
  useLayoutEffect(()=>{
    const element=scroller.current;if(!element)return;
    if(prior.current.revision!==entries[0]?.revision){
      element.scrollTop=atLatest.current?0:element.scrollTop+Math.max(0,element.scrollHeight-prior.current.height);
    }
    prior.current={revision:entries[0]?.revision,height:element.scrollHeight};
  },[entries]);
  return <div className="impact-rail-shell">
    <div className="impact-rail" aria-label="최근 행동" ref={scroller} onScroll={event=>{
      clearPress();atLatest.current=event.currentTarget.scrollTop<=2;setFollowing(atLatest.current);setHovered(null);
    }}>
    {entries.map(entry=>{
      const portrait=entry.source??entry.effects[0]??entry.target;
      const open=(hovered??focused??selected)===entry.revision;
      const previewId=`impact-preview-${entry.revision}`;
      return <div className="impact-rail-entry" key={entry.revision} onPointerEnter={event=>{if(event.pointerType==='mouse')setHovered(entry.revision);}} onPointerLeave={()=>setHovered(null)}
        onKeyDown={event=>{if(event.key==='Escape'){setSelected(null);setHovered(null);setFocused(null);}}}>
        <button type="button" className="secondary impact-icon" aria-label={`${entry.actor} ${actionLabel[entry.kind]} · ${entry.source?.label??entry.lines[0]}`} aria-controls={previewId} aria-expanded={open}
          onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))setFocused(entry.revision);}} onBlur={()=>setFocused(null)}
          onPointerDown={event=>{
            if(event.pointerType==='mouse'||!event.isPrimary)return;
            clearPress();
            press.current={id:event.pointerId,x:event.clientX,y:event.clientY,timer:setTimeout(()=>setHovered(entry.revision),300)};
          }}
          onPointerMove={event=>{const p=press.current;if(p?.id===event.pointerId&&Math.hypot(p.x-event.clientX,p.y-event.clientY)>8){clearPress();setHovered(null);}}}
          onPointerUp={event=>{if(event.pointerType!=='mouse'){clearPress();setHovered(null);}}}
          onPointerCancel={()=>{clearPress();setHovered(null);}}
          onClick={event=>{if(event.detail===0)setSelected(selected===entry.revision?null:entry.revision);}}>
          {portrait?<Portrait item={portrait} catalog={catalog}/>:<Sigil kind={entry.kind==='secret'?'secret':'spell'}/>}
          <span className="impact-kind" aria-hidden="true">{actionMark[entry.mark??entry.kind]}</span>
        </button>

      </div>;
    })}
    </div>
    {!following&&<button type="button" className="impact-latest secondary" aria-label="최신 행동으로 이동" onClick={()=>{if(scroller.current)scroller.current.scrollTop=0;setSelected(null);}}>↑</button>}
    {preview&&<div className="impact-preview" id={`impact-preview-${preview.revision}`} data-open="true"><ImpactDetail entry={preview} catalog={catalog}/></div>}
  </div>;
}

export function ImpactHistory({entries,catalog}:{entries:readonly ImpactHistoryEntry[];catalog:Catalog}){
  return <details className="impact-history"><summary>최근 전투 결과 ({entries.length})</summary>{entries.length?<ol className="impact-history-list">{entries.map(entry=><li key={entry.revision}><ImpactDetail entry={entry} catalog={catalog}/></li>)}</ol>:<p>아직 기록 없음</p>}</details>;
}
