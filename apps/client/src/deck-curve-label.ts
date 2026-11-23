/** Screen-reader summary for the same eleven mana buckets shown in the deck editor. */
export function deckManaCurveLabel(curve: readonly number[]): string {
  const buckets = Array.from({length: 11}, (_, cost) => {
    const count = Number.isFinite(curve[cost]) ? Math.max(0, Math.trunc(curve[cost])) : 0;
    return {cost, count};
  });
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const occupied = buckets.filter(bucket => bucket.count > 0)
    .map(bucket => `${bucket.cost === 10 ? '10마나 이상' : `${bucket.cost}마나`} ${bucket.count}장`);
  return `덱 마나 분포, 총 ${total}장. ${occupied.length ? occupied.join(', ') : '카드 없음'}`;
}
