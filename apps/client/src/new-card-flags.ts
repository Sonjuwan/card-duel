import type {AccountProfile} from '../../../packages/account-protocol.ts';
import type {SlotStorage} from './solo-slots.ts';

const key='card-duel-new-cards-v1';
type State={version:1;seen:string[];unread:string[]};
const valid=(v:unknown):v is State=>!!v&&typeof v==='object'&&(v as State).version===1&&Array.isArray((v as State).seen)&&Array.isArray((v as State).unread);
const read=(storage:SlotStorage):State|null=>{try{const raw=storage.getItem(key);if(!raw)return null;const data:unknown=JSON.parse(raw);return valid(data)?data:null;}catch{return null;}};
function write(storage:SlotStorage,state:State){try{storage.setItem(key,JSON.stringify(state));return true;}catch{return false;}}
/** First use baselines legacy ownership/history instead of relabeling the entire collection.
 * Later eligible match award IDs survive restart; only a direct catalog open marks a card seen. */
export function syncNewCards(profile:AccountProfile|undefined,storage:SlotStorage):string[]{
  if(!profile)return read(storage)?.unread??[];
  const prior=read(storage),history=profile.recentMatches??[];
  if(!prior){write(storage,{version:1,seen:history.map(m=>m.matchId),unread:[]});return [];}
  const seen=new Set(prior.seen),unread=new Set(prior.unread),owned=new Set(profile.ownedCards);
  for(const match of [...history].reverse()){
    if(seen.has(match.matchId))continue;
    seen.add(match.matchId);
    if(match.eligible&&match.mode==='ranked')for(const id of match.unlockedCards??[])if(owned.has(id))unread.add(id);
  }
  const next={version:1 as const,seen:[...seen].slice(-200),unread:[...unread].filter(id=>owned.has(id))};
  write(storage,next);return next.unread;
}
export function markCardViewed(id:string,storage:SlotStorage):string[]{
  const state=read(storage);if(!state)return [];
  if(!state.unread.includes(id))return state.unread;
  const next={...state,unread:state.unread.filter(value=>value!==id)};
  return write(storage,next)?next.unread:state.unread;
}
