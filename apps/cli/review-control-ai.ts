import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { confirmControlTactics, developControlTactics, evaluateControlEvidence, readControlDevelopment } from './control-evidence.ts';
import { readControlConfirmation } from './read-control-confirmation.ts';

const { values } = parseArgs({ options: {
  checkpoint: { type: 'string' }, development: { type: 'string' }, confirmation: { type: 'string' }, catalog: { type: 'string' },
  'require-eligible': { type: 'boolean' },
} });
if (!values.checkpoint || !values.development || !values.confirmation) {
  throw new Error('Usage: review:control-ai -- --checkpoint FILE --development FILE --confirmation FILE [--require-eligible]');
}
const source = readControlConfirmation(values.checkpoint, values.confirmation, values.catalog);
const profileTactics = developControlTactics(source);
const development = readControlDevelopment(values.development, source, profileTactics);
if (JSON.stringify(development.selected) !== JSON.stringify(source.profile) || development.hash !== source.signature.developmentHash) {
  throw new Error('The frozen confirmation profile does not match the independent development report');
}
const tactics = confirmControlTactics(source, source.profile, profileTactics);
const evidence = evaluateControlEvidence(source.rows, tactics);
const confirmationHash = createHash('sha256').update(JSON.stringify(source.rows)).digest('hex');
console.log(JSON.stringify({ signature: source.signature, confirmationHash, tactics, ...evidence }, null, 2));
if (values['require-eligible'] && !evidence.evaluation.eligible) process.exitCode = 2;
