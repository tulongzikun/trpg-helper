const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { addOngoingEffect, damageActor, endConcentration, endTurn, removeOngoingEffect, startCombat, startConcentration, tickTurnStart } = require('../apps/web/src/combat.ts');
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

test('持续效果在回合开始时结算伤害，并写入战斗日志', () => {
  const { battle, monsters } = setup();
  const monster = battle.actors.find(actor => actor.id === monsters[0]);
  const before = monster.currentHp;
  const { battle: applied } = addOngoingEffect(battle, monsters[0], { name: '燃烧', damageExpression: '1d4', damageType: '火焰' }, { makeId: ids() });
  const ticked = tickTurnStart(applied, { random: sequence(0.5), makeId: ids() });
  const after = ticked.actors.find(actor => actor.id === monsters[0]);
  assert.ok(after.currentHp < before);
  assert.match(ticked.combat.log.map(item => item.text).join('\n'), /回合开始：「燃烧」/);
});

test('带豁免的持续效果在回合开始时掷豁免，成功即移除且不受伤害', () => {
  const { battle, monsters } = setup();
  const { battle: applied } = addOngoingEffect(battle, monsters[0], { name: '酸雾', damageExpression: '2d6', damageType: '酸蚀', saveEnds: { ability: 'dex', dc: 10 } }, { makeId: ids() });
  const before = applied.actors.find(actor => actor.id === monsters[0]).currentHp;
  const ticked = tickTurnStart(applied, { random: sequence(0.9), makeId: ids() });
  const after = ticked.actors.find(actor => actor.id === monsters[0]);
  assert.equal(after.currentHp, before);
  assert.equal(after.combat.ongoing.length, 0);
  assert.match(ticked.combat.log.map(item => item.text).join('\n'), /结束「酸雾」/);
});

test('豁免失败时持续效果保留并造成伤害', () => {
  const { battle, monsters } = setup();
  const { battle: applied } = addOngoingEffect(battle, monsters[0], { name: '酸雾', damageExpression: '2d6', damageType: '酸蚀', saveEnds: { ability: 'dex', dc: 18 } }, { makeId: ids() });
  const before = applied.actors.find(actor => actor.id === monsters[0]).currentHp;
  const ticked = tickTurnStart(applied, { random: sequence(0.1, 0.5, 0.5), makeId: ids() });
  const after = ticked.actors.find(actor => actor.id === monsters[0]);
  assert.ok(after.currentHp < before);
  assert.equal(after.combat.ongoing.length, 1);
});

test('endTurn 会为新回合的单位结算持续伤害', () => {
  const { battle, monsters } = setup({ monsters: 2 });
  let current = battle;
  for (const id of monsters) current = addOngoingEffect(current, id, { name: '毒雾', damageExpression: '1d4', damageType: '毒素' }, { makeId: ids() }).battle;
  const next = endTurn(current, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.match(next.combat.log.map(item => item.text).join('\n'), /回合开始：「毒雾」/);
});

test('专注在受到伤害时自动检定，失败即失去专注', () => {
  const { battle, hero } = setup({ withHero: true });
  const focused = startConcentration(battle, hero, '祝福', { makeId: ids() });
  const { battle: damaged } = damageActor(focused, hero, 10, '钝击', { random: sequence(0.0), makeId: ids() });
  const actor = damaged.actors.find(item => item.id === hero);
  assert.equal(actor.combat.concentration, undefined);
  assert.match(damaged.combat.log.at(-1).detail, /专注检定 DC 10/);
  assert.match(damaged.combat.log.at(-1).detail, /失去对「祝福」的专注/);
});

test('专注检定成功时保持专注，DC 随伤害提高', () => {
  const { battle, hero } = setup({ withHero: true });
  const focused = startConcentration(battle, hero, '祝福', { makeId: ids() });
  const { battle: damaged } = damageActor(focused, hero, 30, '钝击', { random: sequence(0.9), makeId: ids() });
  const actor = damaged.actors.find(item => item.id === hero);
  assert.equal(actor.combat.concentration.spell, '祝福');
  assert.match(damaged.combat.log.at(-1).detail, /专注检定 DC 15/);
  assert.match(damaged.combat.log.at(-1).detail, /维持「祝福」/);
});

test('倒地会立刻中断专注，结束专注需要存在专注', () => {
  const { battle, hero } = setup({ withHero: true });
  const focused = startConcentration(battle, hero, '祝福', { makeId: ids() });
  const { battle: damaged } = damageActor(focused, hero, 60, '钝击', { random: sequence(0.9), makeId: ids() });
  const actor = damaged.actors.find(item => item.id === hero);
  assert.equal(actor.combat.status, 'down');
  assert.equal(actor.combat.concentration, undefined);
  assert.throws(() => endConcentration(damaged, hero), /没有维持专注/);
});

test('可以移除持续效果，并校验输入', () => {
  const { battle, monsters } = setup();
  const { battle: applied, effectId } = addOngoingEffect(battle, monsters[0], { name: '燃烧', damageExpression: '1d4', damageType: '火焰' }, { makeId: ids() });
  const removed = removeOngoingEffect(applied, monsters[0], effectId, { makeId: ids() });
  assert.equal(removed.actors.find(actor => actor.id === monsters[0]).combat.ongoing.length, 0);
  assert.throws(() => removeOngoingEffect(removed, monsters[0], effectId), /没有这个持续效果/);
  assert.throws(() => addOngoingEffect(battle, monsters[0], { name: '  ', damageExpression: '1d4', damageType: '火焰' }), /名称/);
  assert.throws(() => addOngoingEffect(battle, monsters[0], { name: '毒', damageExpression: '1d4', damageType: '毒素', saveEnds: { ability: 'con', dc: 0 } }), /豁免 DC/);
});
