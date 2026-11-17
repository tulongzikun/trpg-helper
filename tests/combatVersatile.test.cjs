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
      name: '艾拉', species: '人类', characterClass: '战士', level: 5,
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
      maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '',
      details: { equipment },
    },
  };
}

function setup(equipment) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '两用武器', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(equipment), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  return { battle: started, hero, monster };
}

test('双手持用长剑时伤害骰从 1d8 换成 1d10', () => {
  const { battle, hero, monster } = setup('长剑');
  const result = attack(battle, {
    attackerId: hero.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍',
    range: 'melee', distanceFt: 5, weaponId: 'weapon:长剑', twoHanded: true,
  }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.hit, true);
  assert.equal(result.outcome.critical, false);
  assert.equal(result.outcome.damage, 9, '1d10 掷出 6，力量 +3');
  const detail = result.battle.combat.log.at(-1).detail;
  assert.match(detail, /双手持用：1d10\+3/);
});

test('双手持用长棍时换成 1d8', () => {
  const { battle, hero, monster } = setup('长棍');
  const result = attack(battle, {
    attackerId: hero.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '钝击',
    range: 'melee', distanceFt: 5, weaponId: 'weapon:长棍', twoHanded: true,
  }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.damage, 8, '1d8 掷出 5，力量 +3');
});

test('单手使用同一把武器时保持原伤害骰', () => {
  const { battle, hero, monster } = setup('长剑');
  const result = attack(battle, {
    attackerId: hero.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍',
    range: 'melee', distanceFt: 5, weaponId: 'weapon:长剑',
  }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.damage, 8, '1d8 掷出 5，力量 +3');
  assert.doesNotMatch(result.battle.combat.log.at(-1).detail, /双手持用/);
});

test('非两用武器无法双手持用', () => {
  const { battle, hero, monster } = setup('巨剑');
  assert.throws(() => attack(battle, {
    attackerId: hero.id, targetId: monster.id, attackBonus: 5, damageExpression: '2d6+3', damageType: '挥砍',
    range: 'melee', distanceFt: 5, weaponId: 'weapon:巨剑', twoHanded: true,
  }, { random: sequence(0.5) }), /该武器没有两用形态，无法双手持用。/);
});

test('没有指定武器来源时不能双手持用', () => {
  const { battle, hero, monster } = setup('长剑');
  assert.throws(() => attack(battle, {
    attackerId: hero.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍',
    range: 'melee', distanceFt: 5, twoHanded: true,
  }, { random: sequence(0.5) }), /该武器没有两用形态，无法双手持用。/);
});
