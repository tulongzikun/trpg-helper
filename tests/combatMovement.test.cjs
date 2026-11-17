const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat } = require('../apps/web/src/combat.ts');
const { applyFallDamage, fallAverageDamage, fallDamageExpression, fallDiceCount, jumpDistance } = require('../apps/web/src/combatMovement.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot(str = 16) {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '艾拉', species: '人类', characterClass: '战士', level: 5,
      abilities: { str, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
      maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: {},
    },
  };
}

function setup(str = 16) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '坠落', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(str), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  return { battle: started, hero, monster };
}

test('坠落骰数按每 10 尺 1d6，封顶 20d6', () => {
  assert.equal(fallDiceCount(5), 0);
  assert.equal(fallDiceCount(10), 1);
  assert.equal(fallDiceCount(35), 3);
  assert.equal(fallDiceCount(400), 20);
  assert.equal(fallDamageExpression(9), null);
  assert.equal(fallDamageExpression(20), '2d6');
});

test('坠落平均伤害按骰数 3.5 取整', () => {
  assert.equal(fallAverageDamage(10), 4);
  assert.equal(fallAverageDamage(30), 11);
  assert.equal(fallAverageDamage(3), 0);
});

test('坠落造成钝击伤害并倒地', () => {
  const { battle, hero } = setup();
  const result = applyFallDamage(battle, hero.id, 20, { random: sequence(0.5, 0.5) });
  assert.equal(result.expression, '2d6');
  assert.equal(result.damage, 8);
  const after = result.battle.actors.find(actor => actor.id === hero.id);
  assert.equal(after.currentHp, 32);
  assert.ok(after.combat.conditions.includes('倒地'));
  assert.ok(result.battle.combat.log.some(item => item.text.includes('倒地')));
});

test('不足 10 尺不结算伤害也不倒地', () => {
  const { battle, hero } = setup();
  const result = applyFallDamage(battle, hero.id, 5, { random: sequence(0.5) });
  assert.equal(result.damage, 0);
  assert.equal(result.expression, null);
  assert.equal(result.battle, battle);
});

test('负高度与非数字高度被拒绝', () => {
  const { battle, hero } = setup();
  assert.throws(() => applyFallDamage(battle, hero.id, -5), /坠落高度无效/);
  assert.throws(() => applyFallDamage(battle, hero.id, Number.NaN), /坠落高度无效/);
});

test('跳远与跳高按力量计算，无助跑减半', () => {
  const { hero } = setup(16);
  assert.equal(jumpDistance(hero, 'long'), 16);
  assert.equal(jumpDistance(hero, 'long', false), 8);
  assert.equal(jumpDistance(hero, 'high'), 6);
  assert.equal(jumpDistance(hero, 'high', false), 3);
});

test('低力量跳高不会为负', () => {
  const { hero } = setup(1);
  assert.equal(jumpDistance(hero, 'high'), 0);
});
