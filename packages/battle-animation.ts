import type { BattleVisualEvent, GameState, PlayerId, Target } from './engine/src/index.ts';
import type { BattleAnimation } from './protocol.ts';

/** Called only after applyAction accepted the transaction. Whitelist every
 * field, rather than forwarding the untrusted action or private game state. */
export function describeAcceptedAction(before:GameState,after:GameState,actor:PlayerId,action:unknown,trace?:readonly BattleVisualEvent[]):BattleAnimation|undefined {
  if(before.phase!=='playing'||!action||typeof action!=='object')return;
  const a=action as Record<string,unknown>,p=before.players[actor];
  // Exclude transient objects that were never visible in either snapshot.
  const publicIds=new Set([...before.players,...after.players].flatMap(p=>p.board.map(m=>m.instanceId)));
  const events=trace?.filter(e=>e.kind==='secretTriggered'||e.target.kind==='hero'||publicIds.has(e.target.instanceId));
  const base={revision:after.revision,actor,...(events?{events:[...events]}:{})};
  let target:Target|undefined;
  if(a.target&&typeof a.target==='object'){
    const t=a.target as Record<string,unknown>;
    if(t.kind==='hero'&&(t.player===0||t.player===1||t.player===undefined))target={kind:'hero',player:t.player===undefined?(actor===0?1:0):t.player};
    if(t.kind==='minion'&&typeof t.instanceId==='string'&&before.players.some(p=>p.board.some(m=>m.instanceId===t.instanceId)))target={kind:'minion',instanceId:t.instanceId};
  }
  const aimed=target?{target}:{};
  const combat=events?.find(e=>e.kind==='combat');
  const strike={...(combat&&'target' in combat?{target:combat.target}:aimed),...(trace&&!combat?{blocked:true}:{})};
  switch(a.type){
    case 'playCard':{
      const instance=p.hand.find(c=>c.instanceId===a.instanceId);
      const card=instance&&before.catalog[instance.cardId];if(!card)return;
      if(card.kind==='secret')return {...base,kind:'secret'};
      const kind=card.kind==='minion'?'summon':card.kind;
      const effects=card.kind==='spell'?(card.choices?.[a.choice as number]?.effects??card.effects??[]):[];
      const heavy=card.cost>=7||effects.some(e=>e.kind==='damage'&&e.amount>=6||e.kind==='brawl'||e.kind==='damageDistinct'&&e.count>=4);
      return {...base,kind,cardId:card.id,...aimed,heavy,...(Number.isInteger(a.choice)?{choice:a.choice as number}:{})};
    }
    case 'attack':{
      const m=p.board.find(m=>m.instanceId===a.attackerId);
      return m?{...base,kind:'attack',attackerId:m.instanceId,...strike,heavy:m.attack>=5}:undefined;
    }
    case 'heroAttack':return {...base,kind:'heroAttack',...strike,heavy:p.heroAttack+(p.weapon?.attack??0)>=5};
    case 'heroPower':return {...base,kind:'power',...aimed};
    case 'endTurn':return {...base,kind:'turn'};
    case 'chooseDeckCard':return {...base,kind:'choice'};
    default:return;
  }
}
