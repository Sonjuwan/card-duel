import {useId} from 'react';
import type {Card,HeroClass} from '../../../packages/engine/src/index.ts';
import {ART_PALETTES,cardArtRecipe,heroArtRecipe,powerArtRecipe} from './local-art-model.ts';
import type {ArtRecipe,ArtSubject} from './local-art-model.ts';
import { paintedCardAsset, paintedHeroAsset, paintedPowerAsset } from './painted-art-model.ts';
import type { PaintedAsset } from './painted-art-model.ts';

type Colors=readonly [string,string,string,string,string];
const ink='#181e26';
const metal='#bad0d5';
const gold='#d9b56b';
const skin=['#c88b65','#dfb184','#a87454','#b99977','#d6ae91','#83a395','#b695b7'];
const stars=[[21,27],[42,12],[132,32],[143,59],[111,14],[19,78],[68,20],[149,10]];
const HUMAN=new Set<ArtSubject>(['knight','mage','rogue','priest','archer','brute','dwarf','pirate','demon']);
const BEAST=new Set<ArtSubject>(['wolf','cat','bear','boar','bird','snake','turtle','sheep','fishfolk','dragon','beast','raptor','rhino','crocodile','ape','frog']);
const OBJECT=new Set<ArtSubject>(['sword','axe','dagger','bow','hammer','arrow','shield','book','coin','trap','totem','golem']);

function Spark({x,y,r=5,color}:{x:number;y:number;r?:number;color:string}){return <path d={`M${x} ${y-r}l${r*.28} ${r*.72} ${r*.72} ${r*.28}-${r*.72} ${r*.28}-${r*.28} ${r*.72}-${r*.28}-${r*.72}-${r*.72}-${r*.28} ${r*.72}-${r*.28}Z`} fill={color} stroke="none"/>;}

/** Deliberately small, independently drawn fantasy portraits. A seed varies
 * palette, details and scenery. No source game images are embedded or fetched. */
function ArtFrame({recipe}:{recipe:ArtRecipe}){
  const {subject,seed,variant,hero}=recipe,p=ART_PALETTES[recipe.theme];
  const uid=useId().replace(/[^A-Za-z0-9_-]/g,'');
  const sky=`sky-${uid}`,halo=`sun-${uid}`,clip=`clip-${uid}`;
  const moonX=variant%2===0?103+(seed>>>9)%22:33+(seed>>>9)%22;
  const scene=seed%5;
  const mountain=scene===1||recipe.theme==='earth'||recipe.theme==='frost';
  const woodland=scene===2||recipe.theme==='forest';
  return <svg className="original-art" data-art-subject={subject} data-art-seed={seed} viewBox="0 0 160 144" preserveAspectRatio="xMidYMid slice" overflow="hidden" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1"><stop stopColor={p[0]}/><stop offset=".6" stopColor={p[1]}/><stop offset="1" stopColor={p[4]}/></linearGradient>
      <radialGradient id={halo}><stop stopColor={p[3]} stopOpacity=".75"/><stop offset="1" stopColor={p[2]} stopOpacity="0"/></radialGradient>
      <clipPath id={clip}><rect width="160" height="144"/></clipPath>
    </defs>
    <g clipPath={`url(#${clip})`}>
    <rect width="160" height="144" fill={`url(#${sky})`}/>
    <circle cx={moonX} cy={37+variant*3} r="62" fill={`url(#${halo})`}/>
    <circle cx={moonX} cy={37+variant*3} r={17+variant%3*5} fill={p[3]} opacity=".34"/>
    <path d="M-8 90 20 64 37 83 63 53 85 76 115 57 170 88v56H-8Z" fill={p[0]} opacity=".48"/>
    {mountain?<g opacity=".64"><path d="m0 104 35-53 31 53 33-69 61 85v24H0Z" fill={p[0]}/><path d="m20 76 15-25 14 26-14-7-5 7m49-2 20-40 28 42-27-11-9 14" fill={p[2]} opacity=".61"/></g>:woodland?<g fill={p[0]} opacity=".63"><path d="M7 112V42L0 69l21-32 23 39-12-6v42zm107 22V51l-20 39 17-3-13 24 14-6v29m31-4V24l-22 42 18-7-25 43 23-6v34Z"/><path d="m0 104 24-13 23 12 27-6 36 16 50-14v45H0Z"/></g>:<g fill={p[0]} opacity=".48"><path d="M0 116V71h12V49h16v26h17v54zm127 6V65h11V37h12v28h10v79z"/><path d="M0 118q37-16 79-9t81-8v43H0z"/></g>}
    <path d="M0 128Q40 111 80 129t80-7v22H0Z" fill={p[0]} opacity=".73"/>
    {stars.map(([x,y],i)=><Spark key={i} x={(x+variant*4+(seed>>>(i*3))%17)%154+3} y={Math.min(94,y+(seed>>>(i*2+4))%9)} r={i%3===0?3.6:1.8} color={p[3]}/>)}
    {hero&&<g fill="none" stroke={p[3]} opacity=".45"><circle cx="80" cy="68" r="57" strokeWidth="1.7"/><circle cx="80" cy="68" r="52" strokeDasharray="2 7"/></g>}
    <g stroke={ink} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
      {HUMAN.has(subject)?<Portrait subject={subject} p={p} v={variant} hero={!!hero}/>:BEAST.has(subject)?<Creature subject={subject} p={p} v={variant}/>:OBJECT.has(subject)?<Artifact subject={subject} p={p} v={variant}/>:<Magic subject={subject} p={p} v={variant}/>}
    </g>
    <path d="M0 137q42-5 67 1t93-3v9H0Z" fill={p[0]} opacity=".43"/>
    </g>
  </svg>;
}

