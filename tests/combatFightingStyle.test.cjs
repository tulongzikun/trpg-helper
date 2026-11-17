const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, attack } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup(styles) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '战斗风格', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const hero = {
    ...base.actors[0],
    id: 'hero',
    name: '艾拉',
    side: '友方',
    currentHp: 40,
    maxHp: 40,
    template: { ...base.actors[0].template, armorClass: 16, hitPoints: { ...base.actors[0].template.hitPoints, average: 200 } },
    characterSnapshot: {
      sheet: {
        level: 5,
        characterClass: '战士',
        abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 10, cha: 10 },
        details: { equipment: '长剑、短弓', fightingStyles: styles, fightingStyle: styles[0] }
      }
    }
  };
  const enemy = {
    ...base.actors[0],
    id: 'enemy',
    name: '靶子',
    side: '敌方',
    currentHp: 200,
    maxHp: 200,
    template: { ...base.actors[0].template, armorClass: 16, hitPoints: { ...base.actors[0].template.hitPoints, average: 200 } }
  };
  const battle = { ...base, actors: [hero, enemy] };
  return startCombat(battle, { hero: 20, enemy: 1 });
}

test('射术让远程攻击检定 +2，把未命中变成命中', () => {
  const plain = attack(setup([]), { attackerId: 'hero', targetId: 'enemy', attackBonus: 3, damageExpression: '1d6+3', damageType: '穿刺', range: 'ranged', distanceFt: 30, weaponId: 'weapon:短弓' }, { random: sequence(0.55, 0.5) });
  assert.equal(plain.outcome.hit, false);
  const styled = attack(setup(['射术']), { attackerId: 'hero', targetId: 'enemy', attackBonus: 3, damageExpression: '1d6+3', damageType: '穿刺', range: 'ranged', distanceFt: 30, weaponId: 'weapon:短弓' }, { random: sequence(0.55, 0.5) });
  assert.equal(styled.outcome.hit, true);
  assert.match(styled.battle.combat.log.at(-1).detail, /射术：远程攻击检定 \+2/);
});

test('对决让单手近战武器伤害 +2', () => {
  const plain = attack(setup([]), { attackerId: 'hero', targetId: 'enemy', attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', distanceFt: 5, weaponId: 'weapon:长剑' }, { random: sequence(0.7, 0.5) });
  const styled = attack(setup(['对决']), { attackerId: 'hero', targetId: 'enemy', attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', distanceFt: 5, weaponId: 'weapon:长剑' }, { random: sequence(0.7, 0.5) });
  assert.equal(plain.outcome.hit, true);
  assert.equal(styled.outcome.damage, plain.outcome.damage + 2);
  assert.match(styled.battle.combat.log.at(-1).detail, /对决：单手近战伤害 \+2/);
});

test('双手持用时不触发对决加成', () => {
  const plain = attack(setup([]), { attackerId: 'hero', targetId: 'enemy', attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', distanceFt: 5, twoHanded: true, weaponId: 'weapon:长剑' }, { random: sequence(0.7, 0.5) });
  const styled = attack(setup(['对决']), { attackerId: 'hero', targetId: 'enemy', attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', distanceFt: 5, twoHanded: true, weaponId: 'weapon:长剑' }, { random: sequence(0.7, 0.5) });
  assert.equal(styled.outcome.damage, plain.outcome.damage);
});

test('对决不影响远程武器', () => {
  const plain = attack(setup([]), { attackerId: 'hero', targetId: 'enemy', attackBonus: 5, damageExpression: '1d6+3', damageType: '穿刺', range: 'ranged', distanceFt: 30, weaponId: 'weapon:短弓' }, { random: sequence(0.7, 0.5) });
  const styled = attack(setup(['对决']), { attackerId: 'hero', targetId: 'enemy', attackBonus: 5, damageExpression: '1d6+3', damageType: '穿刺', range: 'ranged', distanceFt: 30, weaponId: 'weapon:短弓' }, { random: sequence(0.7, 0.5) });
  assert.equal(styled.outcome.damage, plain.outcome.damage);
});

test('没有战斗风格时两项都不生效', () => {
  const result = attack(setup([]), { attackerId: 'hero', targetId: 'enemy', attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', distanceFt: 5, weaponId: 'weapon:长剑' }, { random: sequence(0.7, 0.5) });
  assert.ok(!/对决/.test(result.battle.combat.log.at(-1).detail ?? ''));
  assert.ok(!/射术/.test(result.battle.combat.log.at(-1).detail ?? ''));
});
