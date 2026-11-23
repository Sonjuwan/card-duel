import {useEffect,useRef,useState} from 'react';
import type {Card,Catalog} from '../../../packages/engine/src/index.ts';
import type {RoomView} from '../../../packages/protocol.ts';
import {advanceImpactHistory} from './battle-impact-history-model.ts';
import type {ImpactHistoryEntry} from './battle-impact-history-model.ts';
export function useImpactHistory(room:RoomView,connected:boolean,catalog:Catalog,name:(card:Card)=>string){
  const key=`${room.code}:${room.seat}`,before=useRef<RoomView|null>(null),[history,setHistory]=useState<{key:string;entries:ImpactHistoryEntry[]}>({key,entries:[]});
  useEffect(()=>{if(!connected||!room.state){before.current=null;setHistory({key,entries:[]});return;}
    const prior=before.current;before.current=room;setHistory(old=>({key,entries:advanceImpactHistory(prior,room,old.key===key?old.entries:[],catalog,name)}));
  },[room.code,room.seat,room.state?.revision,connected]);
  return connected&&history.key===key?history.entries:[];
}
export function ImpactHistory({entries}:{entries:readonly ImpactHistoryEntry[]}){
  const latest=entries[0];
  return <details className="impact-history"><summary><strong>최근 전투 결과</strong><span aria-live="polite" aria-atomic="true">{latest?`${latest.turn}턴 · ${latest.lines[0]}${latest.lines.length>1?` 외 ${latest.lines.length-1}개`:''}`:'아직 기록 없음'}</span></summary><p>이번 대전에서 확인한 최근 5개 행동의 공개 결과입니다. 같은 하수인은 왼쪽부터 행동 전 배치 번호로 구분하고 새 소환은 행동 후 번호로 표시합니다. 이어하기 후에는 새 행동부터 표시합니다.</p>{!entries.length?<p>피해, 회복, 방어도 등 전투 결과가 발생하면 여기에 표시됩니다.</p>:<ol className="impact-history-list">{entries.map(e=><li key={e.revision}><small>{e.turn}턴 · {e.actor}</small><ul>{e.lines.map((line,i)=><li key={i}>{line}</li>)}</ul></li>)}</ol>}</details>;
}