function Portrait({subject:s,p,v,hero}:{subject:ArtSubject;p:Colors;v:number;hero:boolean}){
  const isBrute=s==='brute'||s==='demon',isDwarf=s==='dwarf',isMage=s==='mage'||s==='priest',hood=s==='rogue'||s==='archer',knight=s==='knight',pirate=s==='pirate';
  const complexion=isBrute?(s==='demon'?p[4]:['#a28c62','#788f62','#967876'][v%3]):skin[(v+(isDwarf?1:0))%skin.length];
  const x=isBrute?72:80,headY=isDwarf?46:36;
  const collar=hero?gold:p[2];
  const forestHero=hero&&s==='priest'&&p===ART_PALETTES.forest,holyHero=hero&&s==='priest'&&p===ART_PALETTES.gold,shamanHero=hero&&p===ART_PALETTES.ocean,paladinHero=hero&&knight&&p===ART_PALETTES.gold;
  return <>
    <path d={`M${isBrute?8:18} 144 24 104 48 87 60 80h39l22 9 25 17 14 38Z`} fill={p[0]}/>
    <path d="M15 144 28 109l28-20 25 15 27-16 28 22 13 34" fill={p[4]}/>
    <path d="m22 113 22-21 14 4-6 21-27 12m112-17-21-19-15 5 8 24 26 6" fill={p[1]} stroke={p[2]}/>
    {knight||isBrute?<><path d="m9 124 12-26 27-9 11 15-14 20-33 16m139-10-16-33-27-8-10 15 14 21 34 14" fill={knight?metal:p[4]}/><path d="m19 111 24-11 7 7m87 4-21-11-8 7" fill="none" stroke={p[3]} strokeWidth="3"/></>:<path d="m36 107 20-19 24 19 24-19 20 19-10 37H46Z" fill={p[1]} stroke={collar} strokeWidth="3"/>}
    <path d="m70 81-3 17 13 13 14-13-3-17" fill={complexion}/>
    <path d={`M${x-27} ${headY+24}q-8-8-11 2l9 15 7-4m${56} -13q8-8 11 2l-9 15-7-4`} fill={complexion}/>
    {!knight&&<path d={`M${x-27} ${headY+14}q0-26 26-30t27 30l-5 31-21 17-21-17Z`} fill={p[0]}/>}
    <path d={`M${x-22} ${headY+14}q5-17 22-16 16 0 23 16l-4 30-19 15-19-15Z`} fill={complexion}/>
    <path d={`M${x-18} ${headY+23}l12-4m12 0 12 4`} stroke="#594133" strokeWidth="3" fill="none"/>
    <path d={`M${x-19} ${headY+28}q7-4 13 0m12 0q7-4 13 0`} fill="none" stroke={ink} strokeWidth="3.2"/>
    <circle cx={x-12} cy={headY+27} r="2.3" fill={s==='demon'?p[3]:'#f9e3b0'} stroke="none"/>
    <circle cx={x+12} cy={headY+27} r="2.3" fill={s==='demon'?p[3]:'#f9e3b0'} stroke="none"/>
    <path d={`M${x} ${headY+26}l-3 12 6 1m-11 10q8 4 16 0`} fill="none" stroke="#6b4839" strokeWidth="2"/>
    {isBrute&&<><path d={`M${x-16} ${headY+48}l-6-12 13 7m25 5 6-12-13 7`} fill="#f7ddb0"/><path d="M36 46 22 19l19 10 12 21m69-4 14-27-19 10-12 21" fill={s==='demon'?gold:complexion}/></>}
    {forestHero&&<path d="M53 47 37 25 30 9 39 14 43 24 45 10 48 18 48 32 58 39m49 8 15-22 8-16-9 5-4 10-2-14-4 8 1 14-10 7" stroke={gold} strokeWidth="4.5" fill="none"/>}
    {holyHero&&<path d="M52 48 53 30 68 29 79 13 91 29 107 30 108 48" stroke="#fff0b4" strokeWidth="5" fill="none"/>}
    {shamanHero&&<g fill="#a5e9d0"><circle cx="46" cy="73" r="5"/><circle cx="114" cy="73" r="5"/></g>}
    {knight?<><path d="M50 71 48 42Q56 15 80 15t32 27l-3 29-12-7V40H63v24l-13 7Z" fill={metal}/><path d="M51 43h58L98 32H62Z" fill="#e8e8d9"/><path d="m80 18 4 46-4 9-4-9Z" fill="#667781"/><path d="M60 51h16m8 0h16" stroke={ink} strokeWidth="5"/><path d="m75 21 5-11 5 11" fill={p[2]}/></>:isMage?<><path d="M46 45 54 25 79 6 108 33 115 55l-18-14-18-9-22 11-6 15Z" fill={p[1]}/><path d="m54 42 25-24 25 22-25-10Z" fill={p[2]} stroke={collar}/><path d="m65 81 15 6 16-6 3 10-19 23-20-22Z" fill={v%2===0?'#c6d4c7':'#5b3a35'}/></>:hood?<><path d="m47 57 1-24L80 9l29 24 5 29-19-25-15-9-17 12Z" fill={p[0]} stroke={p[2]}/>{s==='rogue'&&<path d="M59 67q21 8 42 0l-2 20-19 10-18-12Z" fill={p[1]}/>}</>:pirate?<><path d="m39 39 19-19 22 14 23-14 18 20-15 12H54Z" fill="#27313a"/><path d="M75 29v13m-5-10h10" stroke={gold} fill="none"/><path d="m82 57 18 2-3 9-13-1" fill={ink}/></>:isDwarf?<><path d="M53 49 63 26l17-6 19 9 7 20-20-9-20 2Z" fill={p[4]}/><path d="M57 90 61 75l19 9 19-9 4 17-23 27Z" fill={v%2===0?'#d1c4a4':'#975a41'}/><path d="m66 87 14 22 13-22" stroke="#513b32" fill="none"/></>:<path d="M49 48 56 21l26-7 20 15 6 17-16-9-19 4-11-5Z" fill={p[0]}/>}
    <path d="m65 117 15-14 15 14-15 20Z" fill={collar}/><path d="m80 108 7 10-7 9-7-9Z" fill={p[3]}/>
    {paladinHero&&<path d="M48 43q32-18 64 0M80 17v34" stroke="#f5d47e" strokeWidth="5" fill="none"/>}
    {s==='archer'?<g transform="translate(128 6) rotate(12)"><path d="M-4 9q24 40 0 106" fill="none" stroke={gold} strokeWidth="6"/><path d="M-4 9v106" fill="none" stroke={p[3]} strokeWidth="1.4"/></g>:isMage?<g transform="translate(134 18)"><path d="M-5 33v114" stroke={gold} strokeWidth="6"/><circle cx="-5" cy="20" r="15" fill={p[2]}/><path d="m-5 4 10 16-10 16-10-16Z" fill={p[3]}/><Spark x={-5} y={20} r={7} color="white"/></g>:v%3===0&&knight?<g transform="translate(3 77)"><path d="M3 5 36-4 69 5v34Q55 61 36 68 15 59 3 39Z" fill={gold}/><path d="M9 10 36 3 63 10v26q-8 18-27 27Q18 53 9 36Z" fill={p[1]}/><path d="m36 13 13 21-13 21-13-21Z" fill={p[3]}/></g>:v%3===1&&isBrute?<g transform="translate(15 7) rotate(-17)"><path d="M0 18h9v117H0Z" fill="#866048"/><path d="M2 22-16 7-31 14v31l14 13 19-14M8 22 25 7 39 14v31L25 58 8 44" fill={metal}/><path d="M-25 16v26M33 16v26" stroke="#f5ead0" strokeWidth="3"/></g>:<g transform="translate(21 7) rotate(-18)"><path d="M-3 105h8v37h-8z" fill="#8c593c"/><path d="M-9 102h20v6H-9Z" fill={gold}/><path d="m-5 100 0-69 6-14 7 14-1 69Z" fill={metal}/><path d="M1 32v63" stroke="#f5ead0" strokeWidth="2"/></g>}
  </>;
}

