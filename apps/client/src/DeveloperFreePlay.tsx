import {DECK_STYLES,HERO_CLASSES,strategicDeck,validateDeck} from '../../../packages/engine/src/index.ts';
import type {Catalog,Deck,HeroClass} from '../../../packages/engine/src/index.ts';
import {className} from './data.ts';
import type {NamedDeck} from './named-decks.ts';
import {DECK_STYLE_LABELS} from './solo-settings.ts';
import type {SoloClass} from './solo-settings.ts';

export interface FreeMatchSelection{
  player:HeroClass;
  opponent:SoloClass;
  playerDeck:string;
  opponentDeck:string;
}

function draftForHero(draft:Deck,hero:SoloClass,catalog:Catalog){
  if(draft.heroClass!==hero)return undefined;
  try{validateDeck(draft,catalog);return draft;}catch{return undefined;}
}

export function resolveFreeDeck(catalog:Catalog,hero:HeroClass,selection:string,saved:readonly NamedDeck[],draft:Deck,seed:number){
  const chosen=selection==='draft'?draftForHero(draft,hero,catalog):
    selection.startsWith('saved:')?saved.find(row=>row.name===selection.slice(6)&&row.deck.heroClass===hero)?.deck:undefined;
  const style=selection==='random'?DECK_STYLES[(seed>>>0)%DECK_STYLES.length]:
    selection==='recommended'?'practice':DECK_STYLES.find(value=>selection===`style:${value}`);
  if(!chosen&&!style)throw Error('직업에 맞는 시험 덱을 다시 선택하세요.');
  const deck=chosen?structuredClone(chosen):strategicDeck(catalog,hero,style??'practice',seed);
  validateDeck(deck,catalog);
  return {deck,style:style??'practice'};
}

function deckOptions(hero:SoloClass,saved:readonly NamedDeck[],draft:Deck,catalog:Catalog,allowRandom:boolean){
  return [
    {value:'recommended',label:'기본 추천 덱'},
    ...(allowRandom?[{value:'random',label:'무작위 덱'}]:[]),
    ...DECK_STYLES.map(style=>({value:`style:${style}`,label:`전략 덱 · ${DECK_STYLE_LABELS[style]}`})),
    ...saved.filter(row=>row.deck.heroClass===hero).map(row=>({value:`saved:${row.name}`,label:`시험 덱 · ${row.name}`})),
    ...(draftForHero(draft,hero,catalog)?[{value:'draft',label:'현재 편집 중인 덱'}]:[])
  ];
}

export function DeveloperFreePlay({selection,onSelection,saved,draft,catalog,busy,ready,onStart,onResume,onEdit}:{
  selection:FreeMatchSelection;onSelection:(selection:FreeMatchSelection)=>void;
  saved:readonly NamedDeck[];draft:Deck;catalog:Catalog;busy:boolean;ready:boolean|undefined;
  onStart:()=>void;onResume?:()=>void;onEdit:(hero:HeroClass)=>void;
}){
  const {player,playerDeck,opponent,opponentDeck}=selection;
  const playerOptions=deckOptions(player,saved,draft,catalog,false);
  const opponentOptions=deckOptions(opponent,saved,draft,catalog,true);
  const valid=playerOptions.some(option=>option.value===playerDeck)&&opponentOptions.some(option=>option.value===opponentDeck);
  return <section className="account-growth developer-free-play" aria-label="개발자 자유 대전">
    <h3>자유 대전</h3>
    {ready===false&&<p role="status">자유 대전 저장소에 접근할 수 없습니다.</p>}
    <div className="developer-free-decks">
      <div className="account-row">
        <label>플레이어 직업<select value={player} onChange={event=>onSelection({...selection,player:event.target.value as HeroClass,playerDeck:'recommended'})}>
          {HERO_CLASSES.map(hero=><option key={hero} value={hero}>{className[hero]}</option>)}
        </select></label>
        <label>플레이어 덱<select value={playerDeck} onChange={event=>onSelection({...selection,playerDeck:event.target.value})}>
          {playerOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <button type="button" className="secondary" onClick={()=>onEdit(player)}>플레이어 덱 편집</button>
      </div>
      <div className="account-row">
        <label>상대 AI 직업<select value={opponent} onChange={event=>onSelection({...selection,opponent:event.target.value as SoloClass,opponentDeck:'recommended'})}>
          <option value="random">무작위 직업</option>
          {HERO_CLASSES.map(hero=><option key={hero} value={hero}>{className[hero]}</option>)}
        </select></label>
        <label>상대 AI 덱<select value={opponentDeck} onChange={event=>onSelection({...selection,opponentDeck:event.target.value})}>
          {opponentOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <button type="button" className="secondary" disabled={opponent==='random'} onClick={()=>{if(opponent!=='random')onEdit(opponent);}}>상대 AI 덱 편집</button>
      </div>
    </div>
    {!valid&&<p role="status">변경된 시험 덱을 다시 선택하세요.</p>}
    <button type="button" disabled={busy||!ready||!valid} onClick={onStart}>자유 대전 시작</button>
    {onResume&&<button type="button" className="secondary" disabled={busy||!ready} onClick={onResume}>자유 대전 이어하기</button>}
  </section>;
}
