const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, offhandAttack, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot(equipment) {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '布鲁诺', species: '人类', characterClass: '战士', level: 5,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      maxHp: 44, armorClass: 16, speedFt: 30, actions: '', notes: '',
      details: { equipment },
    },
  };
}

function setup(equipment) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '双武器', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(equipment), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  return { battle: started, hero, monster };
}

const main = { attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍' };

test('没有先用动作攻击时不能副手攻击', () => {
  const { battle, hero, monster } = setup('匕首、短剑');
  assert.throws(() => offhandAttack(battle, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:匕首' }, { random: sequence(0.5) }), /副手攻击需要在用动作攻击之后进行/);
});

test('非轻型武器不能副手攻击', () => {
  const { battle, hero, monster } = setup('长剑、匕首');
  const afterAttack = attack(battle, { ...main, attackerId: hero.id, targetId: monster.id }, { random: sequence(0.5, 0.5) }).battle;
  assert.throws(() => offhandAttack(afterAttack, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:长剑' }, { random: sequence(0.5) }), /只有轻型武器可以进行副手攻击/);
});

test('匕首副手攻击不把属性调整值加到伤害上', () => {
  const { battle, hero, monster } = setup('匕首、短剑');
  const afterAttack = attack(battle, { ...main, attackerId: hero.id, targetId: monster.id }, { random: sequence(0.5, 0.5) }).battle;
  const result = offhandAttack(afterAttack, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:匕首' }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.hit, true);
  assert.equal(result.outcome.damage, 3, '1d4 掷出 3，且不加 +3');
  const offhand = result.battle.actors.find(actor => actor.id === hero.id);
  assert.equal(offhand.combat.bonusUsed, true, '副手攻击消耗附赠动作');
  assert.ok(result.battle.combat.log.some(item => /伤害不使用属性调整值/.test(item.text)));
});

test('短剑同为轻型武器，可副手攻击', () => {
  const { battle, hero, monster } = setup('短剑');
  const afterAttack = attack(battle, { ...main, attackerId: hero.id, targetId: monster.id }, { random: sequence(0.5, 0.5) }).battle;
  const result = offhandAttack(afterAttack, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:短剑' }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.damage, 4, '1d6 掷出 4，不加 +3');
});

test('附赠动作已用过后不能再副手攻击', () => {
  const { battle, hero, monster } = setup('匕首');
  const afterAttack = attack(battle, { ...main, attackerId: hero.id, targetId: monster.id }, { random: sequence(0.5, 0.5) }).battle;
  const once = offhandAttack(afterAttack, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:匕首' }, { random: sequence(0.5, 0.5) }).battle;
  assert.throws(() => offhandAttack(once, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:匕首' }, { random: sequence(0.5) }), /已经使用过附赠动作/);
});
