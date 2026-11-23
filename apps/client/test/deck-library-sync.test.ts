import {test} from 'node:test';
import assert from 'node:assert/strict';
import {watchDeckLibraryChanges} from '../src/deck-library-sync.ts';
import type {DeckLibraryEventEnvironment} from '../src/deck-library-sync.ts';
import {decksKey} from '../src/named-decks.ts';
import type {NamedDeck} from '../src/named-decks.ts';

const one:NamedDeck={name:'첫 덱',deck:{heroClass:'mage',cards:Array(30).fill('wolf')}};
const two:NamedDeck={name:'두 번째',deck:{heroClass:'priest',cards:Array(30).fill('wisp')}};
function fixture(initialVisible=true){
  const data=new Map<string,string>(),listeners={storage:new Set<(key:string|null)=>void>(),focus:new Set<()=>void>(),visibility:new Set<()=>void>()};
  let visible=initialVisible;
  const environment:DeckLibraryEventEnvironment={
    visible:()=>visible,
    onStorage:listener=>{listeners.storage.add(listener);return()=>{listeners.storage.delete(listener);};},
    onFocus:listener=>{listeners.focus.add(listener);return()=>{listeners.focus.delete(listener);};},
    onVisibility:listener=>{listeners.visibility.add(listener);return()=>{listeners.visibility.delete(listener);};},
  };
  return {environment,data,store:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}},
    storage:(key:string|null)=>{for(const fn of listeners.storage)fn(key);},focus:()=>{for(const fn of listeners.focus)fn();},
    visibility:(next:boolean)=>{visible=next;for(const fn of listeners.visibility)fn();},
    listenerCount:()=>listeners.storage.size+listeners.focus.size+listeners.visibility.size};
}

test('other-tab updates refresh only changed deck data and ignore unrelated storage events',()=>{
  const f=fixture(),updates:NamedDeck[][]=[],errors:string[]=[];let current:NamedDeck[]=[];
  const stop=watchDeckLibraryChanges({store:f.store,current:()=>current,canRefresh:()=>true,onChange:latest=>{current=latest;updates.push(latest);},onError:error=>errors.push(error),environment:f.environment});
  f.store.setItem(decksKey,JSON.stringify([one]));f.storage('unrelated-key');assert.equal(updates.length,0);
  f.storage(decksKey);assert.deepEqual(current,[one]);assert.equal(updates.length,1);
  f.storage(`card-duel-slot-2:${decksKey}`);f.focus();assert.equal(updates.length,1,'identical data cannot clear selection twice');
  f.store.setItem(decksKey,JSON.stringify([one,two]));f.focus();assert.deepEqual(current,[one,two]);assert.equal(updates.length,2);
  assert.deepEqual(errors,[]);stop();assert.equal(f.listenerCount(),0);
});

test('hidden screens and local deck mutations defer refresh until safe foreground focus',()=>{
  const f=fixture(false),updates:NamedDeck[][]=[];let current:NamedDeck[]=[];let editing=true;
  const stop=watchDeckLibraryChanges({store:f.store,current:()=>current,canRefresh:()=>!editing,onChange:latest=>{current=latest;updates.push(latest);},onError:()=>assert.fail('unexpected error'),environment:f.environment});
  f.store.setItem(decksKey,JSON.stringify([one]));f.storage(decksKey);f.focus();assert.equal(updates.length,0);
  f.visibility(true);assert.equal(updates.length,0,'local mutation blocks external re-read');
  editing=false;f.focus();assert.deepEqual(current,[one]);assert.equal(updates.length,1);
  f.visibility(false);f.store.setItem(decksKey,JSON.stringify([two]));f.storage(decksKey);assert.deepEqual(current,[one]);
  f.visibility(true);assert.deepEqual(current,[two]);assert.equal(updates.length,2);stop();
});

