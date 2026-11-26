import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';

const css=readFileSync(resolve(process.argv[2]??'dist/solo-app/game.css'),'utf8');
const limit=Number(process.argv[3]??24);
assert.ok(Number.isInteger(limit)&&limit>=1&&limit<=500);
const entries=[...new Set([...css.matchAll(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/g)].map(m=>m[1]))]
  .map(encoded=>({encoded,bytes:Buffer.from(encoded,'base64')})).sort((a,b)=>b.bytes.length-a.bytes.length);
assert.ok(entries.length);
const temp=mkdtempSync(join(tmpdir(),'card-duel-art-study-'));
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'pipe',timeout:30000,maxBuffer:4*1024*1024});
const samples=[],replacements=new Map();
try{
  for(const item of entries.slice(0,limit)){
    const {encoded,bytes}=item,source=join(temp,'source.webp'),decoded=join(temp,'decoded.png'),candidate=join(temp,'candidate.webp'),before=join(temp,'before.pam'),after=join(temp,'after.pam');
    // Animated, color-profiled and metadata-bearing images are excluded.
    let excluded=false;
    for(let i=12;i+8<=bytes.length;){
      const type=bytes.toString('ascii',i,i+4),n=bytes.readUInt32LE(i+4);
      if(['ANIM','ANMF','ICCP','EXIF','XMP '].includes(type))excluded=true;
      i+=8+n+(n%2);
    }
    if(excluded){samples.push({original:bytes.length,excluded:true});continue;}
    writeFileSync(source,bytes);
    run('dwebp',[source,'-o',decoded]);
    run('cwebp',['-quiet','-lossless','-exact','-z','6',decoded,'-o',candidate]);
    run('dwebp',[source,'-pam','-o',before]);
    run('dwebp',[candidate,'-pam','-o',after]);
    const output=readFileSync(candidate),identical=readFileSync(before).equals(readFileSync(after));
    const accepted=identical&&output.length<bytes.length;
    if(accepted)replacements.set(encoded,output.toString('base64'));
    samples.push({original:bytes.length,candidate:output.length,identical,accepted});
  }
  const rewritten=css.replace(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/g,(match,encoded)=>replacements.has(encoded)?'data:image/webp;base64,'+replacements.get(encoded):match);
  console.log(JSON.stringify({totalAssets:entries.length,sampled:samples.length,accepted:replacements.size,originalCssBytes:Buffer.byteLength(css),candidateCssBytes:Buffer.byteLength(rewritten),originalGzipBytes:gzipSync(css).length,candidateGzipBytes:gzipSync(rewritten).length,samples,note:'Read-only experiment on largest assets. Accept only byte-identical decoded PAM pixels with smaller WebP bytes. No production files rewritten, no extrapolation from sample.'},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
