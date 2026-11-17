const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter, removeActor } = require('../apps/web/src/battle.ts');
const { configureGrid, moveActorToCell, startCombat, toggleWallCell } = require('../apps/web/src/combat.ts');
const { averageDamage, hasImmediateAttack, suggestAttacks } = require('../apps/web/src/combatAi.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const hero = actions => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: { name: '艾拉', species: '人类', characterClass: '游侠', level: 5, abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }, maxHp: 40, armorClass: 16, speedFt: 30, actions, notes: '' },
});
const bow = '短弓：+7 命中，1d8+3 穿刺伤害，射程 80/320 尺';
const sword = '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺';

function setup(actions = bow, count = 1) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '建议测试', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const addedStore = addCharacter(store, hero(actions), { battleId: battle.id, side: '友方' }, ids()).store;
  const added = addedStore.battles[0];
  const archer = added.actors.find(actor => actor.side === '友方');
  const monster = added.actors.find(actor => actor.side !== '友方');
  const order = { [archer.id]: 20 };
  let seed = 10;
  for (const actor of added.actors) if (actor.id !== archer.id) order[actor.id] = seed--;
  return { battle: startCombat(added, order), monster, archer, store: addedStore };
}

test('未启用方格时视为在范围内，并给出可执行建议', () => {
  const { battle, archer } = setup();
  const suggestions = suggestAttacks(battle, archer.id);
  assert.ok(suggestions.length >= 1);
  assert.equal(suggestions[0].inRange, true);
  assert.match(suggestions[0].reason, /未启用方格/);
});

test('方格内射程内的远程目标可直接攻击并给出距离', () => {
  const { battle, monster, archer } = setup();
  let grid = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  grid = moveActorToCell(grid, archer.id, 0, 0);
  grid = moveActorToCell(grid, monster.id, 6, 0);
  const ranged = suggestAttacks(grid, archer.id).find(item => item.source.range === 'ranged');
  assert.ok(ranged);
  assert.equal(ranged.inRange, true);
  assert.equal(ranged.distanceFt, 30);
  assert.match(ranged.reason, /射程内/);
});

test('近战来源超出触及时说明还需要靠近多少尺', () => {
  const { battle, monster, archer } = setup(sword);
  let grid = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  grid = moveActorToCell(grid, archer.id, 0, 0);
  grid = moveActorToCell(grid, monster.id, 6, 0);
  const melee = suggestAttacks(grid, archer.id)[0];
  assert.equal(melee.inRange, false);
  assert.match(melee.reason, /需要再靠近 25 尺/);
});

test('墙体阻挡视线时远程建议会说明原因且不可直接执行', () => {
  const { battle, monster, archer } = setup();
  let grid = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  grid = moveActorToCell(grid, archer.id, 0, 0);
  grid = moveActorToCell(grid, monster.id, 6, 0);
  grid = toggleWallCell(grid, 3, 0);
  const ranged = suggestAttacks(grid, archer.id).find(item => item.source.range === 'ranged');
  assert.ok(ranged);
  assert.equal(ranged.inRange, false);
  assert.match(ranged.reason, /视线被墙体阻挡/);
});

test('没有敌人时返回空建议，且不会报告可立即攻击', () => {
  const { battle, monster, archer, store } = setup();
  const lonely = removeActor(store, battle.id, monster.id).battles[0];
  assert.deepEqual(suggestAttacks(lonely, archer.id), []);
  assert.equal(hasImmediateAttack(lonely, archer.id), false);
});

test('limit 限制返回条数，且按分数从高到低排列', () => {
  const { battle, archer } = setup(bow, 2);
  const all = suggestAttacks(battle, archer.id, 50);
  assert.ok(all.length >= 2);
  assert.equal(suggestAttacks(battle, archer.id, 1).length, 1);
  for (let index = 1; index < all.length; index += 1) assert.ok(all[index - 1].score >= all[index].score);
});

test('平均伤害按骰子期望值计算', () => {
  assert.equal(averageDamage('2d6+3'), 10);
  assert.equal(averageDamage('1d8'), 5);
  assert.equal(averageDamage('4d6-2'), 12);
  assert.equal(averageDamage('不是骰子'), 0);
});


