import type { Action, Catalog, PlayerId, PlayerView } from '../../packages/engine/src/index.ts';
import { playTrainingMatch } from './ai-training-match.ts';
import type { TrainingJob } from './ai-training-match.ts';

interface Decision {
  actor: PlayerId;
  action: Action;
  view: PlayerView;
}
const actionKey = (decision: Decision) => JSON.stringify([decision.actor, decision.action]);

function record(catalog: Catalog, job: TrainingJob) {
  const trace: Decision[] = [];
  const result = playTrainingMatch(catalog, job, { observeAction: (view, actor, action) => trace.push({ view, actor, action }) });
  return { result, trace };
}

function describe({ actor, action, view }: Decision) {
  const target = 'target' in action ? action.target : undefined;
  const minionById = (id: string) => [...view.self.board, ...view.opponent.board].find(minion => minion.instanceId === id)?.cardId;
  return {
    actor, action, turn: view.turn, mana: view.self.mana,
    card: action.type === 'playCard' ? view.self.hand.find(card => card.instanceId === action.instanceId)?.cardId : undefined,
    attacker: action.type === 'attack' ? minionById(action.attackerId) : undefined,
    targetCard: target?.kind === 'minion' ? minionById(target.instanceId) : undefined,
    health: [view.self.health + view.self.armor, view.opponent.health + view.opponent.armor],
    board: [view.self.board.map(card => card.cardId), view.opponent.board.map(card => card.cardId)],
  };
}

export function auditControlDecision(catalog: Catalog, incumbent: TrainingJob, candidate: TrainingJob) {
  if (incumbent.seed !== candidate.seed || incumbent.firstPlayer !== candidate.firstPlayer ||
      incumbent.level !== candidate.level || incumbent.nodes !== candidate.nodes ||
      incumbent.candidateSeat !== candidate.candidateSeat ||
      incumbent.opponentPolicyVersion !== candidate.opponentPolicyVersion ||
      incumbent.environmentSeed !== candidate.environmentSeed || incumbent.variantVersion !== candidate.variantVersion ||
      !incumbent.fixedDecks || !candidate.fixedDecks ||
      JSON.stringify(incumbent.researchRows?.opponent ?? incumbent.opponentResearchRow) !==
        JSON.stringify(candidate.researchRows?.opponent ?? candidate.opponentResearchRow) ||
      JSON.stringify(incumbent.opponent) !== JSON.stringify(candidate.opponent) ||
      JSON.stringify(incumbent.fixedDecks) !== JSON.stringify(candidate.fixedDecks)) {
    throw new Error('Decision audit requires a matched fixture');
  }
  const original = record(catalog, incumbent), treatment = record(catalog, candidate);
  const outcomes = { incumbent: original.result, candidate: treatment.result };
  const first = original.trace.findIndex((step, index) =>
    treatment.trace[index] && actionKey(step) !== actionKey(treatment.trace[index]));
  if (first < 0) {
    if (original.trace.length !== treatment.trace.length || original.result.score !== treatment.result.score ||
        original.result.truncated !== treatment.result.truncated) throw new Error('Deterministic fixture outcomes diverged without a different action');
    return { ...outcomes, firstChange: null, intervention: null };
  }
  const originalAction = original.trace[first], candidateAction = treatment.trace[first];
  if (originalAction.actor !== candidateAction.actor || originalAction.actor !== candidate.candidateSeat ||
      JSON.stringify(originalAction.view) !== JSON.stringify(candidateAction.view)) {
    throw new Error('The first changed decision is not on a shared candidate state');
  }

  function intervene(job: TrainingJob, replacement: Action) {
    let applied = false;
    const result = playTrainingMatch(catalog, job, {
      overrideAction(view, actor, move) {
        if (move !== first) return undefined;
        if (actor !== originalAction.actor || JSON.stringify(view) !== JSON.stringify(originalAction.view)) {
          throw new Error('The shared state did not reproduce for the action intervention');
        }
        applied = true;
        return replacement;
      },
    });
    if (!applied) throw new Error('The action intervention was not reached');
    return result;
  }

  return { ...outcomes, firstChange: { move: first + 1, incumbent: describe(originalAction), candidate: describe(candidateAction) },
    intervention: {
      incumbentWithCandidateAction: intervene(incumbent, candidateAction.action),
      candidateWithIncumbentAction: intervene(candidate, originalAction.action),
    } };
}
