import {build} from 'vite';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const {file}=JSON.parse(readFileSync('data/cards/active.json','utf8'));
const raw=readFileSync(resolve('data/cards',file),'utf8');
const out=resolve('dist/animation-demo');
await build({configFile:false,root:resolve('apps/client'),define:{
  'process.env.NODE_ENV':JSON.stringify('production'),
  __DEMO_CATALOG__:raw,
  __DEMO_CATALOG_HASH__:JSON.stringify(createHash('sha256').update(raw).digest('hex')),
},build:{outDir:out,emptyOutDir:true,assetsInlineLimit:Number.MAX_SAFE_INTEGER,lib:{entry:resolve('apps/client/test/animation-preview.tsx'),name:'CardDuelAnimationDemo',formats:['iife'],fileName:'animation',cssFileName:'animation'}}});
const js=readFileSync(resolve(out,'animation.iife.js'),'utf8').replace(/<\/script/gi,'<\\/script');
const css=readFileSync(resolve(out,'animation.css'),'utf8');
if(!css.includes('data:image/webp;base64,')||!js.includes('전투 연출 체험장'))throw Error('Animation preview missing local bundled assets or code');
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RUNEHALL v0.36.0 전투 연출 체험장</title><style>${css}</style></head><body><div id="fx-root"></div><script>${js}</script></body></html>`;
writeFileSync('animation-preview.html',html);console.log('Standalone animation preview:',Buffer.byteLength(html),'bytes');
