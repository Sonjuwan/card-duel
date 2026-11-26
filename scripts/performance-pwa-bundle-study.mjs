import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

// Static estimates ONLY. No release file is changed and no browser behavior
// or network timing is implied. Group membership assumes stable CSS order.
function splitWebpCss(css,groupCount){
  if(!Number.isSafeInteger(groupCount)||groupCount<1||groupCount>128)throw Error('Invalid group count');
  if(css.includes('--cd-profile-art-'))throw Error('Reserved variable prefix is already in use');
  const groups=Array.from({length:groupCount},()=>[]),urls=[],indices=new Map();
  const main=css.replace(/url\((?:"data:image\/webp;base64,[A-Za-z0-9+/=]+"|'data:image\/webp;base64,[A-Za-z0-9+/=]+'|data:image\/webp;base64,[A-Za-z0-9+/=]+)\)/g,url=>{
    let index=indices.get(url);
    if(index===undefined){index=urls.length;indices.set(url,index);urls.push(url);groups[index%groupCount].push(`--cd-profile-art-${index}:${url};`);}
    return `var(--cd-profile-art-${index})`;
  });
  const restored=main.replace(/var\(--cd-profile-art-(\d+)\)/g,(_,i)=>urls[Number(i)]);
  if(restored!==css)throw Error('CSS rewrite is not lossless');
  return {main,groups:groups.filter(g=>g.length).map(g=>':root{'+g.join('')+'}'),urls};
}

const bytes=s=>Buffer.byteLength(s);
const gz=s=>gzipSync(s).length;
function report(css){
  const base={rawBytes:bytes(css),gzipBytes:gz(css)};
  const results=[];
  for(const count of [1,4,8,16,32,64]){
    const {main,groups,urls}=splitWebpCss(css,count);
    const files=[main,...groups],sizes=groups.map(bytes),gzipSizes=groups.map(gz);
    const changes=urls.map((_,i)=>sizes[i%count]),compressedChanges=urls.map((_,i)=>gzipSizes[i%count]);
    const mean=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0;
    results.push({requestedGroups:count,assets:urls.length,cssRequests:files.length,
      rawBytes:files.reduce((sum,s)=>sum+bytes(s),0),gzipBytes:files.reduce((sum,s)=>sum+gz(s),0),
      largestGroupBytes:Math.max(0,...sizes),oneImageUpdateMeanGroupBytes:mean(changes),
      oneImageUpdateMeanGroupGzipBytes:mean(compressedChanges)});
  }
  return {baseline:base,results,note:'Virtual CSS bundles, not deployment files. One-image update estimate assumes unchanged ordering and no additional manifest/index bytes. Browser CSS variable resolution, install overhead, and actual transfer must be measured separately.'};
}
const fixture=".a{background:url(\"data:image/webp;base64,QUJD\")} .b{background-image:url(data:image/webp;base64,REVG)} .c{background:url(\"data:image/webp;base64,QUJD\")} .d{background:url('data:image/webp;base64,R0hJ')}";
for(const count of [1,2,8,16,32]){
  const result=splitWebpCss(fixture,count);
  assert.equal(result.urls.length,3);assert.equal(result.groups.length,Math.min(3,count));
  assert.ok(!result.main.includes('data:image/webp'));
}
const path=resolve(process.argv[2]??'dist/solo-app/game.css');
console.log(JSON.stringify(report(readFileSync(path,'utf8')),null,2));
