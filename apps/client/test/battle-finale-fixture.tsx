import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {applyAction,createGame,getPlayerView,starterDeck} from '../../../packages/engine/src/index.ts';
import type {RoomView} from '../../../packages/protocol.ts';
import {catalog,loadPublicCatalog} from '../src/data.ts';
import {Battle} from '../src/Battle.tsx';
import '../src/styles.css';
import '../src/battle.css';
import '../src/classic-table.css';
import '../src/local-cards.css';
import '../src/painted-art.css';
import '../src/battle-fx.css';
import '../src/landscape-combat.css';
import '../src/landscape-shell.css';
import '../src/battle-immersive.css';
import '../src/integrated-ui.css';

export function mountBattleFinale(cards:unknown,hash:string,loser:0|1){
  loadPublicCatalog(cards,hash);
  let state=createGame(catalog,[starterDeck(catalog,'mage'),starterDeck(catalog,'warrior')],{seed:119,firstPlayer:0});
  state=applyAction(state,0,{type:'mulligan',replace:[]});
  state=applyAction(state,1,{type:'mulligan',replace:[]});
  const actor=loser===0?1:0;
  state.activePlayer=actor;
  state.players[actor].hand=[{cardId:'flame_sphere',instanceId:'last-spell'}];
  state.players[actor].mana=10;
  state.players[loser].health=1;
  const before:RoomView={code:'FINALE',seat:0,mode:'human',status:'playing',opponentConnected:true,state:getPlayerView(state,0)};
  const target={kind:'hero',player:loser} as const;
  const result=applyAction(state,actor,{type:'playCard',instanceId:'last-spell',target});
  const after:RoomView={...before,status:'finished',state:getPlayerView(result,0),animation:{revision:result.revision,actor,kind:'spell',cardId:'flame_sphere',target}};
  function Fixture(){
    const [room,setRoom]=useState(before);
    return <main className="game-main"><button type="button" onClick={()=>setRoom(after)}>최종 피해</button><div className="screen-content"><Battle room={room} send={()=>{}} leave={()=>{}} connected busy={false} compactUi/></div></main>;
  }
  createRoot(document.getElementById('root')!).render(<Fixture/>);
}
