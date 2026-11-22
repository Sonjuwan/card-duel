import {attachLocalDuel} from './local-duel-session.ts';
import type {LocalDuelScope} from './local-duel-session.ts';
import {IndexedLocalSaveStore} from './local-save-store.ts';
const scope=globalThis as unknown as LocalDuelScope;
const owner=typeof crypto!=='undefined'?Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''):String(Date.now())+'-'+Math.random();
attachLocalDuel(scope,new IndexedLocalSaveStore(),owner);
