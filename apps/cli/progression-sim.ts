import {loadCatalog} from '../server/server.ts';
import {loadGrowth} from '../server/growth-store.ts';
import {simulateGrowth} from '../../packages/progression-simulation.ts';
import {rankInfo} from '../../packages/progression.ts';

const args=process.argv.slice(2);
if(args.some(arg=>!['--no-quest','--json'].includes(arg))){console.error('사용법: npm run progression:simulate [-- --no-quest --json]');process.exitCode=1;}
else{
  const growth=loadGrowth(loadCatalog()),results=[35,50,70].map(win=>simulateGrowth(growth,win,!args.includes('--no-quest')));
  if(args.includes('--json'))console.log(JSON.stringify(results,null,2));
  else{
    console.log('가상 승률의 성장 판수 예측 (AI/카드 강도 검증 아님 · 모든 경기 보상 대상)');
    console.table(results.map(r=>({승률:r.winPercent+'%',퀘스트:r.followQuest?'수행':'수행 안 함',다이아1:r.rank25At??'5000판 내 미달',전체카드:r.allCardsAt??'5000판 내 미달',최종랭크:rankInfo(r.rank,growth.ranks).name,XP:r.xp,완료퀘스트:r.questCompleted})));
    console.table(growth.ranks.map(rank=>({랭크:rank.name,...Object.fromEntries(results.map(r=>[`승률 ${r.winPercent}%`,r.milestones.find(m=>m.rank===rank.rank)?.games??'미달']))})));
  }
}
