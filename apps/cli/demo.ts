import { CardStore } from '../server/card-store.ts';
import { simulate,starterDeck } from '../../packages/engine/src/index.ts';
const {catalog,version}=new CardStore().read();
const decks=[starterDeck(catalog,'warrior'),starterDeck(catalog,'mage')] as const;
console.log(`카드 대전 — 자동 시범 경기 (${version})`);
let lastTurn=0;
const final=simulate(catalog,[...decks],42,(s,action)=>{
  if(s.turn!==lastTurn){lastTurn=s.turn;console.log(`턴 ${s.turn} / P${s.activePlayer+1} / 체력 ${s.players.map(p=>p.health).join(':')} / 마나 ${s.players[s.activePlayer].mana}`);}
  if(action.type==='playCard'||action.type==='heroPower'||action.type==='attack'||action.type==='heroAttack')console.log('  '+(s.history.at(-1)?.message??action.type));
});
console.log(`종료: ${final.winner===null?'무승부':`P${final.winner+1} 승리`} (${final.reason})`);
