import type {GrowthView} from '../../../packages/account-protocol.ts';
import {decodeGrowthBackup} from './offline-growth.ts';
import type {OfflineGrowthBackup} from './offline-growth.ts';
import {parseDeckBackup,previewDeckRestore,restoreDeckLibrary} from './named-decks.ts';
import type {DeckLibraryBackup} from './named-decks.ts';
import {validSoloSlot} from './solo-slots.ts';
import type {SoloSlot} from './solo-slots.ts';

/** Portable offline snapshot of completed growth and named decks, not live game state.
 * The source slot is informational; import always targets the user's selected slot. */
export type SlotBackup={format:'card-duel-slot-backup';schema:1;exportedAt:string;sourceSlot:SoloSlot;growth:OfflineGrowthBackup;decks:DeckLibraryBackup};
export const isSlotBackup=(raw:unknown):boolean=>!!raw&&typeof raw==='object'&&(raw as Record<string,unknown>).format==='card-duel-slot-backup';
export function decodeSlotBackup(raw:unknown,growth:GrowthView):SlotBackup{
  if(!isSlotBackup(raw))throw Error('성장+덱 통합 백업 파일이 아닙니다.');
  const backup=raw as SlotBackup;
  if(backup.schema!==1||!validSoloSlot(backup.sourceSlot)||typeof backup.exportedAt!=='string'||!Number.isFinite(Date.parse(backup.exportedAt)))throw Error('지원하지 않는 통합 백업입니다.');
  decodeGrowthBackup(backup.growth,growth);parseDeckBackup(backup.decks);
  return backup;
}
export function createSlotBackup(sourceSlot:SoloSlot,progress:OfflineGrowthBackup,decks:DeckLibraryBackup,growth:GrowthView,now=new Date().toISOString()):SlotBackup{
  return structuredClone(decodeSlotBackup({format:'card-duel-slot-backup',schema:1,exportedAt:now,sourceSlot,growth:progress,decks},growth));
}
export function growthBackupPart(raw:unknown,growth:GrowthView):unknown{return isSlotBackup(raw)?decodeSlotBackup(raw,growth).growth:raw;}
export function deckBackupPart(raw:unknown,growth:GrowthView):unknown{return isSlotBackup(raw)?decodeSlotBackup(raw,growth).decks:raw;}

/** One file picker, but two distinct storage systems. Validate both before
 * restoring growth; merge decks only after the worker confirms that commit.
 * A later storage failure can be retried using the original deck file. */
export function prepareSlotRestore(raw:unknown,growth:GrowthView,store:Pick<Storage,'getItem'|'setItem'>){
  const backup=structuredClone(decodeSlotBackup(raw,growth));
  const preview=previewDeckRestore(backup.decks,store);
  return {growth:backup.growth,sourceSlot:backup.sourceSlot,preview,restoreDecks:()=>restoreDeckLibrary(backup.decks,store)};
}
