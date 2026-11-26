import {readFileSync} from 'node:fs';
import type {Catalog,Card,GameState,Minion,PlayerId} from '../../../packages/engine/src/index.ts';
import {paintedCardAsset,paintedHeroAsset,paintedPowerAsset} from '../src/painted-art-model.ts';
import {displayCardName} from '../src/card-names.ts';
import {className} from '../src/data.ts';

// A static layout illustration, not a browser screenshot; all names, artwork
// and statistics come from the same demonstration state as the React preview.
export function renderBattlePoster(game:GameState,catalog:Catalog,showHover=false):string{
  const esc=(v:unknown)=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const rect=(x:number,y:number,w:number,h:number,fill:string,stroke='none',r=0,sw=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const txt=(x:number,y:number,t:unknown,size=16,color='#f4e3c1',anchor='middle',weight=700)=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${color}">${esc(t)}</text>`;
  const circle=(x:number,y:number,r:number,fill:string,stroke='#e7c99a',sw=2)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  let serial=0;
  function art(asset:string,x:number,y:number,w:number,h:number,oval=false){
    const id='poster-art-'+serial++;
    const data=readFileSync('apps/client/src/assets/illustrations/'+asset+'.webp').toString('base64');
    return `<defs><clipPath id="${id}">${oval?`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}"/>`:rect(x,y,w,h,'white','none',9)}</clipPath></defs><image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/webp;base64,${data}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
  }
  const stat=(x:number,y:number,v:number,fill:string,r=20)=>circle(x,y,r,fill)+txt(x,y+7,v,24);
  const title=(card:Card)=>displayCardName(card,true);
  function minion(m:Minion,x:number,y:number,w:number){
    const c=catalog[m.cardId],h=w*1.12;
    return `<g>${rect(x,y,w,h,'#61482f',m.keywords?.includes('divineShield')?'#f2d995':'#d1ad68',w*.22,4)}${art(paintedCardAsset(c),x+5,y+5,w-10,w-10)}${m.frozenThroughTurn!==undefined?rect(x+3,y+3,w-6,h-6,'#91d2f344','#8de3ff',w*.2,3):''}${rect(x+4,y+h-23,w-8,20,'#372617','#bca06c',4)}${txt(x+w/2,y+h-8,title(c),13,'#fff1cb')}${stat(x+10,y+h-2,m.attack,'#99671e',18)}${stat(x+w-10,y+h-2,m.health,'#9c2928',18)}</g>`;
  }
  function row(seat:PlayerId,y:number){
    const board=game.players[seat].board,w=Math.min(166,Math.floor((1090-Math.max(0,board.length-1)*14)/Math.max(1,board.length))),spacing=w+14;
    return board.map((m,i)=>minion(m,800-(board.length-1)*spacing/2-w/2+i*spacing,y+(212-w*1.12)/2-3,w)).join('');
  }
  function hero(seat:PlayerId,y:number){
    const p=game.players[seat],x=735,w=130,h=94;
    return rect(x-5,y-4,w+10,h+8,'#694923','#c7a36b',38,4)+art(paintedHeroAsset(p.heroClass),x,y,w,h,true)+rect(x+9,y+h-22,w-18,23,'#30201c','#c6a571',5)+txt(800,y+h-5,className[p.heroClass],14)+stat(x+w+2,y+h-4,p.health,'#a52c28',21)+(p.armor?stat(x+w+6,y+12,p.armor,'#546876',17):'')+circle(945,y+49,32,'#6b5440','#bc9658',4)+art(paintedPowerAsset(p.heroClass),917,y+21,56,56,true)+stat(920,y+25,2,'#2559a4',14)+txt(945,y+92,'영웅 능력',12,'#51351f')+circle(655,y+49,31,'#55402e','#b8925d',4)+(p.weapon?txt(655,y+54,`${p.weapon.attack} / ${p.weapon.durability}`,20):txt(655,y+54,'—',22))+txt(655,y+92,'무기',12,'#51351f');
  }
  function hand(card:Card,x:number,y:number,angle:number,live?:Minion){
    const spell=card.kind==='spell'||card.kind==='secret',w=124,h=198;
    const label=title(card),description=card.kind==='coin'?'이번 턴 마나 1 획득':card.description||'효과 없음';
    const chars=description.match(/.{1,12}/gu)??[];
    return `<g transform="rotate(${angle} ${x+w/2} ${y+h})">${rect(x,y,w,h,spell?'#d1c1da':'#e7cea0',spell?'#725d91':'#886337',15,3)}${rect(x+4,y+4,w-8,h-8,'none','#b29565',12,2)}${art(paintedCardAsset(card),x+9,y+9,w-18,w-18,false)}${rect(x+5,y+114,w-10,22,spell?'#c4b0d5':'#d8b77b','#907247',4)}${txt(x+w/2,y+130,label,label.length>9?10:12,'#39271b')}${chars.slice(0,2).map((s,i)=>txt(x+w/2,y+153+i*13,s,11,'#3e3025','middle',500)).join('')}${chars.length>2?txt(x+w/2,y+177,'…',12,'#3e3025'):''}${stat(x+9,y+9,card.cost,'#265ea5',17)}${card.kind!=='coin'&&card.rarity!=='basic'?circle(x+w/2,y+h-10,5,card.rarity==='epic'?'#ab60e5':card.rarity==='rare'?'#56b0f4':'#d5d1ca','#ead7b7',1):''}${card.kind==='minion'?stat(x+10,y+h-12,live?.attack??card.attack,'#a77423',16)+stat(x+w-10,y+h-12,live?.health??card.health,'#a52d28',16):''}</g>`;
  }
  const p=game.players[0],q=game.players[1];
  const hovered=p.board[1];
  const zoom=showHover&&hovered?rect(29,325,503,363,'#34281f','#d8b577',15,4)+rect(38,334,485,345,'none','#8a6a45',11,2)+`<g transform="translate(58 354) scale(1.65)">${hand(catalog[hovered.cardId],0,0,0,hovered)}</g>`+txt(285,368,'카드 상세 · 1초 확대',15,'#d7b275','start')+txt(285,408,title(catalog[hovered.cardId]),21,'#f8db9f','start')+txt(285,448,'전장 능력치',16,'#aadea5','start')+txt(285,481,`공격력 ${hovered.attack}`,17,'#efddb9','start')+txt(285,511,`생명력 ${hovered.health}/${hovered.maxHealth}`,17,'#efddb9','start')+txt(285,649,'마우스를 떼면 닫힘 · Esc',13,'#c0b39f','start'):'';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" font-family="Noto Sans CJK KR, sans-serif">
  <defs><linearGradient id="wood" x2="0" y2="1"><stop stop-color="#6b4931"/><stop offset="1" stop-color="#3a261c"/></linearGradient><radialGradient id="parchment"><stop stop-color="#ecd6aa"/><stop offset="1" stop-color="#b28c59"/></radialGradient></defs>
  ${rect(0,0,1600,1000,'#221b19')}${txt(35,39,'CARD DUEL',27,'#f6dbab','start',900)}${txt(240,38,'v0.36.0',15,'#b5a08c','start')}${txt(1560,37,'화면 배치 미리보기 · 실제 게임 캡처 아님',15,'#d0bca0','end')}
  ${rect(18,58,1564,910,'url(#wood)','#a88250',27,7)}${rect(205,77,1190,865,'url(#parchment)','#382514',28,6)}${rect(222,93,1156,833,'none','#e2c18b',22,3)}
  ${rect(236,214,1128,218,'#c0a078','#906a42',12,2)}${rect(236,441,1128,218,'#dac094','#906a42',12,2)}${rect(236,432,1128,9,'#8a603a','#604121',5,2)}
  ${Array.from({length:q.hand.length},(_,i)=>`<g transform="rotate(${(i-2)*4} ${800+(i-2)*36} 93)">${rect(782+(i-2)*36,68,36,43,'#354d66','#c7a56e',6,2)}${circle(800+(i-2)*36,89,10,'#456277','#a98c5e')}${txt(800+(i-2)*36,94,'◆',11,'#d4b67c')}</g>`).join('')}
  ${txt(1330,100,`상대 손패 ${q.hand.length}장`,14,'#513b2b','end')}${hero(1,113)}${row(1,214)}${row(0,441)}${hero(0,663)}
  ${rect(35,269,154,336,'#33251d','#b89560',12,2)}${txt(112,301,'전투 기록',18)}${game.history.slice(-5).map((h,i)=>txt(48,342+i*45,h.message.slice(0,12),13,'#e9d7b7','start')).join('')}
  ${rect(1405,289,155,69,'#d8bd72','#f7dfa6',12,3)}${txt(1482,332,'턴 종료',23,'#3d281a')}${txt(1482,391,'내 차례',17,'#f5df9f')}${txt(1482,415,`턴 ${game.turn}`,14)}
  ${rect(1405,110,155,83,'#443225','#b28c57',10,2)}${txt(1482,142,'상대 덱',14)}${txt(1482,172,q.deck.length+'장',20)}${rect(1405,687,155,83,'#443225','#b28c57',10,2)}${txt(1482,719,'내 덱',14)}${txt(1482,749,p.deck.length+'장',20)}
  ${txt(1482,832,`${p.mana} / ${p.maxMana} 마나`,20,'#a6d9ff')}${Array.from({length:10},(_,i)=>circle(1421+(i%5)*30,861+Math.floor(i/5)*27,10,i<p.mana?'#62a6dc':'#514845',i<p.maxMana?'#bce2ff':'#9a8063')).join('')}
  ${p.hand.map((item,i)=>hand(catalog[item.cardId],430+i*124,758+Math.abs(i-2.5)*2,(i-2.5)*2)).join('')}
  ${zoom}${txt(800,990,'카드와 하수인에 1초 동안 마우스를 올리면 큰 그림과 상세 설명을 볼 수 있습니다.',14,'#d9c8af')}
  </svg>`;
}
/** Schematic before/after using the same source art to demonstrate crop and
 * aspect ratio independently of the regenerated dedicated illustrations. */
export function renderCardFrameComparison(catalog:Catalog):string{
 const escape=(v:unknown)=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const rect=(x:number,y:number,w:number,h:number,r:number,fill:string,stroke='none',sw=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
 const text=(x:number,y:number,label:unknown,size=16,fill='#f6dfb4',weight=700)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="${fill}" font-weight="${weight}">${escape(label)}</text>`;
 function card(id:string,x:number,y:number,isNew:boolean){
  const c=catalog[id],name=displayCardName(c,true),kind=c.kind,spell=kind==='spell'||kind==='secret',w=168,h=isNew?269:252;
  const iw=148,ih=isNew?148:104,ax=x+10,ay=y+9,clip='crop-'+id+'-'+(isNew?'new':'old');
  const shape=isNew||spell?rect(ax,ay,iw,ih,10,'white'):`<ellipse cx="${ax+iw/2}" cy="${ay+ih/2}" rx="${iw/2}" ry="${ih/2}" fill="white"/>`;
  const data=readFileSync('apps/client/src/assets/illustrations/'+paintedCardAsset(c)+'.webp').toString('base64');
  const desc=kind==='coin'?'이번 턴 마나 1 획득':c.description||'효과 없음',chars=desc.match(/.{1,16}/gu)??[];
  return rect(x,y,w,h,isNew?16:30,spell?'#d0d5e8':'#e8cea1','#886337',3)+rect(x+4,y+4,w-8,h-8,12,'none','#bb9a62',1.5)+`<defs><clipPath id="${clip}">${shape}</clipPath></defs><image x="${ax}" y="${ay}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid ${isNew?'meet':'slice'}" clip-path="url(#${clip})" href="data:image/webp;base64,${data}"/>`+rect(x+5,ay+ih-1,w-10,24,4,'#d4b176','#907247')+text(x+w/2,ay+ih+16,name,name.length>10?12:15,'#39271b')+chars.slice(0,2).map((s,i)=>text(x+w/2,ay+ih+43+i*17,s,12,'#3e3025',500)).join('')+`<circle cx="${x+12}" cy="${y+12}" r="19" fill="#265ea5" stroke="#c9ecff" stroke-width="2"/>`+text(x+12,y+19,c.cost,21)+((kind==='minion'||kind==='weapon')?`<circle cx="${x+13}" cy="${y+h-13}" r="18" fill="#a77423" stroke="#f5e2b4" stroke-width="2"/><circle cx="${x+w-13}" cy="${y+h-13}" r="18" fill="#a52d28" stroke="#f5e2b4" stroke-width="2"/>`+text(x+13,y+h-6,c.attack,20)+text(x+w-13,y+h-6,kind==='minion'?c.health:c.durability,20):'');
 }
 const ids=['wolf','pyroblast','faceless_manipulator'];
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="710" viewBox="0 0 1200 710" font-family="Noto Sans CJK KR, sans-serif">${rect(0,0,1200,710,0,'#251d1a')}${text(600,41,'카드 프레임 비율 개선',25)}${text(600,67,'같은 원본 그림으로 비교 · 실제 화면 캡처 아님',14,'#cfbda5',500)}${text(600,101,'이전 2:3 카드 / 가로로 긴 이미지 칸',17,'#e5c998')}${ids.map((id,i)=>card(id,250+i*266,115,false)).join('')}${text(600,408,'개선 5:8 카드 / 원본 1:1 그림 칸',17,'#9edda1')}${ids.map((id,i)=>card(id,250+i*266,422,true)).join('')}</svg>`;
}

/** Representative former shared-file groups: the old row is the actual
 * common asset, the new row is the active card-specific assignment. */
export function renderDuplicateArtComparison(catalog:Catalog):string{
 const escape=(v:unknown)=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const text=(x:number,y:number,v:unknown,size=14,color='#f4e0bc')=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="${color}" font-weight="700">${escape(v)}</text>`;
 const image=(a:string,x:number,y:number)=>`<image x="${x}" y="${y}" width="130" height="130" href="data:image/webp;base64,${readFileSync('apps/client/src/assets/illustrations/'+a+'.webp').toString('base64')}"/>`;
 const groups=[{title:'멀록 하수인',old:'fishfolk',ids:['reef_scout','reef_oracle','cold_oracle','tide_caller']},{title:'도적 단검과 주문',old:'dagger',ids:['precise_stab','needle_cut','knife_fan','shadow_rapier']}];
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="440" viewBox="0 0 1200 440" font-family="Noto Sans CJK KR, sans-serif"><rect width="1200" height="440" fill="#251d1a"/>${text(600,30,'서로 다른 카드의 그림 중복 제거',24)}${groups.map((g,i)=>{const x0=15+i*600;return text(x0+285,58,g.title,16)+text(x0+285,83,'이전 · 같은 그림 반복',14,'#e9c89c')+g.ids.map((_id,j)=>image(g.old,x0+j*145,95)).join('')+text(x0+285,251,'개선 · 카드마다 다른 그림',14,'#9edda1')+g.ids.map((id,j)=>image(paintedCardAsset(catalog[id]),x0+j*145,262)+text(x0+j*145+65,416,displayCardName(catalog[id],true),13)).join('');}).join('')}</svg>`;
}
