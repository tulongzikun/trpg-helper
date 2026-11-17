const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hitProbability, averageDamageOf, expectedDamage, hitChanceLabel } = require('../apps/web/src/combatProbability.ts');

test('正常检定的命中率按 d20 面数统计', () => {
  assert.equal(hitProbability(5, 15), 0.55);
  assert.equal(hitProbability(0, 10), 0.55);
});

test('天然 20 必中、天然 1 必失', () => {
  assert.equal(hitProbability(100, 20), 0.95);
  assert.equal(hitProbability(-100, 10), 0.05);
});

test('优势与劣势按平方折算', () => {
  assert.equal(hitProbability(5, 15, 'advantage').toFixed(4), '0.7975');
  assert.equal(hitProbability(5, 15, 'disadvantage').toFixed(4), '0.3025');
});

test('骰式期望值与期望伤害', () => {
  assert.equal(averageDamageOf('2d6+3'), 10);
  assert.equal(averageDamageOf('1d8'), 4.5);
  assert.equal(averageDamageOf('不是骰式'), 0);
  assert.equal(expectedDamage(5, 15, 'normal', '2d6+3'), 5.5);
  assert.equal(expectedDamage(5, 15, 'advantage', '2d6+3'), 8);
});

test('命中率文案带优势／劣势后缀', () => {
  assert.equal(hitChanceLabel(5, 15, 'normal'), '55%');
  assert.equal(hitChanceLabel(5, 15, 'advantage'), '80%（优势）');
  assert.equal(hitChanceLabel(5, 15, 'disadvantage'), '30%（劣势）');
});
