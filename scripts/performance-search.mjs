import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
const root=resolve(process.argv[2]??'.');
const {loadPublicCatalog}=await import(root+'/apps/client/src/data.ts');
loadPublicCatalog(JSON.parse(readFileSync(root+'/data/cards/v0.23.0.json','utf8')),'a'.repeat(64));
const {catalog}=await import(root+'/apps/client/src/data.ts');
const {matchesCardSearch,cardSearchTerms}=await import(root+'/apps/client/src/card-names.ts');
const cards=Object.values(catalog);
const terms=['도발','전투의 함성','피해 2','죽음의 메아리','마나','fire-ball','토템'].map(cardSearchTerms);
let matches=0;
function run(){for(let i=0;i<100;i++)for(const q of terms)for(const card of cards)matches+=Number(matchesCardSearch(card,q));}
run();
const times=[];for(let i=0;i<7;i++){matches=0;const start=performance.now();run();times.push(performance.now()-start);}
console.log(JSON.stringify({cards:cards.length,matches,times,median:times.sort((a,b)=>a-b)[3]}));
