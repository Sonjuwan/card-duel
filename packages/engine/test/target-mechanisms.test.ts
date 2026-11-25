import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,createCatalog,createGame,effectiveTargetRule,getPlayerView,legalPublicTargets,practiceDeck,publicCardCost,rankBotActions} from '../src/index.ts';
import type {Action,Card,GameState,Target} from '../src/index.ts';
import {planCard,targetAction,targetsFor} from '../../../apps/client/src/battle-actions.ts';
import {validateBattleIntent} from '../../../apps/client/src/battle-intents.ts';

const data=new URL('../../../data/cards/',import.meta.url);
const active=JSON.parse(readFileSync(new URL('active.json',data),'utf8'));
const catalog=createCatalog(JSON.parse(readFileSync(new URL(active.file,data),'utf8')));
const cards=Object.values(catalog);
const relevant=(card:Card)=>card.kind==='spell'&&!!(card.targetRule||card.choices)||card.kind==='minion'&&!!(card.targetRule||card.choices);
function scene(card:Card,combo=false):GameState{
  const deck=practiceDeck(catalog,card.kind==='coin'||card.class==='neutral'?'druid':card.class);
  let state=createGame(catalog,[deck,deck],{seed:109,firstPlayer:0});
  state=applyAction(state,0,{type:'mulligan',replace:[]});
  state=applyAction(state,1,{type:'mulligan',replace:[]});
  for(const [side,player] of state.players.entries()){
    player.health=21;
    player.board=['wolf','wisp','faerie_drake','silver_squire','wild_panther'].map((id,index)=>{
      const source=catalog[id];
      assert.ok(source.kind==='minion');
      return {cardId:id,instanceId:`board-${side}-${index}`,attack:index===0?8:index+1,health:index===0?2:4,maxHealth:5,attacksRemaining:1};
    });
  }
  const self=state.players[0];
  self.mana=10;self.maxMana=10;self.cardsPlayedThisTurn=Number(combo);
  self.weapon={attack:2,durability:2};
  self.hand=[{cardId:card.id,instanceId:'test-held'}];
  return state;
}

for(const card of cards.filter(relevant)){
  test(`${card.id}: active catalogue targeting and choice parity`,()=>{
    const choices=(card.kind==='spell'||card.kind==='minion')?card.choices:undefined;
    const branches=choices?choices.map((_,i)=>i):[undefined];
    for(const combo of (card.kind!=='coin'&&effectiveTargetRule(card,false)!==effectiveTargetRule(card,true)?[false,true]:[false])){
      const state=scene(card,combo);
      const view=getPlayerView(state,0);
      const cost=publicCardCost(view,0,card,catalog);
      const noMana=structuredClone(state);noMana.players[0].mana=0;
      if(cost>0&&publicCardCost(getPlayerView(noMana,0),0,card,catalog)>0)assert.equal(planCard(getPlayerView(noMana,0),0,catalog,'test-held'),null);
      if(card.kind==='minion'){
        const full=structuredClone(state);
        full.players[0].board.push(...full.players[0].board.slice(0,2).map((unit,i)=>({...unit,instanceId:`full-${i}`})));
        assert.equal(planCard(getPlayerView(full,0),0,catalog,'test-held'),null);
      }
      if(choices)assert.equal(planCard(view,0,catalog,'test-held')?.selection?.kind,'cardChoice');
      const bot=rankBotActions(view,catalog,0,6);
      for(const branch of branches){
        const rule=effectiveTargetRule(card,combo,branch);
        const expected=rule?legalPublicTargets(view,0,rule,catalog,card.kind==='spell'):[];
        const plan=planCard(view,0,catalog,'test-held',1,branch);
        if(!plan){assert.equal(expected.length,0,`${card.id} choice ${branch}`);continue;}
        const actions:Action[]=plan.action?[plan.action]:targetsFor(view,0,catalog,plan.selection).map(target=>{
          const action=targetAction(view,0,catalog,plan.selection,target);
          assert.ok(action);return action;
        });
        assert.ok(actions.length>0);
        if(plan.selection){
          assert.deepEqual(targetsFor(view,0,catalog,plan.selection),expected);
          assert.equal(targetAction(view,0,catalog,plan.selection,{kind:'minion',instanceId:'test-held'}),null);
          const removed:Target=expected[0];
          if(removed.kind==='minion'){
            const without=structuredClone(state);
            for(const player of without.players)player.board=player.board.filter(unit=>unit.instanceId!==removed.instanceId);
            assert.ok(validateBattleIntent(getPlayerView(without,0),0,catalog,actions[0] as Extract<Action,{type:'playCard'}>));
          }
        }
        for(const action of actions){
          assert.equal(validateBattleIntent(view,0,catalog,action as Extract<Action,{type:'playCard'}>),undefined);
          const next=applyAction(state,0,action);
          assert.equal(next.revision,state.revision+1);
          assert.ok(!next.players[0].hand.some(held=>held.instanceId==='test-held'));
          assert.ok(state.players[0].hand.some(held=>held.instanceId==='test-held'));
        }
        assert.ok(bot.some(move=>move.type==='playCard'&&move.instanceId==='test-held'&&move.choice===branch),`AI branch ${branch}`);
        if(rule){
          const ghost={type:'playCard' as const,instanceId:'test-held',position:1,choice:branch,target:{kind:'minion' as const,instanceId:'test-held'}};
          assert.throws(()=>applyAction(state,0,ghost));
        }
      }
    }
  });
}
