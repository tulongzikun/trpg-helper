const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, currentActorId, endTurn, moveActorToCell, spendMovement, startCombat, toggleWallCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (equipment) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-mastery', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment },
  },
});

function setup(equipment) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '精通测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(equipment), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const friend = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  let next = startCombat(withHero, { [friend.id]: 20, [monster.id]: 10 });
  next = configureGrid(next, { width: 10, height: 3, cellFt: 5 });
  next = moveActorToCell(next, friend.id, 1, 1);
  next = moveActorToCell(next, monster.id, 2, 1);
  return { battle: next, friend, monster };
}

test('长剑命中后让目标削韧，目标下一次攻击劣势并清除标记', () => {
  const { battle, friend, monster } = setup('长剑');
  const hit = attack(battle, { attackerId: currentActorId(battle), targetId: currentActorId(battle) === friend.id ? monster.id : friend.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', weaponId: 'weapon:长剑' }, { random: sequence(0.5, 0.5), makeId: ids() });
  const target = hit.battle.actors.find(actor => actor.id === monster.id);
  assert.equal(target.combat.sapped, true);
  const log = hit.battle.combat.log.at(-1);
  assert.match(log.detail, /精通·削韧/);
});

test('削韧目标在下一次攻击时劣势，用掉后清除', () => {
  const { battle, friend, monster } = setup('长剑');
  let next = battle;
  while (currentActorId(next) !== monster.id) next = endTurn(next);
  next = structuredClone(next);
  next.actors.find(actor => actor.id === monster.id).combat.sapped = true;
  const result = attack(next, { attackerId: monster.id, targetId: friend.id, attackBonus: 4, damageExpression: '1d6+2', damageType: '穿刺' }, { random: sequence(0.9, 0.1, 0.5), makeId: ids() });
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.equal(result.outcome.natural, 3);
  assert.equal(result.battle.actors.find(actor => actor.id === monster.id).combat.sapped, false);
});

test('战锤推撞把目标推开一格', () => {
  const { battle, friend, monster } = setup('战锤');
  const before = battle.actors.find(actor => actor.id === monster.id).position;
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '钝击', weaponId: 'weapon:战锤' }, { random: sequence(0.5, 0.5), makeId: ids() });
  const after = result.battle.actors.find(actor => actor.id === monster.id).position;
  assert.deepEqual(after, { x: before.x + 1, y: before.y });
  assert.match(result.battle.combat.log.at(-1).detail, /精通·推撞/);
});

test('推撞遇到边界时不移动并记录原因', () => {
  const { battle, friend, monster } = setup('战锤');
  const next = configureGrid(battle, { width: 3, height: 3, cellFt: 5 });
  const result = attack(next, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '钝击', weaponId: 'weapon:战锤' }, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.deepEqual(result.battle.actors.find(actor => actor.id === monster.id).position, { x: 2, y: 1 });
  assert.match(result.battle.combat.log.at(-1).detail, /目标无法被推开/);
});

test('长弓迟滞让目标移动力减少 10 尺', () => {
  const { battle, friend, monster } = setup('长弓');
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '穿刺', range: 'ranged', weaponId: 'weapon:长弓' }, { random: sequence(0.5, 0.5), makeId: ids() });
  const slowed = result.battle.actors.find(actor => actor.id === monster.id);
  assert.equal(slowed.combat.speedPenaltyFt, 10);
  // 怪物回合移动 25 尺超过 20 尺的剩余速度
  let next = result.battle;
  while (currentActorId(next) !== monster.id) next = endTurn(next);
  assert.throws(() => spendMovement(next, monster.id, 25), /速度上限（20 尺）/);
});

test('没有精通的武器命中后不改变目标状态', () => {
  const { battle, friend, monster } = setup('匕首');
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d4+3', damageType: '穿刺', weaponId: 'weapon:匕首' }, { random: sequence(0.5, 0.5), makeId: ids() });
  const target = result.battle.actors.find(actor => actor.id === monster.id);
  assert.equal(target.combat.sapped, undefined);
  assert.equal(target.combat.speedPenaltyFt, undefined);
  assert.match(result.battle.combat.log.at(-1).detail, /目标剩余/);
});
