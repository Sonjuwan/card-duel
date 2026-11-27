import { readFileSync } from 'node:fs';
import { CONTROL_INCUMBENT, CONTROL_PROFILES } from './control-calibration.ts';
import { confirmationArmCount, confirmationSignature, loadControlEvidence, parseControlRows } from './control-evidence.ts';
import { RELEASE_GROUPS } from './integrated-ai-validation.ts';

export function readControlConfirmation(checkpointPath: string, reportPath: string, catalogVersion?: string) {
  const source = loadControlEvidence(checkpointPath, catalogVersion);
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const saved = report?.signature;
  const profile = CONTROL_PROFILES.find(profile =>
    profile.policy === saved?.selected?.policy && profile.strength === saved?.selected?.strength);
  if (!profile || profile === CONTROL_PROFILES[CONTROL_INCUMBENT] ||
      typeof saved.developmentHash !== 'string' || !/^[0-9a-f]{64}$/.test(saved.developmentHash)) {
    throw new Error('The confirmation report has an invalid frozen candidate');
  }
  const signature = confirmationSignature(source, profile, saved.developmentHash);
  const rows = parseControlRows(report, reportPath, signature, RELEASE_GROUPS, confirmationArmCount);
  if (rows.length !== RELEASE_GROUPS) throw new Error('The confirmation report is incomplete');
  return { ...source, profile, signature, rows };
}
