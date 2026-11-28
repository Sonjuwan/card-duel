import type {AccountProfile, GrowthView, RewardPath} from './account-protocol.ts';

export const ORIGINAL_REWARD_PATH = 'original';
export const rewardPathId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value) && value !== 'constructor';

export function rewardPaths(growth: GrowthView): readonly RewardPath[] {
  return growth.rewardPaths ?? [{
    id: ORIGINAL_REWARD_PATH,
    name: '오리지널 보상의 길',
    cardIds: [...growth.starterIds, ...growth.unlocks.map(card => card.cardId)],
    unlocks: growth.unlocks,
    afterCompletion: 'accumulate'
  }];
}

export function activeRewardPath(profile: AccountProfile, growth: GrowthView) {
  const paths = rewardPaths(growth);
  const path = paths.find(item => item.id === profile.rewardRoad?.selectedPathId) ?? paths[0];
  const xp = profile.rewardRoad?.paths[path.id]?.xp ?? (path.id === ORIGINAL_REWARD_PATH ? profile.xp : 0);
  return {path, xp};
}

export function syncRewardRoad(profile: AccountProfile, growth: GrowthView): AccountProfile {
  const paths = rewardPaths(growth);
  const owned = new Set([...profile.ownedCards, ...growth.starterIds]);
  const progress = {...profile.rewardRoad?.paths};
  for (const path of paths) {
    const xp = progress[path.id]?.xp ?? (path.id === ORIGINAL_REWARD_PATH && !profile.rewardRoad ? profile.xp : 0);
    for (const card of path.unlocks) {
      if (card.xp > xp) break;
      owned.add(card.cardId);
    }
    progress[path.id] = {xp, complete: path.unlocks.every(card => owned.has(card.cardId))};
  }
  return {...profile, ownedCards:[...owned].sort(), rewardRoad:{
    selectedPathId:activeRewardPath(profile,growth).path.id, paths:progress
  }};
}

export function selectRewardPath(profile: AccountProfile, growth: GrowthView, id: string): AccountProfile {
  if (!rewardPaths(growth).some(path => path.id === id)) throw Error('사용할 수 없는 보상의 길입니다.');
  const current = syncRewardRoad(profile,growth);
  return {...current,rewardRoad:{...current.rewardRoad!,selectedPathId:id}};
}

export function creditRewardPath(profile: AccountProfile, growth: GrowthView, amount: number): AccountProfile {
  const {path,xp} = activeRewardPath(profile,growth);
  const progress = profile.rewardRoad!.paths[path.id];
  const limit = path.unlocks.at(-1)?.xp ?? 0;
  const nextXp = path.afterCompletion === 'cap'
    ? progress.complete ? xp : Math.max(xp, Math.min(xp + amount, limit))
    : xp + amount;
  return syncRewardRoad({...profile,rewardRoad:{
    ...profile.rewardRoad!,paths:{...profile.rewardRoad!.paths,[path.id]:{...progress,xp:nextXp}}
  }},growth);
}
