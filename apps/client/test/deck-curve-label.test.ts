import test from 'node:test';
import assert from 'node:assert/strict';
import { deckManaCurveLabel } from '../src/deck-curve-label.ts';

test('empty deck is explained without reading eleven empty bars', () => {
  assert.equal(deckManaCurveLabel(Array(11).fill(0)), '덱 마나 분포, 총 0장. 카드 없음');
});
test('only occupied mana costs are announced and 10+ is identified', () => {
  assert.equal(deckManaCurveLabel([2,0,3,0,0,0,0,0,0,0,1]), '덱 마나 분포, 총 6장. 0마나 2장, 2마나 3장, 10마나 이상 1장');
});
test('bad and missing counts cannot become NaN in the label', () => {
  assert.equal(deckManaCurveLabel([2, NaN, -3]), '덱 마나 분포, 총 2장. 0마나 2장');
});
