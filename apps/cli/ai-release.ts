import {loadCatalog} from '../server/server.ts';
import {aiCatalogHash,exportReleaseChampion,listChampions} from '../server/ai-profile-store.ts';

try{
  const args=process.argv.slice(2);if(args.some(arg=>arg!=='--all'))throw new Error('사용법: npm run ai:release [-- --all]');
  const hashes=args.includes('--all')?listChampions().map(c=>c.catalogHash):[aiCatalogHash(loadCatalog())];
  if(!hashes.length)throw new Error('배포할 로컬 챔피언이 없습니다.');
  for(const hash of hashes){const result=exportReleaseChampion(hash),c=result.champion;console.log(`${hash.slice(0,12)} · ${c.games}게임 · 승격 ${c.promotions}회 · ${result.status}`);}
  console.log('검증된 챔피언만 data/ai-release에 저장했습니다. 원본 학습 데이터와 카드 수치는 변경하지 않았습니다.');
}catch(error){console.error(error instanceof Error?error.message:'AI 배포 모델 저장 실패');process.exitCode=1;}
