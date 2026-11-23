import type { PlayerId, PlayerView } from '../../../packages/engine/src/index.ts';

/** Discrete classes, not inline CSS: works with the game's strict CSP. */
export function fanSlot(index:number,count:number):string {
  if(!Number.isInteger(index)||!Number.isInteger(count)||index<0||index>=count||count<1||count>10)return 'fan-9';
  const spread=Math.min(9,count-1);
  return `fan-${Math.round(9-spread+2*spread*index/Math.max(1,count-1))}`;
}
export const COLLECTION_PAGE_SIZE=12;
export function collectionPage<T>(items:readonly T[],requested:number,size=COLLECTION_PAGE_SIZE) {
  if(!Number.isInteger(size)||size<1)size=COLLECTION_PAGE_SIZE;
  const pages=Math.max(1,Math.ceil(items.length/size));
  const page=Math.max(0,Math.min(pages-1,Number.isFinite(requested)?Math.trunc(requested):0));
  return {page,pages,items:items.slice(page*size,(page+1)*size)};
}
export type CollectionRect={left:number;top:number;width:number;height:number};
/** Navigate the real card geometry; book leaves may be adjacent, stacked,
 * or narrowed from three to one column. Never activate a card here. */
export function collectionNavigation(key:string,current:number,rects:readonly CollectionRect[]):number|null{
  if(!rects.length||current<0||current>=rects.length)return null;
  if(key==='Home')return 0;if(key==='End')return rects.length-1;
  const horizontal=key==='ArrowLeft'||key==='ArrowRight';
  if(!horizontal&&key!=='ArrowUp'&&key!=='ArrowDown')return null;
  const origin=rects[current];if(origin.width<=0||origin.height<=0)return null;
  const sign=key==='ArrowLeft'||key==='ArrowUp'?-1:1;
  const candidates=rects.flatMap((rect,index)=>{
    if(index===current||rect.width<=0||rect.height<=0)return [];
    const dx=rect.left+rect.width/2-origin.left-origin.width/2,dy=rect.top+rect.height/2-origin.top-origin.height/2;
    const primary=(horizontal?dx:dy)*sign,secondary=Math.abs(horizontal?dy:dx);
    if(primary<=1)return [];
    const a=horizontal?origin.top:origin.left,b=horizontal?rect.top:rect.left,as=horizontal?origin.height:origin.width,bs=horizontal?rect.height:rect.width;
    const aligned=Math.min(a+as,b+bs)-Math.max(a,b)>Math.min(as,bs)*.25;
    if(horizontal&&!aligned)return [];
    return [{index,primary,secondary,aligned}];
  });
  candidates.sort((a,b)=>Number(b.aligned)-Number(a.aligned)||a.primary-b.primary||a.secondary-b.secondary||a.index-b.index);
  return candidates[0]?.index??null;
}
export interface TableMotion {
  revision:number;
  drawn:ReadonlySet<string>;
  summoned:ReadonlySet<string>;
  minionDelta:ReadonlyMap<string,number>;
  ownHeroDelta:number;
  enemyHeroDelta:number;
  turn: 'own'|'enemy'|null;
}
/** Compare only snapshots already authorized for this viewer. Never simulate
 * hidden cards or guess the impact of a not-yet-approved action. */
export function deriveTableMotion(previous:PlayerView|undefined,next:PlayerView,seat:PlayerId):TableMotion{
  const drawn=new Set<string>(),summoned=new Set<string>(),minionDelta=new Map<string,number>();
  const motion:TableMotion={revision:next.revision,drawn,summoned,minionDelta,ownHeroDelta:0,enemyHeroDelta:0,turn:null};
  if(!previous||next.revision!==previous.revision+1||previous.phase!=='playing'||next.phase==='mulligan')return motion;
  const oldHand=new Set(previous.self.hand.map(c=>c.instanceId));
  for(const card of next.self.hand)if(!oldHand.has(card.instanceId))drawn.add(card.instanceId);
  const oldBoard=new Map([...previous.self.board,...previous.opponent.board].map(m=>[m.instanceId,m]));
  for(const m of [...next.self.board,...next.opponent.board]){
    const old=oldBoard.get(m.instanceId);
    if(!old||old.cardId!==m.cardId)summoned.add(m.instanceId);
    else if(old.health!==m.health)minionDelta.set(m.instanceId,m.health-old.health);
  }
  const heroDelta=(old:PlayerView['opponent'],now:PlayerView['opponent'])=>now.health-old.health+Math.min(0,now.armor-old.armor);
  motion.ownHeroDelta=heroDelta(previous.self,next.self);motion.enemyHeroDelta=heroDelta(previous.opponent,next.opponent);
  if(previous.activePlayer!==next.activePlayer&&next.phase==='playing')motion.turn=next.activePlayer===seat?'own':'enemy';
  return motion;
}

export function groupedCollection<T>(groups:readonly {key:string;items:readonly T[]}[],requested:number,size:number){
  const spreads=groups.flatMap(group=>Array.from({length:Math.ceil(group.items.length/size)},(_,index)=>({
    key:group.key,index,pages:Math.ceil(group.items.length/size),items:group.items.slice(index*size,(index+1)*size)
  })));
  const {page,pages}=collectionPage(spreads,requested,1);
  return {page,pages,spreads,current:spreads[page]};
}
