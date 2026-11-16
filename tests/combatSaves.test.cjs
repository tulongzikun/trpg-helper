const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, savingThrow, areaSave, toggleCondition } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };
const character = (overrides = {}) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: { name: '艾拉', species: '人类', characterClass: '战士', level: 5, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', ...overrides },
});

function setup({ monsters = 1, withHero = false } = {}) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '测试战斗', side: '敌方', count: monsters }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const store = withHero ? addCharacter({ version: 1, battles: [base] }, character(), { battleId: base.id, side: '友方' }, ids()).store : { version: 1, battles: [base] };
  const battle = store.battles[0];
  const started = startCombat(battle, {});
  return {
    battle: started,
    monsters: started.actors.filter(actor => !actor.characterSnapshot).map(actor => actor.id),
    hero: started.actors.find(actor => actor.characterSnapshot)?.id,
  };
}

test('豁免按 d20 + 加值与 DC 比较，并写入战斗日志', () => {
  const { battle, hero } = setup({ withHero: true });
  const { battle: resolved, outcome } = savingThrow(battle, { actorId: hero, ability: 'dex', dc: 15, bonus: 3 }, { random: sequence(0.7), makeId: ids() });
  assert.equal(outcome.natural, 15);
  assert.equal(outcome.total, 18);
  assert.equal(outcome.success, true);
  assert.match(resolved.combat.log.at(-1).text, /敏捷豁免成功/);
});

test('自然 20 必定成功，自然 1 必定失败', () => {
  const { battle, hero } = setup({ withHero: true });
  const lucky = savingThrow(battle, { actorId: hero, ability: 'wis', dc: 30, bonus: 0 }, { random: sequence(0.99), makeId: ids() }).outcome;
  assert.equal(lucky.natural, 20);
  assert.equal(lucky.success, true);
  const unlucky = savingThrow(battle, { actorId: hero, ability: 'wis', dc: 1, bonus: 20 }, { random: sequence(0), makeId: ids() }).outcome;
  assert.equal(unlucky.natural, 1);
  assert.equal(unlucky.success, false);
});

test('束缚让敏捷豁免处于劣势，取两次 d20 中较低者', () => {
  const { battle, hero } = setup({ withHero: true });
  const bound = toggleCondition(battle, hero, '束缚');
  const { outcome } = savingThrow(bound, { actorId: hero, ability: 'dex', dc: 12 }, { random: sequence(0.9, 0.1), makeId: ids() });
  assert.equal(outcome.mode, 'disadvantage');
  assert.equal(outcome.natural, 3);
  assert.equal(outcome.success, false);
});

test('麻痹、昏迷或石化的单位力量与敏捷豁免自动失败，其他豁免照常', () => {
  const { battle, hero } = setup({ withHero: true });
  const paralyzed = toggleCondition(battle, hero, '麻痹');
  const dex = savingThrow(paralyzed, { actorId: hero, ability: 'dex', dc: 5, bonus: 10 }, { random: sequence(0.9), makeId: ids() }).outcome;
  assert.equal(dex.automaticFailure, true);
  assert.equal(dex.success, false);
  assert.equal(dex.natural, 0);
  assert.match(dex.notes.join('；'), /自动失败/);
  const wis = savingThrow(paralyzed, { actorId: hero, ability: 'wis', dc: 10, bonus: 5 }, { random: sequence(0.7), makeId: ids() }).outcome;
  assert.equal(wis.automaticFailure, false);
  assert.equal(wis.success, true);
});

test('范围效果对每个目标分别掷豁免，成功时伤害减半', () => {
  const { battle, monsters } = setup({ monsters: 2 });
  const { battle: resolved, results } = areaSave(battle, {
    targetIds: monsters, ability: 'dex', dc: 12, damageExpression: '2d6', damageType: '火焰',
  }, { random: sequence(0.5, 0.5, 0.9, 0.1), makeId: ids() });
  assert.equal(results.length, 2);
  assert.equal(results[0].save.success, true);
  assert.equal(results[0].damage, 4, '2d6 各掷出 4 共 8 点，豁免成功减半为 4');
  assert.equal(results[1].save.success, false);
  assert.equal(results[1].damage, 8);
  const log = resolved.combat.log.map(item => item.text).join('\n');
  assert.match(log, /范围效果结算：2 个目标，1 个豁免成功/);
});

test('关闭减半时豁免成功不承受伤害，豁免失败承受全额', () => {
  const { battle, monsters } = setup({ monsters: 2 });
  const { results } = areaSave(battle, {
    targetIds: monsters, ability: 'con', dc: 10, damageExpression: '1d6', damageType: '毒素', halfOnSuccess: false,
  }, { random: sequence(0.5, 0.6, 0.1), makeId: ids() });
  assert.equal(results[0].save.success, true);
  assert.equal(results[0].damage, 0);
  assert.equal(results[1].save.success, false);
  assert.equal(results[1].damage, 4);
});

test('范围效果会跳过已经死亡的目标，并拒绝空目标列表', () => {
  const { battle, monsters } = setup({ monsters: 2 });
  const { results } = areaSave(battle, { targetIds: [monsters[0], monsters[0]], ability: 'dex', dc: 12, damageExpression: '1d4', damageType: '火焰' }, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(results.length, 1, '重复目标只结算一次');
  assert.throws(() => areaSave(battle, { targetIds: [], ability: 'dex', dc: 12, damageExpression: '1d4', damageType: '火焰' }), /至少选择一个目标/);
});

test('豁免 DC 与加值会做范围校验', () => {
  const { battle, hero } = setup({ withHero: true });
  assert.throws(() => savingThrow(battle, { actorId: hero, ability: 'dex', dc: 0 }), /豁免 DC/);
  assert.throws(() => savingThrow(battle, { actorId: hero, ability: 'dex', dc: 12, bonus: 99 }), /豁免加值/);
});