test('同等血线比例下优先推荐能被一击打掉的残血目标', () => {
  const { battle, archer } = setup(bow, 2);
  const enemies = battle.actors.filter(actor => actor.side === '敌方');
  const first = enemies[0];
  const second = enemies[1];
  first.name = '甲';
  second.name = '乙';
  first.maxHp = 10;
  first.currentHp = 5;
  second.maxHp = 40;
  second.currentHp = 20;
  const suggestions = suggestAttacks(battle, archer.id);
  assert.equal(suggestions[0].targetName, '甲');
});

function duo(actions = sword) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '集火测试', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = base.battles[0];
  const first = addCharacter(base, hero(actions), { battleId: battle.id, side: '友方' }, ids()).store;
  const secondHero = hero(actions);
  secondHero.characterId = 'char-2';
  secondHero.sheet = { ...secondHero.sheet, name: '同伴' };
  const store = addCharacter(first, secondHero, { battleId: battle.id, side: '友方' }, ids()).store;
  const built = store.battles[0];
  const allies = built.actors.filter(actor => actor.side === '友方');
  const enemies = built.actors.filter(actor => actor.side === '敌方');
  const order = { [allies[0].id]: 20, [allies[1].id]: 15, [enemies[0].id]: 10, [enemies[1].id]: 9 };
  return { battle: startCombat(built, order), allies, enemies };
}

test('同伴贴身的敌人会因集火加权排在前面', () => {
  const { battle, allies, enemies } = duo();
  let grid = configureGrid(battle, { width: 12, height: 12, cellFt: 5 });
  grid = moveActorToCell(grid, allies[0].id, 0, 0);
  grid = moveActorToCell(grid, allies[1].id, 2, 0);
  grid = moveActorToCell(grid, enemies[0].id, 3, 0);
  grid = moveActorToCell(grid, enemies[1].id, 0, 3);
  grid.actors.find(actor => actor.id === enemies[0].id).name = '甲';
  grid.actors.find(actor => actor.id === enemies[1].id).name = '乙';
  const suggestions = suggestAttacks(grid, allies[0].id, 50).filter(item => item.source.range === 'melee');
  assert.equal(suggestions[0].targetName, '甲');
  assert.match(suggestions[0].reason, /集火/);
});

test('倒地的目标在近战建议里加权并说明原因', () => {
  const { battle, allies, enemies } = duo();
  let grid = configureGrid(battle, { width: 12, height: 12, cellFt: 5 });
  grid = moveActorToCell(grid, allies[0].id, 0, 0);
  grid = moveActorToCell(grid, enemies[0].id, 1, 0);
  grid = moveActorToCell(grid, enemies[1].id, 0, 1);
  grid.actors.find(actor => actor.id === enemies[0].id).name = '甲';
  grid.actors.find(actor => actor.id === enemies[1].id).name = '乙';
  const prone = grid.actors.find(actor => actor.id === enemies[0].id);
  prone.combat.conditions.push('倒地');
  const suggestions = suggestAttacks(grid, allies[0].id, 50).filter(item => item.source.range === 'melee');
  assert.equal(suggestions[0].targetName, '甲');
  assert.match(suggestions[0].reason, /倒地/);
});

test('远程建议不受倒地加权影响', () => {
  const { battle, allies, enemies } = duo(bow);
  enemies[0].name = '甲';
  enemies[1].name = '乙';
  let grid = configureGrid(battle, { width: 12, height: 12, cellFt: 5 });
  grid = moveActorToCell(grid, allies[0].id, 0, 0);
  grid = moveActorToCell(grid, enemies[0].id, 2, 0);
  grid = moveActorToCell(grid, enemies[1].id, 0, 2);
  const prone = grid.actors.find(actor => actor.id === enemies[0].id);
  prone.combat.conditions.push('倒地');
  const ranged = suggestAttacks(grid, allies[0].id, 50).filter(item => item.source.range === 'ranged');
  assert.ok(ranged.length >= 2);
  assert.doesNotMatch(ranged[0].reason, /倒地/);
});
