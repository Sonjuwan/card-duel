import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decisionMixturePolicy,experimentalPolicy,experimentDraw,experimentalActions,expertProbability} from '../../../packages/experimental-difficulty.ts';
import {applyAction,createCatalog,createGame,getPlayerView,practiceDeck,rankBotActions,RuleError} from '../../../packages/engine/src/index.ts';
import type {BotDifficulty} from '../../../packages/engine/src/index.ts';

test('experiment expert choices are nested across 25 levels, reproducible, and proportionate',()=>{
  const counts=Array(25).fill(0);let samples=0;
  for(let seed=1;seed<=128;seed++)for(const seat of [0,1] as const)for(let turn=0;turn<32;turn++){
    const draw=experimentDraw(seed,seat,turn);assert.equal(draw,experimentDraw(seed,seat,turn));assert.ok(draw>=0&&draw<1);samples++;
    let previous=1;for(let index=0;index<25;index++){const level=(index+1) as BotDifficulty,choice=experimentalPolicy(level,seed,seat,turn);assert.ok(choice>=previous);previous=choice;if(choice===25)counts[index]++;}
  }
  assert.equal(counts[0],0);assert.equal(counts[24],samples);
  for(let level=1;level<=25;level++)assert.ok(Math.abs(counts[level-1]/samples-expertProbability(level as BotDifficulty))<.025);
});
test('decision-level candidate is nested, reproducible and varies within a turn',()=>{
  const count=Array(25).fill(0);let n=0;
  for(let seed=1;seed<=32;seed++)for(const seat of [0,1] as const)for(let revision=0;revision<128;revision++){
    let previous=1;n++;for(let i=0;i<25;i++){const level=(i+1) as BotDifficulty,policy=decisionMixturePolicy(level,seed,seat,7,revision);assert.equal(policy,decisionMixturePolicy(level,seed,seat,7,revision));assert.ok(policy>=previous);previous=policy;if(policy===25)count[i]++;}
  }
  assert.equal(count[0],0);assert.equal(count[24],n);for(let i=0;i<25;i++)assert.ok(Math.abs(count[i]/n-expertProbability((i+1) as BotDifficulty))<.025);
});
test('experimental endpoints exactly match original beginner and expert policies',()=>{
  const catalog=createCatalog(JSON.parse(readFileSync('data/cards/v0.23.0.json','utf8')));let state=createGame(catalog,[practiceDeck(catalog,'warrior'),practiceDeck(catalog,'mage')],{seed:231,firstPlayer:0});
  for(let i=0;i<30&&state.phase!=='finished';i++){
    const actor=state.phase==='mulligan'?(state.players[0].mulliganDone?1:0):state.activePlayer,view=getPlayerView(state,actor);
    for(const level of [1,25] as const)assert.deepEqual(experimentalActions(view,catalog,actor,level,231),rankBotActions(view,catalog,actor,level,{policyVersion:level===25?2:1}));
    const level=12,choice=experimentalPolicy(level,231,actor,view.turn);
    assert.deepEqual(experimentalActions(view,catalog,actor,level,231),rankBotActions(view,catalog,actor,choice,{policyVersion:choice===25?2:1}));
    let moved=false;for(const action of rankBotActions(view,catalog,actor,3))try{state=applyAction(state,actor,action);moved=true;break;}catch(e){if(!(e instanceof RuleError))throw e;}
    assert.ok(moved);
  }
});