function Creature({subject:s,p,v}:{subject:ArtSubject;p:Colors;v:number}){
  const fur=p[4],light=p[2],bright=p[3],dark=p[0];
  if(s==='raptor')return <><path d="M8 119q23-9 37-27 22-12 45 2l-11 18-22 9-21 16H14Z" fill={fur}/><path d="M50 138 60 105 82 81 70 54 80 31 104 20 145 34 152 54 126 70 102 74 112 97 108 137Z" fill={light}/><path d="m84 31 14-17 7 16 12-11 4 16 10-7 6 10" fill={fur}/><path d="m92 46 18-10 22 7-14 9H95Z" fill={dark}/><circle cx="112" cy="44" r="4.7" fill={bright}/><path d="M106 59q21 10 42-8l-7 17-27 2Z" fill={dark}/><path d="m114 62 7 8 6-8 7 5 5-8" fill={bright}/><path d="m67 108 21 3 10-11m-10 11 2 12m-1-12 12 4" stroke={dark} fill="none" strokeWidth="4"/><path d="M62 122l25-6m3 14 20-11M84 81l12-8m-18-9 15-9" stroke={fur} strokeWidth="4" fill="none"/></>;
  if(s==='crocodile')return <><path d="M5 130 22 102 48 96 53 56 81 39 135 47 151 63 151 87 98 107 81 139Z" fill={fur}/><path d="m52 62 18-29L91 37l12-9 17 11 23-2 11 19-52 17Z" fill={light}/><path d="m56 60 20-11 11 10-13 8Z" fill={dark}/><circle cx="75" cy="57" r="4" fill={bright}/><path d="M90 76 153 67l-4 21-45 10Z" fill={dark}/><path d="m100 76 6 9 8-11 8 8 9-10 7 7 9-9" fill={bright}/><path d="m14 123 23-19 19 1m6 13 11-12m1 22 15-12" fill="none" stroke={light} strokeWidth="4"/></>;
  if(s==='rhino')return <><path d="M6 144 16 103 46 80 104 80 138 107 154 144Z" fill={fur}/><path d="M37 65 28 29 55 35 67 51m45 14 11-36-28 6-12 16" fill={fur}/><path d="M48 54 81 39 113 52 120 83 107 124 82 139 57 126 42 88Z" fill={light}/><path d="m52 70 21-4-8 12-12-1m57-7-21-4 8 12 12-1" fill={dark}/><path d="M62 98 80 54 98 98 87 116H72Z" fill={bright}/><path d="m80 54 0 62" stroke={gold} strokeWidth="2"/><ellipse cx="80" cy="118" rx="23" ry="13" fill={fur}/><circle cx="69" cy="118" r="4" fill={dark}/><circle cx="91" cy="118" r="4" fill={dark}/></>;
  if(s==='ape')return <><path d="M3 144 10 99 35 79 54 82h56l17-4 25 20 7 46Z" fill={fur}/><path d="M42 63Q39 26 79 18t39 44l-4 35-34 32-33-34Z" fill={dark}/><path d="M48 64 65 48h30l17 16-9 23 6 14-13 20H65l-14-20 6-14Z" fill={light}/><path d="m53 70 19 0m17 0h19" stroke={dark} strokeWidth="5"/><circle cx="66" cy="72" r="3" fill={bright}/><circle cx="95" cy="72" r="3" fill={bright}/><path d="m80 76-10 16 10 6 11-6Z" fill={fur}/><path d="M63 108q16 7 34 0" stroke={dark} strokeWidth="4" fill="none"/><path d="M33 104 55 142m73-38-22 38" stroke={light} strokeWidth="6" fill="none"/></>;
  if(s==='frog')return <><path d="M13 137q3-28 34-37l12-16 43 0 14 16q31 9 33 37Z" fill={fur}/><ellipse cx="80" cy="90" rx="48" ry="38" fill={light}/><circle cx="51" cy="60" r="23" fill={fur}/><circle cx="109" cy="60" r="23" fill={fur}/><circle cx="51" cy="58" r="15" fill={bright}/><circle cx="109" cy="58" r="15" fill={bright}/><ellipse cx="51" cy="58" rx="7" ry="10" fill={dark}/><ellipse cx="109" cy="58" rx="7" ry="10" fill={dark}/><path d="M46 97q34 25 69 0" stroke={dark} strokeWidth="4" fill="none"/><path d="M12 137 28 124 46 137m68 0 18-13 16 13" fill={light}/></>;
  if(s==='dragon')return <><path d="M78 117 20 92 8 29 50 52 54 20 91 62 126 14 155 91 121 119Z" fill={p[1]}/><path d="m16 40 36 48 7-32 34 22 33-53 20 65-48 22Z" fill={fur}/><path d="M32 141q-1-42 28-52L54 62 41 37l27 12 20-23 8 24 28-18-7 33 14 15-19 7-23 30-6 25Z" fill={light}/><path d="m78 82 20 1 14-10-7 16-18 19-25 6Z" fill={bright}/><path d="m66 56 17 7-15 4m29-4 13-6-2 9Z" fill={ink}/><path d="m102 87 22-7-12 11-8 10m-35 24 11 5 3 11" fill="none" stroke={p[0]} strokeWidth="3"/><path d="m57 62-17-24 18 9 14-12-1 18m34 4 19-23-8 30" fill={gold}/></>;
  if(s==='bird')return <><path d="M19 96 4 43l41 15 21 25 44-29 46-13-15 63-38 17-53 6Z" fill={fur}/><path d="m14 52 33 24 12 14-33-7m120-29-34 22-11 14 34-9" stroke={bright} fill="none" strokeWidth="3"/><path d="M46 132q-6-24 14-48l-2-20q2-30 25-31t27 29l-8 27 14 45Z" fill={light}/><path d="M62 59q19-19 40 0l-6 14H68Z" fill={bright}/><circle cx="71" cy="65" r="7" fill={gold}/><circle cx="94" cy="65" r="7" fill={gold}/><circle cx="71" cy="65" r="3" fill={ink}/><circle cx="94" cy="65" r="3" fill={ink}/><path d="m82 68 12 5-12 15-11-15Z" fill={gold}/><path d="m65 105 12 20 8-18 11 18 5-20" stroke={fur} fill="none" strokeWidth="3"/></>;
  if(s==='snake')return <><path d="M29 137q-27-34 10-49l49-8q25-10 7-34" stroke={ink} strokeWidth="25" fill="none"/><path d="M29 137q-27-34 10-49l49-8q25-10 7-34" stroke={fur} strokeWidth="20" fill="none"/><path d="M29 137q-27-34 10-49l49-8q25-10 7-34" stroke={light} strokeWidth="8" fill="none" strokeDasharray="9 8"/><path d="m63 62-12-26 19-18 26 8 23 26-9 18-25 9Z" fill={fur}/><path d="m66 42 16-4 8 9m7 0 7-8 9 8" fill={bright}/><path d="m87 61 14 5-6 10 4 8" stroke={gold} fill="none"/><path d="m96 81 5 12 7-4m-7 4-1 8" stroke="#e66f70" fill="none"/></>;
  if(s==='turtle')return <><ellipse cx="79" cy="103" rx="64" ry="32" fill={fur}/><path d="M26 95q2-44 51-52 45 2 59 51Z" fill={light}/><path d="m77 44-23 21 12 18 26 0 14-18Z" fill={p[1]}/><path d="m54 65-25 11m77-11 23 15M66 83l-10 19m36-19 11 19" fill="none" stroke={dark}/><path d="M21 89 6 104l16 11 19-13m83-20 14-11 15 11-8 13-16 4" fill={fur}/><circle cx="143" cy="83" r="4" fill={bright}/><path d="M45 121 37 137h26l8-15m28 0 11 15h25l-9-17" fill={fur}/></>;
  if(s==='fishfolk')return <><path d="M34 144 43 96 59 80h43l16 24 11 40" fill={fur}/><path d="m42 77-22-28 25 7-8-23 23 17 23-33 12 29 24-15-5 22 27 1-27 24" fill={light}/><path d="M44 69q8-32 37-33 30 0 36 33l-8 29-29 15-28-15Z" fill={fur}/><ellipse cx="62" cy="64" rx="15" ry="13" fill={bright}/><ellipse cx="99" cy="64" rx="15" ry="13" fill={bright}/><circle cx="65" cy="63" r="5" fill={ink}/><circle cx="96" cy="63" r="5" fill={ink}/><path d="M54 85q26-12 54 0l-4 20H59Z" fill={dark}/><path d="m60 84 6 10 5-11m12 0 7 11 4-11m7 0 3 10 4-9" fill={bright}/><path d="m80 117 9 10-9 10-9-10Z" fill={gold}/></>;
  const bear=s==='bear',cat=s==='cat',boar=s==='boar',sheep=s==='sheep',wild=s==='beast';
  // A different head silhouette, markings, ears and muzzle for each species.
  return <>
    <path d="M8 144 24 102 50 83 80 90 112 83 138 104 153 144Z" fill={fur}/>
    <path d={bear||sheep?'M44 62Q25 50 37 33l25 10m38 0 24-10q14 15-7 29':boar?'M42 55 28 17 65 43m35 0 32-26-14 41':cat?'M40 61 31 20 66 42m30 0 35-22-9 41':'M40 59 32 9 68 40m25 0 34-31-8 46'} fill={fur}/>
    <path d="M43 59 55 42 81 35 106 42 120 63 114 92 95 124 80 136 61 124 46 94Z" fill={light}/>
    {sheep&&<g fill={bright}><circle cx="51" cy="57" r="15"/><circle cx="67" cy="40" r="17"/><circle cx="90" cy="41" r="17"/><circle cx="109" cy="56" r="15"/></g>}
    {cat&&<path d="m55 49 11 12-19-4m47-8-9 17 22-7m-33-13 7 12 7-12" fill={dark} stroke="none"/>}
    {wild&&<><path d="M62 48 44 18l-16 30 10 13m59-13 18-30 16 30-10 13" fill={gold}/></>}
    <path d="m48 77 16-8 9 11-17 3m47-14 15 8-10 6-17-3" fill={dark}/>
    <circle cx="63" cy="77" r="3.8" fill={gold} stroke="none"/><circle cx="98" cy="77" r="3.8" fill={gold} stroke="none"/>
    {boar?<><ellipse cx="80" cy="101" rx="25" ry="21" fill={fur}/><circle cx="70" cy="99" r="5" fill={dark}/><circle cx="90" cy="99" r="5" fill={dark}/><path d="m53 113-11-22 21 16m44 6 11-22-21 16" fill={bright}/></>:<><path d="m59 89 20-10 22 10 7 18-15 23-26-1-14-22Z" fill={bright}/><path d="m67 92 13-6 13 6-13 11Z" fill={dark}/><path d="M80 102v10m-13 7 13-7 13 7" fill="none"/>{!bear&&!sheep&&<path d="m67 117 4 11 5-8m11 0 5 8 1-11" fill="white"/>}</>}
    {v%2===0&&<path d="m45 98 10 18-9 15m70-33-10 18 9 15" fill="none" stroke={p[1]} strokeWidth="5"/>}
  </>;
}

