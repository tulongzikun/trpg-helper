const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { escapeGrapple, grapple, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot() {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '格雷', species: '人类', characterClass: '战士', level: 5,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      maxHp: 44, armorClass: 16, speedFt: 30, actions: '', notes: '',
      details: { equipment: '长剑', skillProficiencies: ['运动'] },
    },
  };
}

function setup() {
  const base = addMonsters(emptyStore(), card, { newBattleName: '挣脱', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  return { battle: started, hero, monster };
}

function monsterTurn(battle, monster) {
  return { ...battle, combat: { ...battle.combat, turnIndex: battle.combat.order.indexOf(monster.id) } };
}

test('挣脱成功后移除擒抱状态与擒抱者', () => {
  const { battle, hero, monster } = setup();
  const grappled = grapple(battle, { attackerId: hero.id, targetId: monster.id }, { random: sequence(0.95, 0.05) }).battle;
  const result = escapeGrapple(monsterTurn(grappled, monster), monster.id, { random: sequence(0.95) });
  assert.equal(result.outcome.success, true);
  const target = result.battle.actors.find(actor => actor.id === monster.id);
  assert.ok(!target.combat.conditions.includes('擒抱'));
  assert.equal(target.combat.grappledBy, undefined);
  assert.equal(target.combat.actionUsed, true);
});

test('挣脱失败后保留擒抱状态', () => {
  const { battle, hero, monster } = setup();
  const grappled = grapple(battle, { attackerId: hero.id, targetId: monster.id }, { random: sequence(0.95, 0.05) }).battle;
  const result = escapeGrapple(monsterTurn(grappled, monster), monster.id, { random: sequence(0.05) });
  assert.equal(result.outcome.success, false);
  const target = result.battle.actors.find(actor => actor.id === monster.id);
  assert.ok(target.combat.conditions.includes('擒抱'));
});

test('未被擒抱时不能挣脱', () => {
  const { battle, monster } = setup();
  assert.throws(() => escapeGrapple(monsterTurn(battle, monster), monster.id, { random: sequence(0.5) }), /该单位没有被擒抱/);
});

test('挣脱的 DC 由擒抱者的力量与熟练加值决定', () => {
  const { battle, hero, monster } = setup();
  const grappled = grapple(battle, { attackerId: hero.id, targetId: monster.id }, { random: sequence(0.95, 0.05) }).battle;
  const result = escapeGrapple(monsterTurn(grappled, monster), monster.id, { random: sequence(0.5) });
  assert.equal(result.outcome.targetTotal, 14, '8 + 力量调整值 3 + 熟练加值 3');
});

test('动作已经使用时不能再挣脱', () => {
  const { battle, hero, monster } = setup();
  const grappled = grapple(battle, { attackerId: hero.id, targetId: monster.id }, { random: sequence(0.95, 0.05) }).battle;
  const used = structuredClone(monsterTurn(grappled, monster));
  used.actors.find(actor => actor.id === monster.id).combat.actionUsed = true;
  assert.throws(() => escapeGrapple(used, monster.id, { random: sequence(0.5) }), /已经使用过动作/);
});
