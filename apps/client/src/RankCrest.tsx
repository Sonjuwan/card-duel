import {useId} from 'react';
import type {RankInfo} from '../../../packages/account-protocol.ts';

const roman=['','I','II','III','IV','V'];
const crests=[
  {shape:'M28 25 60 14 92 25V60Q88 85 60 102 32 85 28 60Z',light:'#efa46d',dark:'#703d2c'},
  {shape:'M18 42 38 20 60 10 82 20 102 42 94 75 60 104 26 75Z',light:'#e1e6f6',dark:'#435777'},
  {shape:'M20 32 39 18 60 25 81 18 100 32 92 75 60 101 28 75Z',light:'#fff1a5',dark:'#976026'},
  {shape:'M60 7 95 29 108 60 90 88 60 105 30 88 12 60 25 29Z',light:'#bcffed',dark:'#23576a'},
  {shape:'M60 6 91 22 105 49 95 80 60 106 25 80 15 49 29 22Z',light:'#cfeaff',dark:'#22316a'},
];
export function rankTitle(rank:RankInfo){return rank.league+' '+roman[rank.division];}
export function RankCrest({rank}:{rank:RankInfo}){
  const id=useId();
  const level=Math.min(4,Math.max(0,Math.floor((rank.rank-1)/5)));
  const {shape,light,dark}=crests[level];
  return <svg className="rank-crest" viewBox="0 0 120 112" role="img" aria-label={rankTitle(rank)}>
    <defs><linearGradient id={id} x2=".72" y2="1"><stop stopColor={light}/><stop offset="1" stopColor={dark}/></linearGradient></defs>
    {level>=2&&<path d="M13 17 28 30 24 22 46 42H74l22-20-4 8 15-13-4 36-18 17H35L17 53Z" fill={dark} stroke={light} strokeWidth="2"/>}
    <path d={shape} fill={`url(#${id})`} stroke={light} strokeWidth="3"/>
    <path d={shape} transform="translate(8 8) scale(.866)" fill={dark} fillOpacity=".8" stroke={light} strokeOpacity=".72"/>
    {level>=3&&<path d="M60 16 71 31 60 42 49 31Z M60 83 68 92 60 103 52 92Z" fill={light} stroke={dark}/>}
    {level===4&&<path d="M25 49 32 54 25 62 19 54Z M95 49 102 54 95 62 89 54Z" fill="#8bd8ff" stroke={light}/>}
    <text x="60" y="70" textAnchor="middle" fill="#fff8df" fontFamily="Georgia, serif" fontSize="26" fontWeight="bold">{roman[rank.division]}</text>
  </svg>;
}
