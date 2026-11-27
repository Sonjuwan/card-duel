import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { AI_RELEASE_ROOT, aiCatalogHash, aiWeightFingerprint, readChampion } from '../server/ai-profile-store.ts';
import { CardStore } from '../server/card-store.ts';
import { applyControlProfile, CONTROL_DEVELOPMENT_GROUPS, CONTROL_PROFILES, CONTROL_PROTOCOL, isArmResult,
  pairedArms, summarizeControlDevelopment } from './control-calibration.ts';
import type { ArmResult, ControlProfile } from './control-calibration.ts';
import { evaluateIntegrated, RELEASE_GROUPS, RELEASE_SUITE, snapshotIntegrated } from './integrated-ai-validation.ts';
import { parseMatchupState } from './matchup-checkpoint.ts';
import { MATCHUPS } from './matchup-evolution.ts';
import { passesResearchTactics, TACTICAL_CATALOG } from './research-tactics.ts';

export function loadControlEvidence(checkpoint: string, catalogVersion?: string) {
  const store = new CardStore(), { catalog, version } = store.read(catalogVersion), hash = aiCatalogHash(catalog);
  const state = parseMatchupState(JSON.parse(readFileSync(checkpoint, 'utf8')), hash);
  if (state.models.some(model => (model.pending?.stage ?? 0) > 0)) throw new Error('Finish active candidate validation before calibrating');
  const baseline = readChampion(hash, AI_RELEASE_ROOT);
  if (!baseline) throw new Error('No shipped baseline for this card catalog');
  const { matrix, fingerprint } = snapshotIntegrated(state), tactical = store.read(TACTICAL_CATALOG).catalog;
  const input = { protocol: CONTROL_PROTOCOL, catalogHash: hash, version, trainingSeed: state.seed, matrix: fingerprint,
    baseline: aiWeightFingerprint(baseline.weights), tacticalCatalog: aiCatalogHash(tactical), suite: RELEASE_SUITE };
  return { catalog, version, hash, state, baseline, matrix, tactical, input };
}

type ControlEvidence = ReturnType<typeof loadControlEvidence>;
export const developmentSignature = (source: ControlEvidence) => ({ ...source.input, split: 'control-development',
  groups: CONTROL_DEVELOPMENT_GROUPS, profiles: CONTROL_PROFILES });
export const confirmationSignature = (source: ControlEvidence, selected: ControlProfile, developmentHash: string) => ({
  ...source.input, split: 'control-confirmation', groups: RELEASE_GROUPS, selected, developmentHash,
});

export const developmentArmCount = () => CONTROL_PROFILES.length;
export const confirmationArmCount = (index: number) => MATCHUPS[index % MATCHUPS.length].own === 'control' ? 3 : 2;

export function readControlRows(path: string, signature: object, fullLength: number, armCount: (index: number) => number): ArmResult[][] {
  return parseControlRows(JSON.parse(readFileSync(path, 'utf8')), path, signature, fullLength, armCount);
}

export function parseControlRows(data: { signature?: object; rows?: unknown[] } | null, path: string,
  signature: object, fullLength: number, armCount: (index: number) => number): ArmResult[][] {
  if (!data || JSON.stringify(data.signature) !== JSON.stringify(signature) || !Array.isArray(data.rows) ||
      data.rows.length > fullLength || data.rows.some((row: unknown, index: number) =>
        !Array.isArray(row) || row.length !== armCount(index) || !row.every(isArmResult))) {
    throw new Error('Incompatible calibration report: ' + path);
  }
  return data.rows as ArmResult[][];
}

export function developControlTactics({ baseline, matrix, tactical }: ControlEvidence) {
  return CONTROL_PROFILES.map(profile => {
    const row = applyControlProfile(baseline.weights, matrix.control, profile).researchRows?.candidate;
    return passesResearchTactics(tactical, row ?? matrix.control, { policyVersion: profile.policy,
      ...(row ? {} : { fixedWeights: baseline.weights }) });
  });
}

export function readControlDevelopment(path: string, source: ControlEvidence, tactics = developControlTactics(source)) {
  const rows = readControlRows(path, developmentSignature(source), CONTROL_DEVELOPMENT_GROUPS, developmentArmCount);
  const summary = summarizeControlDevelopment(rows, tactics);
  if (!summary.selected) throw new Error('A complete development report with a selected candidate is required');
  const hash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  return { selected: summary.selected, groups: summary.groups, hash };
}

export function confirmControlTactics({ matrix, tactical }: ControlEvidence, selected: ControlProfile, profileTactics: boolean[]) {
  const index = CONTROL_PROFILES.findIndex(profile => profile.policy === selected.policy && profile.strength === selected.strength);
  return { aggro: passesResearchTactics(tactical, matrix.aggro), midrange: passesResearchTactics(tactical, matrix.midrange),
    control: profileTactics[index] === true, 'big-deck': passesResearchTactics(tactical, matrix['big-deck']) };
}

export function evaluateControlEvidence(rows: readonly ArmResult[][], tactics: ReturnType<typeof confirmControlTactics>) {
  const evaluation = evaluateIntegrated(rows.map(([reference, candidate]) => ({
    control: reference.scores, candidate: candidate.scores, truncated: reference.truncated + candidate.truncated,
  })), tactics);
  const controlRows = rows.filter((_, index) => confirmationArmCount(index) === 3);
  return { evaluation, controlVsIncumbent: pairedArms(controlRows, 2, 1) };
}
