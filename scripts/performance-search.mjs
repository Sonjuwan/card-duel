import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const root=resolve(process.argv[2]??'.');
const source=pathToFileURL(root+'/apps/client/src/');
const data=await import(new URL('data.ts',source));
const {matchesCardSearch,cardSearchTerms}=await import(new URL('card-names.ts',source));
const catalogDirectory=pathToFileURL(root+'/data/cards/');
const {file}=JSON.parse(readFileSync(new URL('active.json',catalogDirectory),'utf8'));
data.loadPublicCatalog(JSON.parse(readFileSync(new URL(file,catalogDirectory),'utf8')),'a'.repeat(64));
const cards=Object.values(data.catalog);
const queries=['도발','전투의 함성','피해 2','죽음의 메아리','마나','fire-ball','토템'].map(cardSearchTerms);

function searchRound(){
  let matches=0;
  for(let repeat=0;repeat<100;repeat++){
    for(const terms of queries){
      for(const card of cards)matches+=Number(matchesCardSearch(card,terms));
    }
  }
  return matches;
}

const expected=searchRound();
const times=Array.from({length:7},()=>{
  const start=performance.now();
  const matches=searchRound();
  if(matches!==expected)throw Error('Search results changed between benchmark runs.');
  return performance.now()-start;
});
console.log(JSON.stringify({cards:cards.length,matches:expected,times,median:[...times].sort((a,b)=>a-b)[3]}));
