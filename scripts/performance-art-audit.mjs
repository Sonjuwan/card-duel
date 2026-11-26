import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const css=readFileSync(resolve(process.argv[2]??'dist/solo-app/game.css'),'utf8');
const matches=[...css.matchAll(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/g)];
const seen=new Map(),chunks=new Map();
let duplicateBytes=0,metadataBytes=0,decodedBytes=0,base64Bytes=0;
for(const [,encoded] of matches){
  const bytes=Buffer.from(encoded,'base64');
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(bytes.readUInt32LE(4)+8,bytes.length);
  decodedBytes+=bytes.length;base64Bytes+=encoded.length;
  const id=hash(bytes);
  if(seen.has(id))duplicateBytes+=bytes.length;
  else seen.set(id,bytes.length);
  for(let pos=12;pos<bytes.length;){
    assert.ok(pos+8<=bytes.length,'truncated WebP chunk');
    const kind=bytes.toString('ascii',pos,pos+4),size=bytes.readUInt32LE(pos+4),length=8+size+(size%2);
    assert.ok(pos+length<=bytes.length,'truncated WebP payload');
    const count=chunks.get(kind)??{count:0,bytes:0};
    count.count++;count.bytes+=length;chunks.set(kind,count);
    // Audit only. ICC profiles affect rendering; EXIF may include orientation.
    // Do not strip metadata or re-encode art without pixel-level validation.
    if(kind==='EXIF'||kind==='XMP ')metadataBytes+=length;
    pos+=length;
  }
}
assert.ok(matches.length>0,'No WebP assets found');
console.log(JSON.stringify({assetCount:matches.length,uniqueAssets:seen.size,decodedBytes,base64Bytes,duplicateBytes,metadataBytes,cssBytes:Buffer.byteLength(css),gzipBytes:gzipSync(css).length,brotliBytes:brotliCompressSync(css,{params:{[constants.BROTLI_PARAM_QUALITY]:5}}).length,chunks:Object.fromEntries(chunks),note:'Read-only inventory; duplicate or metadata counts are potential bounds, not measured release savings. ICC is never counted as removable metadata.'},null,2));
