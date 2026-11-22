// Bundle the actual React game, its catalog, all card art and worker in one
// HTML file. No server or network is needed to open it after this build.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const directory=resolve('dist/offline');
let html=readFileSync(resolve(directory,'offline.html'),'utf8');
let scripts=0,styles=0;
html=html.replace(/<script\b[^>]*\bsrc="([^"\r\n]+)"[^>]*><\/script>/g,(_,src)=>{
  if(!/^\.\/assets\/[\w.-]+\.js$/.test(src))throw Error(`Unexpected script: ${src}`);
  scripts++;return '<script type="module">'+readFileSync(resolve(directory,src),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>';
});
html=html.replace(/<link\b[^>]*\bhref="([^"\r\n]+)"[^>]*>/g,(_,src)=>{
  if(!/^\.\/assets\/[\w.-]+\.css$/.test(src))throw Error(`Unexpected style: ${src}`);
  styles++;return '<style>'+readFileSync(resolve(directory,src),'utf8').replace(/<\/style/gi,'<\\/style')+'</style>';
});
if(scripts!==1||styles!==1)throw Error(`Expected 1 script and stylesheet; got ${scripts}, ${styles}`);
if(/url\(["']?(?:https?:|\/\/|\.\/assets)/.test(html))throw Error('External CSS resource left in offline game');
writeFileSync('solo-offline.html',html);
console.log(`Offline solo game written (${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MiB): solo-offline.html`);
