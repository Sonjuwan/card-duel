import type {Catalog} from './types.ts';
import {HERO_TOKENS} from './hero-powers.ts';

// Shared, deeply immutable definitions. A match never reads a later balance
// edit. Only dynamic state is cloned for each authoritative transaction.
const snapshots=new WeakSet<Catalog>();
const battleSnapshots=new WeakSet<Catalog>();
const battleByFrozen=new WeakMap<Catalog,Catalog>();
function freezeDeep(value:unknown,seen=new WeakSet<object>()):void{
  if(value&&typeof value==='object'&&!seen.has(value)){
    seen.add(value);for(const child of Object.values(value))freezeDeep(child,seen);
    Object.freeze(value);
  }
}
export function snapshotCatalog(catalog:Catalog):Catalog{
  if(snapshots.has(catalog))return catalog;
  const snapshot=structuredClone(catalog);
  freezeDeep(snapshot);snapshots.add(snapshot);return snapshot;
}
// Use the same runtime definitions in fresh games, restored games and AI
// simulations. Only managed immutable inputs may reuse the cached version.
export function snapshotBattleCatalog(catalog:Catalog):Catalog{
  if(battleSnapshots.has(catalog))return catalog;
  const immutable=snapshots.has(catalog);
  if(immutable){const cached=battleByFrozen.get(catalog);if(cached)return cached;}
  const battle=snapshotCatalog({...catalog,...Object.fromEntries(HERO_TOKENS.map(card=>[card.id,card]))});
  battleSnapshots.add(battle);
  if(immutable)battleByFrozen.set(catalog,battle);
  return battle;
}