function Artifact({subject:s,p,v}:{subject:ArtSubject;p:Colors;v:number}){
  const a=p[2],b=p[3],c=p[4];
  if(s==='golem')return <><path d="M12 144 18 101l28-22 13 2 9 15h24l9-15 13-2 28 22 6 43" fill={p[1]}/><path d="m19 105 27-20 12 24-22 24-20-10m125-17-26-21-12 24 21 24 20-10" fill={metal}/><path d="m52 43 18-18h21l17 18 5 37-20 22H68L47 80Z" fill={p[2]}/><path d="m49 58 13-12 17 14-6 18-19-8m56-12-13-12-17 14 6 18 19-8" fill={p[0]}/><path d="m58 58 14 8-15 5m45-13-14 8 15 5" fill={b}/><path d="m69 85 11-3 11 3-11 10Z" fill={p[1]}/><path d="M51 112h58l17 32H35Z" fill={p[4]}/><path d="m80 107 15 18-15 18-15-18Z" fill={a}/><path d="m80 114 9 11-9 11-9-11Z" fill={b}/></>;
  if(s==='totem')return <><path d="m64 136 1-112 31-4 1 116" fill="#80583e"/><path d="M32 25 126 25l-13 24 13 24-13 24 13 23H34l13-23-13-24 13-24Z" fill={c}/><path d="m44 31 36-12 36 12-12 13-24-8-23 8Z" fill={gold}/>{[47,80,108].map((y,i)=><g key={y}><path d={`M51 ${y}l29-8 29 8-9 17H60Z`} fill={i%2?a:p[1]}/><path d={`m62 ${y+3} 10 3m16 0 10-3`} stroke={b} strokeWidth="4"/></g>)}<path d="m80 4 13 13-13 15-13-15Z" fill={b}/></>;
  if(s==='book')return <><path d="M16 39Q50 28 80 48q31-20 64-9v85q-31-12-64 9-32-21-64-9Z" fill={c}/><path d="M22 34q28-7 58 11 29-19 58-11v83q-28-8-58 11-30-19-58-11Z" fill="#ead8ae"/><path d="M80 45v83" stroke="#a77b44" strokeWidth="3"/><path d="m36 58 27 7m-27 10 24 6m-24 11 27 5m34-31 28-7m-27 22 23-5m-24 21 28-7" stroke="#8c7051" strokeWidth="2"/><circle cx="80" cy="76" r="20" fill={p[1]} stroke={gold}/><path d="m80 56 15 20-15 20-15-20Z" fill={b}/><Spark x={80} y={76} r={8} color={a}/></>;
  if(s==='coin')return <><ellipse cx="81" cy="114" rx="48" ry="14" fill={p[0]} opacity=".6"/><circle cx="80" cy="71" r="49" fill="#9c642d"/><circle cx="76" cy="66" r="47" fill={gold}/><circle cx="76" cy="66" r="37" fill="#d09b44" stroke="#f7dd94" strokeWidth="4"/><path d="m76 38 10 19 21 4-15 15 3 22-19-10-19 10 4-22-16-15 21-4Z" fill="#f7d878"/><path d="M43 49 39 66m67 14 5-14" stroke="#fff0b0" strokeWidth="3"/><Spark x={119} y={25} r={10} color={b}/></>;
  if(s==='shield')return <><path d="M29 35Q80 8 131 35v45q-4 40-51 62Q33 120 29 80Z" fill={gold}/><path d="M38 41q42-23 84 0v37q-3 35-42 52Q41 113 38 78Z" fill={p[1]}/><path d="M80 29v102M39 75h83" stroke={metal} strokeWidth="8"/><path d="m80 46 16 29-16 29-16-29Z" fill={b}/><circle cx="80" cy="75" r="7" fill={a}/></>;
  if(s==='trap')return <><path d="M17 113 42 68l37 23 37-23 28 45-21 19-43-23-46 23Z" fill={c}/><path d="m22 109 16-25 12 14 12-9 18 16 16-16 12 9 15-14 15 25-18 12-40-18-40 18Z" fill={a}/><path d="M46 62 80 28l35 34" stroke={gold} fill="none" strokeWidth="6"/><path d="m80 36 14 28-14 28-14-28Z" fill={b}/><path d="M20 124 140 124" stroke={p[3]} strokeWidth="4"/></>;
  const axe=s==='axe',hammer=s==='hammer',bow=s==='bow',arrow=s==='arrow',dagger=s==='dagger';
  if(bow||arrow)return <><g transform={`rotate(${v%2?26:-26} 80 72)`}><path d="M53 12q75 59 0 121" fill="none" stroke={gold} strokeWidth="10"/><path d="M53 12 53 133" fill="none" stroke={b} strokeWidth="2"/><path d="M25 73h111" fill="none" stroke="#d9cbb1" strokeWidth="6"/><path d="m136 73-26-15 5 15-5 15Z" fill={metal}/><path d="m25 73-12-12 3 12-3 12Z" fill={a}/></g><path d="M21 120 128 20" stroke={a} strokeWidth="3" fill="none" opacity=".7"/></>;
  return <g transform={`rotate(${v%2?38:-38} 80 75)`}>
    <path d="M73 54h14v81l-7 6-7-6Z" fill="#825739"/><path d="M74 96h12m-12 8h12m-12 8h12m-12 8h12" stroke={gold} strokeWidth="3"/>
    {axe?<><path d="M78 23 27 12 10 30 10 60 26 75 66 59 78 62Z" fill={metal}/><path d="M18 25 28 18 27 68 17 58Z" fill={b}/><path d="m79 23 47-10 16 17-1 29-16 16-34-16-12 4Z" fill={metal}/><path d="m132 26-8-7 0 48 9-8Z" fill={b}/></>:hammer?<><path d="M38 19h84l10 16v38l-10 14H38L28 73V35Z" fill={metal}/><path d="M45 27h70v52H45Z" fill={p[1]}/><path d="m80 37 13 16-13 16-13-16Z" fill={b}/><path d="M33 35v38M127 35v38" stroke={b} strokeWidth="5"/></>:<><path d={dagger?'M68 91 68 43 80 20 92 43 92 91Z':'M65 91 65 25 80 6 95 25 95 91Z'} fill={metal}/><path d="M80 21v67" stroke={b} strokeWidth="4"/><path d="M53 88h54v10H53Z" fill={gold}/><circle cx="80" cy="92" r="5" fill={p[2]}/></>}
    <path d="m74 132 6-5 6 5v9H74Z" fill={gold}/>
  </g>;
}

