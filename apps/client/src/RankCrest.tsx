import {useId} from 'react';
import type {RankInfo} from '../../../packages/account-protocol.ts';

const roman=['','I','II','III','IV','V'];
const crests=[
  {shape:'M28 30 60 18 92 30V60Q88 85 60 103 32 85 28 60Z',light:'#efba86',dark:'#633a2c',gem:'#ee945d'},
  {shape:'M25 33 38 19 60 11 82 19 95 33 89 74 60 102 31 74Z',light:'#e0ecf7',dark:'#475975',gem:'#bfedff'},
  {shape:'M25 31 60 19 95 31 89 73 78 88 60 103 42 88 31 73Z',light:'#ffe5a0',dark:'#805220',gem:'#ffc956'},
  {shape:'M60 8 92 25 105 57 91 83 60 104 29 83 15 57 28 25Z',light:'#dbfff4',dark:'#2a586b',gem:'#6ae8db'},
  {shape:'M60 7 93 24 105 50 97 78 60 105 23 78 15 50 27 24Z',light:'#e0efff',dark:'#383369',gem:'#8bddff'},
];
const wings='M38 46 6 25l12 22-11-5 13 19-8-2 19 19 16 4M82 46l32-21-12 22 11-5-13 19 8-2-19 19-16 4';
const crown='m36 36-5-23 16 8 13-16 13 16 16-8-5 23-24 8Z';
const jewelPositions=[[60,87],[43,81],[77,81],[37,73],[83,73]];
export function rankTitle(rank:RankInfo){return rank.league+' '+roman[rank.division];}

export function RankCrest({rank}:{rank:RankInfo}){
  const id=useId(),tier=Math.min(4,Math.max(0,Math.floor((rank.rank-1)/5)));
  const {shape,light,dark,gem}=crests[tier],division=rank.division;
  return <svg className="rank-crest" data-tier={tier} data-division={division} viewBox="0 0 120 112" role="img" aria-label={rankTitle(rank)}>
    <defs>
      <linearGradient id={id} x2=".72" y2="1"><stop stopColor={light}/><stop offset=".48" stopColor={dark}/><stop offset=".7" stopColor={light}/><stop offset="1" stopColor={dark}/></linearGradient>
      <radialGradient id={id+'-stone'}><stop stopColor={gem}/><stop offset=".72" stopColor={dark}/><stop offset="1" stopColor="#16192a"/></radialGradient>
    </defs>
    {(tier===1||tier===4)&&<path d={wings} fill={`url(#${id})`} stroke={light} strokeLinejoin="round"/>}
    <path d={shape} fill={`url(#${id})`} stroke={light} strokeWidth="2.5"/>
    <path d={shape} transform="translate(8.4 7.84) scale(.86)" fill="#141724" stroke={dark} strokeWidth="2"/>
    {tier===2||tier===4?<path d={crown} fill={`url(#${id})`} stroke={light} strokeWidth="1.8" strokeLinejoin="round"/>:null}
    {tier>=3&&<path d="M60 26 88 42 92 68 60 92 28 68 32 42Z" fill={`url(#${id}-stone)`} stroke={gem} strokeWidth={1+tier*.27}/>}
    {tier===4&&<path d="M60 26 46 47 41 67 60 92 79 67 74 47Z M32 42 46 47H74l14-5 M28 68l13-1h38l13 1" fill="none" stroke={light} opacity={division===1?.8:.55}/>}
    {tier<3&&<path d="m60 32 7 8-7 8-7-8Z" fill={gem} stroke={light}/>}
    {jewelPositions.slice(0,6-division).map(([x,y])=><path key={x} data-rank-jewel d={`m${x} ${y-3.5} 3.5 3.5-3.5 3.5-3.5-3.5Z`} fill={gem} stroke={light} strokeWidth=".75"/>)}
    <text x="60" y="72" textAnchor="middle" fill="#fff8e9" stroke="#141724" strokeWidth="2.4" paintOrder="stroke" fontFamily="Georgia, serif" fontSize="34" fontWeight="bold">{division}</text>
  </svg>;
}
