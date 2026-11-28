import {displayCardName,classicHistoryText} from './card-names.ts';
import type { Catalog, PublicPlayer, PlayerId } from '../../../packages/engine/src/index.ts';
import type { RoomView } from '../../../packages/protocol.ts';
import { className, keywords } from './data.ts';

/** Shareable diagnostic text. Do not include session tokens, room codes,
 * hand identities, deck order, unrevealed secrets or private choices. */
export function formatBattleReport(room:RoomView,catalog:Catalog,hash:string):string{
  const s=room.state;if(!s)return 'RUNEHALL — 대전 시작 전';
  const label=(id:PlayerId)=>id===room.seat?'나':'상대';
  const nameOf=(id:string,fallback=id)=>catalog[id]?displayCardName(catalog[id],true):fallback;
  const describe=(p:PublicPlayer,name:string)=>[
    `${name} (${className[p.heroClass]}): 체력 ${p.health}, 방어도 ${p.armor}, 마나 ${p.mana}/${p.maxMana}, 과부하 ${p.lockedMana}/${p.pendingOverload}, 탈진 ${p.fatigue}`,
    `  손패 ${p.handCount}장, 덱 ${p.deckCount}장, 비밀 ${p.secretCount}개, 무기 ${p.weapon?`${nameOf(p.weapon.cardId??'','기본 무기')} ${p.weapon.attack}/${p.weapon.durability}`:'없음'}`,
    '  전장: '+(p.board.map(m=>`${nameOf(m.cardId)} (${m.attack}/${m.health}/${m.maxHealth}${m.silenced?', 침묵':''}${m.frozenThroughTurn!==undefined?', 빙결':''}${m.keywords?.length?', '+m.keywords.map(k=>keywords[k]).join(', '):''})`).join(' | ')||'없음'),
  ];
  return ['RUNEHALL 전투 진단 기록',`카드 버전 해시: ${hash}`,`대전 방식: ${room.mode==='bot'?`AI ${room.botDifficulty??3}단계`:'친구 대전'}`,`턴 ${s.turn}, 상태 ${s.phase}, 상태 번호 ${s.revision}, 행동 플레이어 ${label(s.activePlayer)}`,`선공 ${label(s.firstPlayer)}${s.phase==='finished'?`, 결과 ${s.winner===null?'무승부':label(s.winner)+' 승리'} (${s.reason})`:''}`,...describe(s.self,'나'),...describe(s.opponent,'상대'),'','최근 공개 전투 기록 (최대 60개):',...s.history.map(e=>`[턴 ${e.turn} | ${label(e.player)}] ${classicHistoryText(e.message,catalog)}`)].join('\n');
}
