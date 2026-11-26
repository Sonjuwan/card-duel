import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,writeFileSync,renameSync,rmSync,mkdtempSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSoloRelease} from '../apps/cli/serve-solo-app.mjs';
import assert from 'node:assert/strict';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sri=bytes=>'sha256-'+createHash('sha256').update(bytes).digest('base64');

// Strictly rewrite only the generated painted-art background declarations.
// Leave all selectors and cascade order in the original stylesheet. Stable
// buckets are based on asset names, not file order or image bytes.
export function splitPaintedRules(css,count=8){
  if(![4,8,16,32].includes(count))throw Error('Expected 4, 8, 16 or 32 bundles');
  if(css.includes('--cd-bundle-art-'))throw Error('Reserved CSS variable prefix');
  const buckets=Array.from({length:count},()=>[]),originals=new Map();
  const pattern=/\.painted-art\.art-([a-z0-9-]+)\{background-image:(url\((?:"data:image\/webp;base64,[A-Za-z0-9+/=]+"|'data:image\/webp;base64,[A-Za-z0-9+/=]+'|data:image\/webp;base64,[A-Za-z0-9+/=]+)\));?\}/g;
  const main=css.replace(pattern,(rule,name,url)=>{
    if(originals.has(name))throw Error('Repeated painted-art selector '+name);
    originals.set(name,url);
    const bucket=parseInt(digest(name).slice(0,8),16)%count;
    buckets[bucket].push([name,url]);
    return rule.replace(url,'var(--cd-bundle-art-'+name+')');
  });
  if(!originals.size)throw Error('No supported painted-art declarations');
  if(/data:image\/webp;base64,/.test(main))throw Error('Unexpected remaining WebP declaration; inspect before changing package');
  const restored=main.replace(/var\(--cd-bundle-art-([a-z0-9-]+)\)/g,(_,name)=>originals.get(name));
  assert.equal(restored,css,'CSS round-trip');
  const files=new Map(buckets.map((entries,i)=>[
    'art-bundle-'+String(i).padStart(2,'0')+'.css',
    Buffer.from(':root{'+entries.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0).map(([name,url])=>'--cd-bundle-art-'+name+':'+url+';').join('')+'}')
  ]));
  return {main:Buffer.from(main),files,artCount:originals.size};
}

export function createPrototype(source,destination,count=8){
  source=resolve(source);destination=resolve(destination);
  if(existsSync(destination))throw Error('Refusing to overwrite '+destination);
  const {files}=loadSoloRelease(source);
  const before=files.get('game.css');
  if(!before||!files.has('version.json'))throw Error('Expected verified split PWA');
  const {main,files:bundles,artCount}=splitPaintedRules(before.toString('utf8'),count);
  files.set('game.css',main);
  for(const [name,bytes] of bundles)files.set(name,bytes);
  let html=files.get('index.html').toString('utf8');
  const oldLink='<link rel="stylesheet" href="game.css" integrity="'+sri(before)+'">';
  if(html.split(oldLink).length!==2)throw Error('Unexpected stylesheet link');
  const newLink=[...bundles].map(([name,bytes])=>'<link rel="stylesheet" href="'+name+'" integrity="'+sri(bytes)+'">').join('')+
    '<link rel="stylesheet" href="game.css" integrity="'+sri(main)+'">';
  html=html.replace(oldLink,newLink);
  const guard="node.getAttribute('href')==='game.css'";
  if(html.split(guard).length!==2)throw Error('Unexpected resource guard');
  html=html.replace(guard,"(node.getAttribute('href')==='game.css'||/^art-bundle-[0-9]{2}\\.css$/.test(node.getAttribute('href')||''))");
  files.set('index.html',Buffer.from(html));
  const marker=/^const release = (.+);$/m;
  const worker=files.get('sw.js').toString('utf8'),match=worker.match(marker);
  if(!match)throw Error('Missing service worker release');
  const old=JSON.parse(match[1]),template=worker.replace(marker,'const release = __CACHE_SPEC__;');
  const hashes=Object.fromEntries([...files].filter(([name])=>name!=='sw.js'&&name!=='version.json').map(([name,bytes])=>[name,digest(bytes)]));
  const release={id:digest(JSON.stringify(hashes)+template),version:old.version,files:hashes};
  files.set('sw.js',Buffer.from(template.replace('__CACHE_SPEC__',JSON.stringify(release))));
  files.set('version.json',Buffer.from(JSON.stringify({version:release.version,release:release.id})+'\n'));
  const parent=dirname(destination);mkdirSync(parent,{recursive:true});
  const temp=mkdtempSync(join(parent,'.bundle-study-'));
  try{
    for(const [name,bytes] of files)writeFileSync(join(temp,name),bytes,{flag:'wx'});
    renameSync(temp,destination);
  }catch(error){rmSync(temp,{recursive:true,force:true});throw error;}
  return {artCount,bundles:bundles.size,version:release.version,release:release.id,originalCssBytes:before.length,mainCssBytes:main.length,bundleBytes:[...bundles.values()].reduce((sum,b)=>sum+b.length,0)};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [source,destination,count]=process.argv.slice(2);
  if(!source||!destination)throw Error('Usage: node scripts/performance-pwa-bundle-prototype.mjs <verified-dist> <new-output-dir> [4|8|16|32]');
  console.log(JSON.stringify(createPrototype(source,destination,count===undefined?8:Number(count))));
}
