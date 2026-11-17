const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, currentActorId, moveActorToCell, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (equipment) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-mastery2', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment },
  },
});

function setup(equipment, count = 1) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '精通二期', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(equipment), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const friend = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  const monsters = withHero.actors.filter(actor => actor.side === '敌方');
  const initiatives = { [friend.id]: 20 };
  monsters.forEach((item, index) => { initiatives[item.id] = 10 - index; });
  let next = startCombat(withHero, initiatives);
  next = configureGrid(next, { width: 8, height: 3, cellFt: 5 });
  next = moveActorToCell(next, friend.id, 1, 1);
  next = moveActorToCell(next, monster.id, 2, 1);
  return { battle: next, friend, monster, monsters };
}

test('短剑命中后给攻击者破绽，下一次对同一目标攻击优势', () => {
  const { battle, friend, monster } = setup('短剑');
  const first = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '穿刺', weaponId: 'weapon:短剑' }, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(first.battle.actors.find(actor => actor.id === friend.id).combat.vexTargetId, monster.id);
  assert.match(first.battle.combat.log.at(-1).detail, /精通·破绽/);

  const second = attack(first.battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '穿刺', weaponId: 'weapon:短剑', cost: 'bonus' }, { random: sequence(0.9, 0.1, 0.5), makeId: ids() });
  assert.equal(second.outcome.mode, 'advantage');
  assert.equal(second.outcome.natural, 19);
  assert.equal(second.battle.actors.find(actor => actor.id === friend.id).combat.vexTargetId, undefined);
});

test('破绽只对原目标生效', () => {
  const { battle, friend, monster, monsters } = setup('短剑', 2);
  const other = monsters.find(item => item.id !== monster.id);
  const first = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '穿刺', weaponId: 'weapon:短剑' }, { random: sequence(0.5, 0.5), makeId: ids() });
  const second = attack(first.battle, { attackerId: friend.id, targetId: other.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '穿刺', weaponId: 'weapon:短剑', cost: 'bonus' }, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(second.outcome.mode, 'normal');
  // 第二次攻击命中另一个目标：破绽改为标记新目标，而不是原目标
  assert.equal(second.battle.actors.find(actor => actor.id === friend.id).combat.vexTargetId, other.id);
});

test('长棍倾覆让目标体质豁免失败后倒地', () => {
  const { battle, friend, monster } = setup('长棍');
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '钝击', weaponId: 'weapon:长棍' }, { random: sequence(0.5, 0.5, 0.0), makeId: ids() });
  const target = result.battle.actors.find(actor => actor.id === monster.id);
  assert.ok(target.combat.conditions.includes('倒地'));
  assert.match(result.battle.combat.log.at(-1).detail, /精通·倾覆：目标体质豁免失败/);
});

test('倾覆豁免成功时不倒地', () => {
  const { battle, friend, monster } = setup('长棍');
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '钝击', weaponId: 'weapon:长棍' }, { random: sequence(0.5, 0.5, 0.99), makeId: ids() });
  const target = result.battle.actors.find(actor => actor.id === monster.id);
  assert.ok(!target.combat.conditions.includes('倒地'));
  assert.match(result.battle.combat.log.at(-1).detail, /精通·倾覆：目标体质豁免成功/);
});

test('倾覆的豁免 DC 随熟练与力量调整值变化', () => {
  const { battle, friend, monster } = setup('长棍');
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '钝击', weaponId: 'weapon:长棍' }, { random: sequence(0.5, 0.5, 0.0), makeId: ids() });
  // 5 级熟练 +3，力量 16 调整值 +3，DC = 8 + 3 + 3 = 14
  assert.match(result.battle.combat.log.at(-1).detail, /DC 14/);
});

test('当前行动者的破绽标记不会影响其他单位', () => {
  const { battle, friend } = setup('短剑');
  const cloned = structuredClone(battle);
  cloned.actors.find(actor => actor.id === friend.id).combat.vexTargetId = 'someone-else';
  const result = attack(cloned, { attackerId: friend.id, targetId: cloneTarget(cloned, friend.id), attackBonus: 5, damageExpression: '1d6+3', damageType: '穿刺', weaponId: 'weapon:短剑' }, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(result.outcome.mode, 'normal');
});

function cloneTarget(battle, attackerId) {
  return battle.actors.find(actor => actor.id !== attackerId && actor.side !== '友方').id;
}
