// Optional developer preview. Requires Git history and ImageMagick/Inkscape.
// Usage: node apps/client/test/art-variety-preview.mjs c51c353
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const baseline=process.argv[2];
if(!baseline||!/^[0-9a-f]{7,40}$/i.test(baseline))throw Error('Give the baseline Git commit hash.');
const dir='apps/client/src/assets/illustrations/';
const examples=[['classic-field-medic','의술사'],['classic-young-priestess','여사제'],['classic-mana-addict','마나 중독자'],['classic-pain-scholar','고통의 수행사제'],['goblin-bomber','폭탄병'],['rocket-pilot','로켓 조종사'],['fire','화염구'],['dagger','단검']];
const uri=(bytes)=>'data:image/png;base64,'+execFileSync('magick',['webp:-','png:-'],{input:bytes,maxBuffer:4000000}).toString('base64');
const label=(x,y,s,size=22,color='#f8e5c5')=>`<text x="${x}" y="${y}" font-family="Noto Sans CJK KR, sans-serif" font-size="${size}" fill="${color}" font-weight="700" text-anchor="middle">${s}</text>`;
const size=200,step=216,width=step*examples.length+24,height=570;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#231d1b"/>${label(width/2,31,'색·표정·자세·구도의 다양성 개선',30)}${label(width/2,62,'이전 그림',20,'#d7bd97')}${label(width/2,298,'개선 그림',20,'#a6db98')}`;
for(const [i,[asset,name]] of examples.entries()){
  const x=20+i*step,old=uri(execFileSync('git',['show',`${baseline}:${dir}${asset}.webp`],{maxBuffer:2000000})),next=uri(readFileSync(dir+asset+'.webp'));
  svg+=`<image x="${x}" y="72" width="${size}" height="${size}" xlink:href="${old}"/><image x="${x}" y="308" width="${size}" height="${size}" xlink:href="${next}"/>${label(x+size/2,535,name,19)}`;
}
svg+='</svg>';
mkdirSync('dist',{recursive:true});mkdirSync('previews',{recursive:true});
writeFileSync('dist/art-variety-comparison.svg',svg);
execFileSync('inkscape',['dist/art-variety-comparison.svg','--export-type=png','--export-filename=previews/art-variety-comparison.png'],{stdio:'inherit'});
