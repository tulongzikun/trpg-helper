const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, attackSequence, endTurn, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot(equipment) {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '雷恩', species: '人类', characterClass: '战士', level: 5,
      abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 10, cha: 8 },
      maxHp: 44, armorClass: 16, speedFt: 30, actions: '', notes: '',
      details: { equipment },
    },
  };
}

function setup(equipment) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '装填', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(equipment), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  return { battle: started, hero, monster };
}

const shot = { attackBonus: 5, damageExpression: '1d8+3', damageType: '穿刺', range: 'ranged', distanceFt: 60 };

test('装填武器不能在一次动作里连续射击', () => {
  const { battle, hero, monster } = setup('轻弩');
  assert.throws(() => attackSequence(battle, { ...shot, attackerId: hero.id, targetId: monster.id, attacks: 2, weaponId: 'weapon:轻弩' }, { random: sequence(0.5) }), /装填武器每个动作只能射击一次/);
});

test('装填武器单次射击仍可结算', () => {
  const { battle, hero, monster } = setup('轻弩');
  const result = attack(battle, { ...shot, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:轻弩' }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.hit, true);
});

test('非装填武器仍可多次攻击', () => {
  const { battle, hero, monster } = setup('短弓');
  const result = attackSequence(battle, { ...shot, damageExpression: '1d6+3', attackerId: hero.id, targetId: monster.id, attacks: 2, weaponId: 'weapon:短弓' }, { random: sequence(0.5, 0.5, 0.5, 0.5) });
  assert.equal(result.outcomes.length, 2);
});

test('手弩同时是轻型与装填武器，副手攻击也只能单发', () => {
  const { battle, hero, monster } = setup('手弩、匕首');
  const afterAttack = attack(battle, { ...shot, damageExpression: '1d6+3', distanceFt: 20, attackerId: hero.id, targetId: monster.id }, { random: sequence(0.5, 0.5) }).battle;
  assert.throws(() => attackSequence(afterAttack, { ...shot, damageExpression: '1d6+3', distanceFt: 20, attackerId: hero.id, targetId: monster.id, attacks: 2, weaponId: 'weapon:手弩', cost: 'bonus' }, { random: sequence(0.5) }), /装填武器每个动作只能射击一次/);
});

test('装填射击后仍可在下一回合再次射击', () => {
  const { battle, hero, monster } = setup('轻弩');
  const first = attack(battle, { ...shot, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:轻弩' }, { random: sequence(0.5, 0.5) }).battle;
  const afterMonster = endTurn(first, { random: sequence(0.5) });
  const nextRound = endTurn(afterMonster, { random: sequence(0.5) });
  const again = attack(nextRound, { ...shot, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:轻弩' }, { random: sequence(0.5, 0.5) });
  assert.equal(again.outcome.hit, true);
});

