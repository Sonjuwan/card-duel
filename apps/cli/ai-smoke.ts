import assert from 'node:assert/strict';
import { CardStore } from '../server/card-store.ts';
import { applyAction, BOT_DIFFICULTIES, candidates, createGame, getPlayerView, HERO_CLASSES, rankBotActions, RuleError, starterDeck } from '../../packages/engine/src/index.ts';
import type { Action, PlayerId } from '../../packages/engine/src/index.ts';

// Compatibility, not a strength benchmark. The AI sees its actual public view
// and plays against a seeded test agent, not another trained opponent.
const { version, catalog } = new CardStore().read();
let total = 0, actions = 0;
console.log(`AI compatibility: ${version}`);
for (const difficulty of BOT_DIFFICULTIES) {
  let wins = 0, losses = 0, draws = 0;
  for (const [i, heroClass] of HERO_CLASSES.entries()) {
    const seed = 9371 + difficulty * 121 + i * 77;
    let random = seed ^ 0x56d3c21a;
    const next = () => { random = (Math.imul(random,1664525)+1013904223)>>>0; return random/4294967296; };
    const decks = [starterDeck(catalog,HERO_CLASSES[(i+difficulty)%9]),starterDeck(catalog,heroClass)] as const;
    let state = createGame(catalog,[...decks],{seed});
    let botTurn = -1, botActions = 0;
    try {
      for (let move=0; move<600 && state.phase!=='finished'; move++) {
        const actor: PlayerId = state.phase==='mulligan' ? (state.players[0].mulliganDone?1:0) : state.activePlayer;
        if (botTurn!==state.turn) {botTurn=state.turn; botActions=0;}
        let options: Action[];
        if (actor===1) {
          const view=getPlayerView(state,1);
          assert.ok(!Object.hasOwn(view.opponent,'hand')&&!Object.hasOwn(view.opponent,'deck')&&!Object.hasOwn(view.opponent,'secrets'));
          options=botActions>=40&&state.phase==='playing'&&!state.pendingChoice?[{type:'endTurn'}]:rankBotActions(view,state.catalog,1,difficulty,{nodeLimit:60,responseLimit:0});
        } else {
          options=candidates(state,0);
          for(let j=options.length-1;j>0;j--){const k=Math.floor(next()*(j+1));[options[j],options[k]]=[options[k],options[j]];}
          if(state.phase==='playing')options.push({type:'endTurn'});
        }
        let applied=false;
        for(const action of options){
          try{state=applyAction(state,actor,action);actions++;if(actor===1)botActions++;applied=true;break;}
          catch(e){if(!(e instanceof RuleError))throw e;}
        }
        assert.ok(applied,'No legal action');
      }
      assert.equal(state.phase,'finished');
      if(state.winner===1)wins++;else if(state.winner===0)losses++;else draws++;
      total++;
    } catch(error){console.error(JSON.stringify({version,difficulty,heroClass,seed,revision:state.revision,history:state.history.slice(-12)}));throw error;}
  }
  console.log(`Level ${difficulty}: ${wins+losses+draws}/9 games finished (wins ${wins}, losses ${losses}, draws ${draws})`);
}
console.log(`Complete: ${total} games, ${actions} accepted actions`);
