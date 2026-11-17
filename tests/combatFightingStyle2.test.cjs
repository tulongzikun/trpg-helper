const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, attack } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup(styles, targetStyles = []) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '战斗风格二', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const sheet = styles => ({
    level: 5,
    characterClass: '战士',
    abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 10, cha: 10 },
    details: { equipment: '巨剑、长剑、短弓', fightingStyles: styles, fightingStyle: styles[0] }
  });
  const hero = {
    ...base.actors[0], id: 'hero', name: '艾拉', side: '友方', currentHp: 40, maxHp: 40,
    template: { ...base.actors[0].template, armorClass: 16 },
    characterSnapshot: { sheet: sheet(styles) }
  };
  const enemy = {
    ...base.actors[0], id: 'enemy', name: '靶子', side: '敌方', currentHp: 200, maxHp: 200,
    template: { ...base.actors[0].template, armorClass: 15, hitPoints: { ...base.actors[0].template.hitPoints, average: 200 } },
    ...(targetStyles.length ? { characterSnapshot: { sheet: sheet(targetStyles) } } : {})
  };
  return startCombat({ ...base, actors: [hero, enemy] }, { hero: 20, enemy: 1 });
}

test('防御风格让目标 AC +1，把命中变成未命中', () => {
  const plain = attack(setup([]), { attackerId: 'hero', targetId: 'enemy', attackBonus: 0, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', distanceFt: 5, weaponId: 'weapon:长剑' }, { random: sequence(0.7, 0.5) });
  assert.equal(plain.outcome.hit, true);
  const defended = attack(setup([], ['防御']), { attackerId: 'hero', targetId: 'enemy', attackBonus: 0, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', distanceFt: 5, weaponId: 'weapon:长剑' }, { random: sequence(0.7, 0.5) });
  assert.equal(defended.outcome.hit, false);
});

test('巨武器战斗在双手武器掷出 1 或 2 时重掷并采用新结果', () => {
  const plain = attack(setup([]), { attackerId: 'hero', targetId: 'enemy', attackBonus: 0, damageExpression: '2d6+3', damageType: '挥砍', range: 'melee', distanceFt: 5, weaponId: 'weapon:巨剑' }, { random: sequence(0.7, 0.0, 0.5) });
  assert.equal(plain.outcome.damage, 1 + 4 + 3);
  const styled = attack(setup(['巨武器战斗']), { attackerId: 'hero', targetId: 'enemy', attackBonus: 0, damageExpression: '2d6+3', damageType: '挥砍', range: 'melee', distanceFt: 5, weaponId: 'weapon:巨剑' }, { random: sequence(0.7, 0.0, 0.9, 0.5) });
  assert.equal(styled.outcome.damage, 6 + 4 + 3);
  assert.match(styled.battle.combat.log.at(-1).detail, /巨武器战斗/);
});

test('巨武器战斗不影响单手武器', () => {
  const plain = attack(setup([]), { attackerId: 'hero', targetId: 'enemy', attackBonus: 0, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', distanceFt: 5, weaponId: 'weapon:长剑' }, { random: sequence(0.7, 0.0) });
  const styled = attack(setup(['巨武器战斗']), { attackerId: 'hero', targetId: 'enemy', attackBonus: 0, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', distanceFt: 5, weaponId: 'weapon:长剑' }, { random: sequence(0.7, 0.0) });
  assert.equal(styled.outcome.damage, plain.outcome.damage);
  assert.ok(!/巨武器战斗/.test(styled.battle.combat.log.at(-1).detail ?? ''));
});

test('伤害骰为 3 以上时不重掷', () => {
  const plain = attack(setup([]), { attackerId: 'hero', targetId: 'enemy', attackBonus: 0, damageExpression: '2d6+3', damageType: '挥砍', range: 'melee', distanceFt: 5, weaponId: 'weapon:巨剑' }, { random: sequence(0.7, 0.5, 0.5) });
  const styled = attack(setup(['巨武器战斗']), { attackerId: 'hero', targetId: 'enemy', attackBonus: 0, damageExpression: '2d6+3', damageType: '挥砍', range: 'melee', distanceFt: 5, weaponId: 'weapon:巨剑' }, { random: sequence(0.7, 0.5, 0.5) });
  assert.equal(styled.outcome.damage, plain.outcome.damage);
});

test('rollGreatWeaponDamage 对每颗 1 或 2 的骰子各重掷一次', () => {
  const { rollGreatWeaponDamage } = require('../apps/web/src/combat.ts');
  const rolled = rollGreatWeaponDamage('2d6', sequence(0.0, 0.9, 0.0, 0.5));
  assert.deepEqual(rolled.rolls, [6, 4]);
});