function Magic({subject:s,p,v}:{subject:ArtSubject;p:Colors;v:number}){
  const a=p[2],b=p[3],c=p[4];
  const ring=<g fill="none" stroke={a} opacity=".72"><circle cx="80" cy="72" r="55" strokeWidth="2"/><circle cx="80" cy="72" r="48" strokeDasharray="6 9"/><path d="m80 17 49 84H31Z" strokeWidth="1.5"/></g>;
  if(s==='undead')return <><path d="M9 144 20 107 48 82h64l28 25 11 37Z" fill={c}/><path d="M40 72q-5-40 40-45t40 45l-9 26-18 8v23H67v-23l-18-8Z" fill="#b8c4a8"/><path d="M47 63q15-14 27 1l-8 21H51Zm66 0q-15-14-27 1l8 21h15Z" fill={ink}/><circle cx="62" cy="71" r="4.6" fill={a}/><circle cx="98" cy="71" r="4.6" fill={a}/><path d="m80 82 10 15H70Z" fill={ink}/><path d="M65 108h30m-22-5v22m8-22v23m8-23v22" stroke={ink} fill="none" strokeWidth="3"/><path d="m16 119 30-26-3 34-19 17m120-25-30-26 3 34 19 17" fill={a}/><path d="m67 34 9 9-3 10m36 49-11-10" stroke={p[1]} fill="none"/></>;
  if(s==='portal')return <><path d="M25 139V59q5-44 55-49 50 5 55 49v80" fill={c}/><path d="M38 139V61q5-35 42-39 37 4 42 39v78Z" fill={p[0]} stroke={a} strokeWidth="4"/><ellipse cx="80" cy="84" rx="33" ry="54" fill={p[1]}/><path d="M80 35q-34 22 0 49t0 51Q114 110 80 84t0-49Z" fill={a}/><path d="M80 43q20 17 0 40t0 45" stroke={b} strokeWidth="4" fill="none"/><Spark x={62} y={59} r={7} color={b}/><Spark x={97} y={105} r={9} color={b}/><path d="M25 65h12m86 0h12M25 87h12m86 0h12M25 109h12m86 0h12" stroke={gold}/></>;
  if(s==='fireball')return <><path d="M6 17 63 45 59 20 111 40 146 82 140 115 100 136 63 111 50 81 19 54 38 57Z" fill={c}/><path d="M34 39 91 66 86 43 130 69 150 101 134 126 99 136 65 107 59 74Z" fill={a}/><circle cx="113" cy="101" r="30" fill={b}/><circle cx="112" cy="101" r="17" fill="#fff4ca" stroke="none"/><path d="M11 79 53 97m16-72 24 22" stroke={a} strokeWidth="5"/><Spark x={135} y={35} r={9} color={b}/><Spark x={36} y={124} r={7} color={b}/></>;
  if(s==='plant'||s==='nature')return <>{ring}<path d="M57 143 67 76l-14-18 4-16 21 26 14-45 8-3 3 45 24-16 8 9-33 32 5 53Z" fill="#785137"/><path d="M79 136 80 77 66 61m15 16 18-35m-19 60 34-34" fill="none" stroke={a} strokeWidth="4"/>{[[40,46],[68,32],[86,20],[119,40],[130,66],[39,85]].map(([x,y],i)=><path key={i} d={`M${x} ${y}q-26-32 10-21 25 8-10 21Z`} fill={i%2?a:b}/>)}</>;
  if(s==='spirit')return <>{ring}<path d="M24 141q43-27 21-61t35-64q39 25 36 52-5 31 20 72l-26-13-18 14-15-14-22 14-13-15Z" fill={c} opacity=".77"/><path d="M52 115q22-23 7-48t20-40q28 15 22 44t15 44l-37-13Z" fill={a}/><path d="M62 66q7-12 14-1m8 0q7-11 15 0" stroke={b} strokeWidth="5" fill="none"/><path d="m75 82 5-5 5 5" fill="none" stroke={b}/><Spark x={33} y={32} r={9} color={b}/><Spark x={132} y={53} r={8} color={b}/></>;
  if(s==='slime')return <><path d="M10 136q5-20 23-31t11-33q-5-21 16-36 40-27 62 17 10 23 2 43 29 3 26 40Z" fill={c}/><path d="M37 125q23-15 19-35-3-23 15-40 23-17 34 5 12 27-1 40l22 22Z" fill={a}/><circle cx="69" cy="70" r="11" fill={b}/><circle cx="100" cy="70" r="9" fill={b}/><circle cx="72" cy="70" r="4" fill={ink}/><circle cx="98" cy="70" r="4" fill={ink}/><path d="M69 93q14 8 29 0L91 107H76Z" fill={ink}/><circle cx="32" cy="114" r="9" fill={a}/><circle cx="124" cy="25" r="6" fill={b}/></>;
  if(s==='fire')return <><path d="M19 126q-9-40 18-75l15 26 7-47L81 4l5 54 16-18 10 34 25-19q29 50-7 74Z" fill="#a74434"/><path d="M35 125q-1-23 25-56l6 26L85 36l11 45 25-14q23 36-12 63Z" fill="#ef9443"/><path d="M58 132q-15-20 11-43l12 15 13-26q25 28 0 51Z" fill="#fff0aa"/><Spark x={129} y={32} r={8} color="#f7d369"/><Spark x={22} y={38} r={6} color="#ffeab1"/></>;
  if(s==='ice')return <>{ring}<path d="M30 126 49 74 66 112 80 11 99 85 125 48 136 132Z" fill={c}/><path d="m80 10 20 78-20 46-21-46Z" fill={a}/><path d="m80 10 0 124-21-46Z" fill={b}/><path d="m30 126 19-52 8 57m79 1-11-84-10 82" fill={a}/><path d="M80 22v42M66 43l28 0M71 31l18 23m0-23L71 54" stroke="white" strokeWidth="2" fill="none"/></>;
  if(s==='lightning')return <>{ring}<path d="M11 45 40 30 72 39 90 14l31 21 34 10" fill={p[0]}/><path d="m85 7-55 65h45L57 138l72-81H85l22-50Z" fill={a} stroke={b} strokeWidth="3.5"/><path d="m85 11-46 55 43-1-8 32 40-34H79Z" fill={b} stroke="none"/><path d="M10 90 30 71 13 63m127 39-17-25 26-16" stroke={b} strokeWidth="3" fill="none"/></>;
  if(s==='holy')return <>{ring}<g fill={b} stroke="none" opacity=".74">{Array.from({length:8},(_,i)=><path key={i} d="m80 70-9-54h18Z" transform={`rotate(${i*45} 80 72)`}/>)}</g><circle cx="80" cy="72" r="33" fill={a} stroke={gold}/><path d="m80 34 9 28 29 10-29 9-9 29-9-29-29-9 29-10Z" fill={b}/><circle cx="80" cy="72" r="8" fill="#fff7d7" stroke="none"/></>;
  if(s==='shadow')return <>{ring}<circle cx="80" cy="73" r="47" fill={p[0]}/><path d="M10 45q56 16 70-24 47 13 53 53-25-16-40 4 8 25 54 41-42 30-77-6-33-32-29-60Z" fill={c}/><path d="M29 53q42 3 58-19 22 16 27 39-37-14-37 18 0 18 21 32-51-7-46-43Z" fill={a}/><path d="M72 67q12-14 25 0l-10 18-13-6Z" fill={p[0]}/><Spark x={85} y={72} r={9} color={b}/><Spark x={24} y={24} r={5} color={b}/><Spark x={136} y={100} r={6} color={b}/></>;
  if(s==='eye')return <>{ring}<path d="M12 82q68-74 136 0Q80 139 12 82Z" fill={c}/><path d="M25 81q56-49 110 0-55 39-110 0Z" fill={b}/><circle cx="80" cy="80" r="22" fill={a}/><path d="m80 60 8 20-8 20-8-20Z" fill={p[0]}/><path d="M12 28q28 20 17 42m119-42q-28 21-17 41" fill="none" stroke={a} strokeWidth="6"/><Spark x={80} y={29} r={10} color={b}/></>;
  if(s==='storm')return <>{ring}<path d="M15 57q37-25 65 0T145 52M18 80q34-27 63-3t60-4M31 102q26-23 52-2t48 0" stroke={a} strokeWidth="11" fill="none"/><path d="M15 57q37-25 65 0T145 52M18 80q34-27 63-3t60-4M31 102q26-23 52-2t48 0" stroke={b} strokeWidth="3" fill="none"/><Spark x={80} y={29} r={8} color={b}/></>;
  if(s==='blood')return <>{ring}<path d="M80 16q-9 24-34 52-25 40 16 64 18 9 36 0 41-25 16-65-26-28-34-51Z" fill="#b75045"/><path d="M80 42 58 79q-16 28 9 40 26 12 40-17Z" fill="#f1a66d"/><path d="m79 58 15 21-15 21-15-21Z" fill="#ffe0a8"/><path d="m34 25 10 14-10 13-10-13m97-14 10 14-10 13-10-13" fill={b}/></>;
  // Arcane: a faceted hovering gem and a ring of runes.
  return <>{ring}<path d="m80 18 34 54-34 54-34-54Z" fill={a}/><path d="m80 18 0 108-34-54Z" fill={b}/><path d="m80 44 18 28-18 29-18-29Z" fill={c}/><Spark x={80} y={72} r={12} color={b}/>{[0,1,2,3,4,5].map(i=><Spark key={i} x={80+Math.cos(i*Math.PI/3+v*.05)*53} y={72+Math.sin(i*Math.PI/3+v*.05)*53} r={5} color={b}/>)}</>;
}

