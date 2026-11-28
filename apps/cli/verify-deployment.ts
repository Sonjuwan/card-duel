import {rewardPaths} from '../../packages/reward-road.ts';
import {existsSync} from 'node:fs';
import {publishedReleaseIdentity} from '../server/release-identity.ts';
import {verifyRankedDecks} from '../../packages/progression.ts';
import {auditRankedDecks} from '../../packages/progression-audit.ts';
import {loadCatalog} from '../server/server.ts';
import {loadGrowth} from '../server/growth-store.ts';
import {validatePublicDeployment,verifyCloudStorage} from '../server/deployment-check.ts';
import {AI_RELEASE_ROOT,aiCatalogHash,readChampion,resolveGameChampion} from '../server/ai-profile-store.ts';
import project from '../../package.json' with {type:'json'};

try{
  if(process.argv.slice(2).some(arg=>arg!=='--cloud'))throw new Error('사용법: npm run verify:deployment [-- --cloud]');
  const catalog=loadCatalog(),growth=loadGrowth(catalog),checked=verifyRankedDecks(catalog,growth);
  if(!existsSync(new URL('../../dist/client/index.html',import.meta.url)))throw new Error('먼저 npm run build를 실행하세요.');
  const expected=publishedReleaseIdentity(catalog,growth);
  console.log(`v${project.version}: 랭크 ${growth.ranks.length}단계 · 합법 AI 덱 ${checked}개 · 카드 ${rewardPaths(growth).reduce((total,path)=>total+path.cardIds.length,0)}장 · 성장 버전 ${expected.growthHash.slice(0,12)}`);
  const audit=auditRankedDecks(catalog,growth);
  console.log(`4개 시드 덱 전력 비교 ${audit.checked}개 · 증가 ${audit.increased}/${audit.compared} · 동일 ${audit.unchanged} · 감소 ${audit.decreased} (설정 점수, 실제 승률 아님)`);
  if(audit.decreased||audit.unchanged||growth.ranks.some((rank,i)=>i>0&&rank.intelligence<=growth.ranks[i-1].intelligence))console.warn('랭크별 전력 또는 AI 지능에 동일/하락 단계가 있습니다. 의도한 설정인지 확인하세요.');
  console.log(`승인된 배포: 카드 ${expected.catalogHash.slice(0,12)} · AI 세대 ${expected.aiGeneration} · AI 가중치 ${expected.aiWeightsHash.slice(0,12)}`);
  const modelHash=aiCatalogHash(catalog),model=resolveGameChampion(modelHash),release=readChampion(modelHash,AI_RELEASE_ROOT);
  console.log(model?`현재 AI ${model.source} 챔피언 · ${model.champion.games}게임 · 승격 ${model.champion.promotions}회 · ${modelHash.slice(0,12)}`:'호환 AI 챔피언 없음: 기본 가중치를 사용합니다.');
  if(model?.source==='local'&&(!release||JSON.stringify(model.champion)!==JSON.stringify(release)))console.warn('로컬과 배포 AI 챔피언이 다릅니다. 배포 전 npm run ai:release 를 확인하세요.');
  if(process.argv.includes('--cloud')){const checked=await verifyCloudStorage(validatePublicDeployment(process.env));console.log(`클라우드 스키마 ${checked.schemaVersion}: ${checked.tables}개 테이블, 정산 함수, 실제 서버 역할·쓰기/RLS 우회 권한, 공개 접근 차단 및 RLS 확인(읽기 전용). 실제 가입/대전/메일 테스트는 별도 필요합니다.`);}
  else console.log('로컬 사전 점검 완료. 외부 서버에는 접속하지 않았습니다.');
}catch(error){console.error(error instanceof Error?error.message:'사전 점검 실패');process.exitCode=1;}
