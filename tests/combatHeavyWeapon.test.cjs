const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot(str, equipment) {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '艾拉', species: '人类', characterClass: '战士', level: 5,
      abilities: { str, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
      maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '',
      details: { equipment },
    },
  };
}

function setup(str, equipment) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '重型武器', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(str, equipment), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  return { battle: started, hero, monster };
}

const base = { attackBonus: 5, damageExpression: '2d6+3', damageType: '挥砍', range: 'melee', distanceFt: 5 };

test('力量不足时重型武器攻击具有劣势', () => {
  const { battle, hero, monster } = setup(8, '巨剑');
  const result = attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:巨剑' }, { random: sequence(0.99, 0.0) });
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.equal(result.outcome.natural, 1, '劣势取两个 d20 中较低的一个');
  assert.ok(result.outcome.notes.some(note => /重型武器/.test(note)));
});

test('力量达标时重型武器不产生劣势', () => {
  const { battle, hero, monster } = setup(16, '巨剑');
  const result = attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:巨剑' }, { random: sequence(0.99) });
  assert.equal(result.outcome.mode, 'normal');
  assert.equal(result.outcome.natural, 20);
});

test('非重型武器即使力量不足也没有劣势', () => {
  const { battle, hero, monster } = setup(8, '长剑');
  const result = attack(battle, { ...base, damageExpression: '1d8+3', attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:长剑' }, { random: sequence(0.3) });
  assert.equal(result.outcome.mode, 'normal');
  assert.equal(result.outcome.natural, 7);
});

test('未指定武器来源时按原有的状态修正结算', () => {
  const { battle, hero, monster } = setup(8, '巨剑');
  const result = attack(battle, { ...base, attackerId: hero.id, targetId: monster.id }, { random: sequence(0.99) });
  assert.equal(result.outcome.mode, 'normal');
});

test('未知的攻击来源会被拒绝', () => {
  const { battle, hero, monster } = setup(16, '巨剑');
  assert.throws(
    () => attack(battle, { ...base, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:不存在' }, { random: sequence(0.99) }),
    /攻击来源无效。/
  );
});
