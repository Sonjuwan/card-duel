import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncNewCards,markCardViewed} from '../src/new-card-flags.ts';
import type {SlotStorage} from '../src/solo-slots.ts';
import type {AccountProfile} from '../../../packages/account-protocol.ts';

function store():SlotStorage{
  const values=new Map<string,string>();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},key:index=>[...values.keys()][index]??null,get length(){return values.size;}};
}
function profile(matches:AccountProfile['recentMatches']):AccountProfile{
  return {revision:matches?.length??0,decks:[],xp:70,rank:1,rankWins:0,questGames:0,ownedCards:['c-a','c-b','c-old'],recentMatches:matches};
}
const match=(matchId:string,unlockedCards:string[])=>({matchId,mode:'ranked' as const,rank:1,heroClass:'mage' as const,outcome:'win' as const,completedAt:1,xp:30,questAdvanced:false,eligible:true,unlockedCards});
test('initial baseline preserves old owned cards without red NEW outlines',()=>{
  const slot=store();
  const old=match('before-patch',['c-old']);
  assert.deepEqual(syncNewCards(profile([old]),slot),[]);
  assert.deepEqual(syncNewCards(profile([match('new-match',['c-a']),old]),slot),['c-a']);
  assert.deepEqual(syncNewCards(profile([match('new-match',['c-a']),old]),slot),['c-a']);
  assert.deepEqual(markCardViewed('c-a',slot),[]);
  assert.deepEqual(syncNewCards(profile([match('new-match',['c-a']),old]),slot),[]);
});
test('new-card state is per slot, selective, and only eligible ranked awards count',()=>{
  const a=store(),b=store(),old=profile([]);
  assert.deepEqual(syncNewCards(old,a),[]);
  assert.deepEqual(syncNewCards(old,b),[]);
  const current=profile([match('1',['c-a','c-b'])]);
  assert.deepEqual(syncNewCards(current,a),['c-a','c-b']);
  assert.deepEqual(markCardViewed('c-a',a),['c-b']);
  assert.deepEqual(syncNewCards(current,a),['c-b']);
  assert.deepEqual(syncNewCards(current,b),['c-a','c-b']);
  assert.deepEqual(syncNewCards(profile([{
    ...match('2',['c-old']),mode:'pvp'
  },...current.recentMatches!]),a),['c-b']);
});
