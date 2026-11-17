const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot(equipment) {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '艾拉', species: '人类', characterClass: '游侠', level: 5,
      abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 8 },
      maxHp: 40, armorClass: 15, speedFt: 30, actions: '', notes: '',
      details: { equipment },
    },
  };
}

function setup(equipment) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '射程', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(equipment), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  return { battle: started, hero, monster };
}

const base = { attackBonus: 7, damageExpression: '1d6+3', damageType: '穿刺', range: 'ranged' };

test('常规射程内没有劣势', () => {
  const { battle, hero, monster } = setup('短弓');
  const result = attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, distanceFt: 60, weaponId: 'weapon:短弓' }, { random: sequence(0.5) });
  assert.equal(result.outcome.mode, 'normal');
});

test('超出常规射程但在最大射程内时具有劣势', () => {
  const { battle, hero, monster } = setup('短弓');
  const result = attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, distanceFt: 150, weaponId: 'weapon:短弓' }, { random: sequence(0.9, 0.1) });
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.equal(result.outcome.natural, 3, '劣势取较低的一个');
  assert.ok(result.outcome.notes.some(note => /超出常规射程/.test(note)));
});

test('超过武器最大射程时拒绝', () => {
  const { battle, hero, monster } = setup('短弓');
  assert.throws(() => attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, distanceFt: 400, weaponId: 'weapon:短弓' }, { random: sequence(0.5) }), /最大射程（320 尺）/);
});

test('未指定武器来源时不受最大射程限制', () => {
  const { battle, hero, monster } = setup('短弓');
  const result = attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, distanceFt: 400 }, { random: sequence(0.5) });
  assert.equal(result.outcome.mode, 'normal');
});

test('长弓在 500 尺处具有劣势，超过 600 尺被拒绝', () => {
  const { battle, hero, monster } = setup('长弓');
  const far = attack(battle, { ...base, damageExpression: '1d8+3', attackerId: hero.id, targetId: monster.id, distanceFt: 500, weaponId: 'weapon:长弓' }, { random: sequence(0.2, 0.8) });
  assert.equal(far.outcome.mode, 'disadvantage');
  const { battle: b2, hero: h2, monster: m2 } = setup('长弓');
  const edge = attack(b2, { ...base, damageExpression: '1d8+3', attackerId: h2.id, targetId: m2.id, distanceFt: 600, weaponId: 'weapon:长弓' }, { random: sequence(0.5) });
  assert.equal(edge.outcome.mode, 'disadvantage', '600 尺是长弓的最大射程，仍在射程内但具有劣势');
  assert.throws(() => attack(b2, { ...base, damageExpression: '1d8+3', attackerId: h2.id, targetId: m2.id, distanceFt: 601, weaponId: 'weapon:长弓' }, { random: sequence(0.5) }), /最大射程（600 尺）/);
});

