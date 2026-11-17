const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, moveActorToCell, startCombat } = require('../apps/web/src/combat.ts');
const { suggestTurn } = require('../apps/web/src/combatAi.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `turn-${++counter}`;
const hero = actions => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-turn', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: { name: '艾拉', species: '人类', characterClass: '战士', level: 5, abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }, maxHp: 40, armorClass: 16, speedFt: 30, actions, notes: '' },
});
const bow = '短弓：+7 命中，1d8+3 穿刺伤害，射程 80/320 尺';
const sword = '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺';

function setup(actions = sword) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '回合建议', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(actions), { battleId: battle.id, side: '友方' }, ids()).store.battles[0];
  const archer = added.actors.find(actor => actor.side === '友方');
  const monster = added.actors.find(actor => actor.side !== '友方');
  const order = { [archer.id]: 20 };
  let seed = 10;
  for (const actor of added.actors) if (actor.id !== archer.id) order[actor.id] = seed--;
  return { battle: startCombat(added, order), monster, archer, store: added };
}

test('未开战时提示先开始战斗', () => {
  const { store } = setup();
  const withoutCombat = { ...store, combat: undefined };
  const turn = suggestTurn(withoutCombat);
  assert.equal(turn.action, 'hold');
  assert.match(turn.note, /战斗尚未开始/);
});

test('射程内直接建议攻击并给出目标', () => {
  const { battle, monster } = setup(bow);
  const turn = suggestTurn(battle);
  assert.equal(turn.action, 'attack');
  assert.equal(turn.targetId, monster.id);
  assert.match(turn.note, /射程内|触及范围|未启用方格/);
});

test('近战够不到但移动力足够时建议靠近', () => {
  const { battle, monster, archer } = setup(sword);
  let grid = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  grid = moveActorToCell(grid, archer.id, 0, 0);
  grid = moveActorToCell(grid, monster.id, 6, 0);
  const turn = suggestTurn(grid);
  assert.equal(turn.action, 'approach');
  assert.match(turn.note, /靠近 25 尺/);
});

test('移动力也不够时建议按兵不动', () => {
  const { battle, monster, archer } = setup(sword);
  let grid = configureGrid(battle, { width: 20, height: 20, cellFt: 5 });
  grid = moveActorToCell(grid, archer.id, 0, 0);
  grid = moveActorToCell(grid, monster.id, 12, 0);
  const turn = suggestTurn(grid);
  assert.equal(turn.action, 'hold');
  assert.match(turn.note, /够不到/);
});

test('没有敌人时不给攻击建议', () => {
  const { battle, monster } = setup(sword);
  const cleared = { ...battle, actors: battle.actors.filter(actor => actor.id !== monster.id), combat: { ...battle.combat, order: battle.combat.order.filter(id => id !== monster.id) } };
  const turn = suggestTurn(cleared);
  assert.equal(turn.action, 'hold');
  assert.match(turn.note, /没有可攻击的敌人/);
});