test('corrupt external deck libraries preserve the last valid list and disposed observers stay silent',()=>{
  const f=fixture(),errors:string[]=[],updates:NamedDeck[][]=[];let current=[one];
  f.store.setItem(decksKey,JSON.stringify([one]));
  const stop=watchDeckLibraryChanges({store:f.store,current:()=>current,canRefresh:()=>true,onChange:latest=>{current=latest;updates.push(latest);},onError:error=>errors.push(error),environment:f.environment});
  f.store.setItem(decksKey,'{bad');f.storage(decksKey);assert.equal(errors.length,1);assert.match(errors[0],/손상/);assert.deepEqual(current,[one]);
  f.store.setItem(decksKey,JSON.stringify([two]));f.storage(decksKey);assert.deepEqual(current,[two]);
  stop();stop();assert.equal(f.listenerCount(),0);f.store.setItem(decksKey,JSON.stringify([]));f.focus();f.storage(null);assert.deepEqual(current,[two]);assert.equal(updates.length,1);
});

test('subscribing catches a cross-tab write missed between initial read and attaching listeners',()=>{
  const f=fixture(),updates:NamedDeck[][]=[];let current=[one];
  f.store.setItem(decksKey,JSON.stringify([two]));
  const stop=watchDeckLibraryChanges({store:f.store,current:()=>current,canRefresh:()=>true,onChange:latest=>{current=latest;updates.push(latest);},onError:()=>assert.fail('unexpected error'),environment:f.environment});
  assert.deepEqual(current,[two]);assert.equal(updates.length,1);
  stop();assert.equal(f.listenerCount(),0);
});

test('re-subscribing after a local write catches deferred changes without a new browser event',()=>{
  const f=fixture(),updates:NamedDeck[][]=[];let current=[one],editing=true;
  f.store.setItem(decksKey,JSON.stringify([one]));
  const observe=()=>watchDeckLibraryChanges({store:f.store,current:()=>current,canRefresh:()=>!editing,onChange:latest=>{current=latest;updates.push(latest);},onError:()=>assert.fail('unexpected error'),environment:f.environment});
  let stop=observe();f.store.setItem(decksKey,JSON.stringify([two]));f.storage(decksKey);assert.deepEqual(current,[one]);
  stop();editing=false;stop=observe();assert.deepEqual(current,[two]);assert.equal(updates.length,1);
  stop();assert.equal(f.listenerCount(),0);
});

test('recovered storage clears stale warnings even if the saved rows did not change',()=>{
  const f=fixture(),errors:string[]=[],recoveries:string[]=[];let current=[one],updates=0;
  f.store.setItem(decksKey,JSON.stringify([one]));
  const stop=watchDeckLibraryChanges({store:f.store,current:()=>current,canRefresh:()=>true,onChange:latest=>{current=latest;updates++;},onError:message=>errors.push(message),onRecovered:previous=>recoveries.push(previous),environment:f.environment});
  f.store.setItem(decksKey,'{bad');f.storage(decksKey);assert.equal(errors.length,1);
  f.store.setItem(decksKey,JSON.stringify([one]));f.focus();
  assert.deepEqual(recoveries,errors);assert.equal(updates,0,'unchanged rows do not unset the selected deck');
  f.focus();assert.equal(recoveries.length,1,'recovered message is issued only once');
  stop();
});

test('storage recovery with an actual deck change takes the normal change path',()=>{
  const f=fixture(),errors:string[]=[],recoveries:string[]=[];let current=[one],changes=0;
  f.store.setItem(decksKey,JSON.stringify([one]));
  const stop=watchDeckLibraryChanges({store:f.store,current:()=>current,canRefresh:()=>true,onChange:latest=>{current=latest;changes++;},onError:message=>errors.push(message),onRecovered:previous=>recoveries.push(previous),environment:f.environment});
  f.store.setItem(decksKey,'{bad');f.storage(decksKey);
  f.store.setItem(decksKey,JSON.stringify([two]));f.focus();
  assert.equal(errors.length,1);assert.equal(changes,1);assert.deepEqual(current,[two]);assert.deepEqual(recoveries,[],'the existing changed-row announcement is kept');
  stop();
});
