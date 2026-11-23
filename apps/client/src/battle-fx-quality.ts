export type FxQuality='auto'|'economy'|'rich';
export function normalizeFxQuality(value:unknown):FxQuality{return value==='economy'||value==='rich'?value:'auto';}
let quality:FxQuality='auto';
try{quality=normalizeFxQuality(globalThis.localStorage?.getItem('card-duel-fx-quality'));}catch{}
export const battleFxQuality=()=>quality;
export function setBattleFxQuality(value:FxQuality){quality=normalizeFxQuality(value);try{localStorage.setItem('card-duel-fx-quality',quality);}catch{}}
