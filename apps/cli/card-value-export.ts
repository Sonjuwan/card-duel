import type { buildCardValueReport } from './card-value.ts';

type Report = ReturnType<typeof buildCardValueReport>;
const headers = ['카드 ID', '카드명', '직업', '등급', '마나', '현재 상대 가치', '고정 기준 가치',
  '원시 승점 차이', '원시 95% 구간 하한', '원시 95% 구간 상한', '유효 묶음', '계획 묶음', '손패 관측 경기', '사용 경기', '상태'];
const cells = (row: Report['rows'][number]) => [
  row.id, row.name, row.class, row.rarity, row.cost, row.currentScore, row.fixedScore,
  row.rawDelta, row.raw95?.[0], row.raw95?.[1], row.samples, row.plannedPairs, row.seen, row.played,
  ({ estimated: '추정치', 'baseline-pending': '기본 카드 기준 미완성', 'insufficient-samples': '표본 부족' })[row.status],
] as const;

function csvCell(value: string | number | null | undefined): string {
  if (typeof value === 'number') return String(value);
  if (value == null) return '';
  const safe = /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function cardValueCsv(report: Report): string {
  const columns = ['평가 방식', '카드 버전', '카드 해시', '모델 지문', '평가 지문', '기본 카드 평균 원시값', '고정 기준 원시값'];
  const metadata = [report.method, report.cardVersion, report.catalogHash, report.modelHash, report.protocolHash,
    report.baseline.rawDelta, report.fixedBaseline?.rawDelta];
  const rows = report.rows.map(row => [...metadata, ...cells(row)]);
  return '\uFEFF' + [[...columns, ...headers], ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function escaped(value: string | number | null | undefined) {
  return String(value ?? '—').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
const rounded = (value: string | number | null | undefined) => typeof value === 'number' ? Math.round(value * 10000) / 10000 : value;

export function cardValueHtml(report: Report): string {
  const headerRow = headers.map(label => `<th scope="col">${escaped(label)}</th>`).join('');
  const rows = report.rows.map(row => '<tr>' + cells(row).map(value => '<td>' + escaped(rounded(value)) + '</td>').join('') + '</tr>').join('\n');
  const basis = `기본 카드 유효 표본 ${report.baseline.evaluatedBasicCards} / ${report.baseline.basicCards}종. ` +
    (report.baseline.rawDelta === null ? '현재 상대 점수의 기준을 계산할 표본이 모자랍니다.' :
      `기본 카드 평균 원시 승점 차이 ${rounded(report.baseline.rawDelta)}.`);
  return `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Card Duel 카드 가치 평가</title>
<style>
  body { margin: 2rem; color: #19272a; background: #f9fbfa; font: 15px/1.55 system-ui, sans-serif; }
  p { max-width: 86ch; }
  code { overflow-wrap: anywhere; }
  .table { overflow: auto; }
  table { border-collapse: collapse; text-align: left; font-variant-numeric: tabular-nums; background: white; }
  th, td { padding: .5rem .75rem; border-bottom: 1px solid #d3dedc; white-space: nowrap; }
  th { background: #dcebe8; }
  tr:nth-child(even) { background: #f2f7f6; }
</style>
<h1>카드 가치 평가</h1>
<p>카드 버전 <code>${escaped(report.cardVersion)}</code> · 평가 방식 <code>${escaped(report.method)}</code></p>
<p>기본 카드 전체 평균 100점. 기준보다 원시 승점 차이가 1%p 높으면 1점이 높습니다. ${escaped(basis)}</p>
<p>고정 기준 버전 <code>${escaped(report.fixedBaseline?.version)}</code>. 원시 구간은 네 경기 묶음의 승점 차이에 대한 추정 범위입니다.</p>
<p>카드 해시 <code>${escaped(report.catalogHash)}</code><br>모델 지문 <code>${escaped(report.modelHash)}</code><br>평가 지문 <code>${escaped(report.protocolHash)}</code></p>
<div class="table"><table><thead><tr>${headerRow}</tr></thead><tbody>${rows}</tbody></table></div>
</html>`;
}