function PaintedArt({recipe,asset}:{recipe:ArtRecipe;asset:PaintedAsset}){
  return <span className="original-art" data-art-subject={recipe.subject} data-art-seed={recipe.seed} data-art-asset={asset} aria-hidden="true"><span className={`painted-art art-${asset}`}/></span>;
}
// Vector art remains available as a project-owned fallback and regression fixture.
export function LocalVectorCardArt({card}:{card:Card}){return <ArtFrame recipe={cardArtRecipe(card)}/>;}
export function LocalVectorHeroArt({heroClass}:{heroClass:HeroClass}){return <ArtFrame recipe={heroArtRecipe(heroClass)}/>;}
export function LocalCardArt({card}:{card:Card}){const recipe=cardArtRecipe(card);return <PaintedArt recipe={recipe} asset={paintedCardAsset(card,recipe)}/>;}
export function LocalHeroArt({heroClass,heroForm}:{heroClass:HeroClass;heroForm?:'jaraxxus'}){return <PaintedArt recipe={heroArtRecipe(heroClass)} asset={heroForm==='jaraxxus'?'legend-lord-jaraxxus':paintedHeroAsset(heroClass)}/>;}
export function LocalPowerArt({heroClass,shadowformLevel,heroForm}:{heroClass:HeroClass;shadowformLevel?:1|2;heroForm?:'jaraxxus'}){return <PaintedArt recipe={powerArtRecipe(heroClass)} asset={heroForm==='jaraxxus'?'legend-jaraxxus-infernal':shadowformLevel?'epic-shadowform':paintedPowerAsset(heroClass)}/>;}

