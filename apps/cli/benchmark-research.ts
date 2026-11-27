import { CardStore } from '../server/card-store.ts';
import { aiCatalogHash, aiWeightFingerprint, readChampion, AI_RELEASE_ROOT } from '../server/ai-profile-store.ts';
import { DEFAULT_BOT_WEIGHTS } from '../../packages/engine/src/bot-profile.ts';
import { RESEARCH_STRATEGIES, researchDeck } from '../../packages/engine/src/deck-strategies.ts';
import { HERO_CLASSES } from '../../packages/engine/src/index.ts';
import { playTrainingMatch } from './ai-training-match.ts';
import type { TrainingJob } from './ai-training-match.ts';
import { pairedScoreStats } from './paired-benchmark-stats.ts';
import { initialResearchWeights } from './research-models.ts';

const pairs = Number(process.argv[2] ?? 9);
if (!Number.isSafeInteger(pairs) || pairs < 1 || pairs > 100) {
  throw new Error('상성별 대전 쌍 수는 1~100 사이의 정수여야 합니다.');
}
const baseline = process.argv[3] ?? 'default';
if (baseline !== 'default' && baseline !== 'release') {
  throw new Error('비교 모델은 default 또는 release여야 합니다.');
}
const { version, catalog } = new CardStore().read();
const catalogHash = aiCatalogHash(catalog);
const released = baseline === 'release' ? readChampion(catalogHash, AI_RELEASE_ROOT) : null;
if (baseline === 'release' && !released) {
  throw new Error('활성 카드 버전과 일치하는 배포 챔피언이 없습니다.');
}
const baselineWeights = released?.weights ?? DEFAULT_BOT_WEIGHTS;
const level = 6;
const nodes = 24;
const policyVersion = 2;
console.log(JSON.stringify({ version, catalogHash, pairs, level, nodes, policyVersion,
  baseline, baselineFingerprint: aiWeightFingerprint(baselineWeights),
  method: '초기 상성 가중치와 비교 모델을 동일한 덱, 시드, 선공에서 자리 교대로 비교' }));

for (const own of RESEARCH_STRATEGIES) {
  for (const opponent of RESEARCH_STRATEGIES) {
    const strategies = [own, opponent] as const;
    const initialModels = [initialResearchWeights(own, opponent), initialResearchWeights(opponent, own)];
    const pairScores: [number, number][] = [];
    let truncated = 0;
    const estimates: { actual: typeof own; probabilities: NonNullable<ReturnType<typeof playTrainingMatch>['opponentEstimate']> }[] = [];
    for (let index = 0; index < pairs; index++) {
      const classes: TrainingJob['classes'] = [HERO_CLASSES[index % 9], HERO_CLASSES[(index * 5 + 3) % 9]];
      const fixedDecks: NonNullable<TrainingJob['fixedDecks']> = [
        researchDeck(catalog, classes[0], own), researchDeck(catalog, classes[1], opponent),
      ];
      const scores: [number, number] = [0, 0];
      for (const candidateSeat of [0, 1] as const) {
        const result = playTrainingMatch(catalog, {
          seed: 70381 + index * 3167, firstPlayer: index % 2 === 0 ? 0 : 1, classes, fixedDecks,
          styles: [false, false], candidateSeat,
          candidate: DEFAULT_BOT_WEIGHTS, candidateStrategy: strategies[candidateSeat],
          opponent: baselineWeights, level, nodes, policyVersion,
        });
        scores[candidateSeat] = result.score;
        truncated += Number(result.truncated);
        if (!result.truncated && result.opponentEstimate) {
          estimates.push({ actual: strategies[1 - candidateSeat], probabilities: result.opponentEstimate });
        }
      }
      pairScores.push(scores);
    }
    const metrics = estimates.map(({ actual, probabilities }) => {
      const maximum = Math.max(...Object.values(probabilities));
      const leaders = RESEARCH_STRATEGIES.filter(strategy => probabilities[strategy] === maximum);
      const accuracy = leaders.includes(actual) ? 1 / leaders.length : 0;
      const brier = RESEARCH_STRATEGIES.reduce((sum, strategy) =>
        sum + (probabilities[strategy] - Number(strategy === actual)) ** 2, 0);
      return { accuracy, brier };
    });
    const metricAverage = (key: 'accuracy' | 'brier') => metrics.length ?
      metrics.reduce((sum, metric) => sum + metric[key], 0) / metrics.length : null;
    console.log(JSON.stringify({ own, opponent, truncated, pairScores,
      initialModelFingerprints: initialModels.map(aiWeightFingerprint),
      inference: { samples: metrics.length, accuracy: metricAverage('accuracy'), brier: metricAverage('brier') },
      ...(truncated === 0 ? pairedScoreStats(pairScores) : { pairs, scoreRate: null }) }));
  }
}