/** One uniform back for every hidden card. The emblem deliberately uses a
 * compass and diamond rather than the original game's card-back mark. */
export function LocalCardBack(){
  return <svg className="local-card-back-art" viewBox="0 0 80 112" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="78" height="110" rx="8" fill="#342b28" stroke="#a97b43" strokeWidth="2"/>
    <rect x="5" y="5" width="70" height="102" rx="6" fill="#224a61" stroke="#e1b86a" strokeWidth="2"/>
    <path d="M40 7 73 56 40 105 7 56Z" fill="#35657b" stroke="#a5824e" strokeWidth="1.6"/>
    <path d="M12 13h19L12 39Zm56 0H49l19 26ZM12 99h19L12 73Zm56 0H49l19-26Z" fill="#ba9459" stroke="#674e35"/>
    <path d="M15 16 24 16 15 29m50-13h-9l9 13M15 96h9l-9-13m50 13h-9l9-13" stroke="#f2da9f" strokeWidth="1.9" fill="none"/>
    <circle cx="40" cy="56" r="23" fill="#24384b" stroke="#e0bb78" strokeWidth="3"/>
    <circle cx="40" cy="56" r="17" fill="#39677e" stroke="#9fbec0" strokeWidth="1.4"/>
    <path d="m40 34 5 15 17 7-17 6-5 16-6-16-16-6 16-7Z" fill="#ecd292" stroke="#654b36" strokeWidth="1"/>
    <path d="m40 42 8 14-8 14-8-14Z" fill="#55b4d7" stroke="#f7dfa8" strokeWidth="2"/>
    <circle cx="40" cy="56" r="3" fill="#e8fcff"/>
  </svg>;
}
