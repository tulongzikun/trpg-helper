const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, moveActorToCell, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-ranged', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '游侠', level: 5,
    abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, saveProficiencies: [],
    actions: '短弓：+7 命中，1d8+3 穿刺伤害，射程 80/320 尺', notes: '', details: { equipment: '短弓' },
  },
};

function setup({ grid = true, enemy = [2, 0], ally = null } = {}) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '远程贴身', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  if (ally) {
    const withAlly = addMonsters(added.store, card, { battleId: added.battleId, side: '友方', count: 1 }, ids()).store;
    const initiatives = {};
    withAlly.battles[0].actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 - index : 10 - index; });
    const started = startCombat(withAlly.battles[0], initiatives);
    return place(started, { grid, enemy, ally });
  }
  const initiatives = {};
  added.store.battles[0].actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(added.store.battles[0], initiatives);
  return place(started, { grid, enemy, ally });
}

function place(started, { grid, enemy, ally }) {
  let battle = grid ? configureGrid(started, { width: 20, height: 10, cellFt: 5 }) : started;
  const friend = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  if (grid) {
    battle = moveActorToCell(battle, friend.id, 1, 1);
    battle = moveActorToCell(battle, monster.id, enemy[0], enemy[1]);
    if (ally) {
      const allyActor = battle.actors.find(actor => actor.side === '友方' && actor.id !== friend.id);
      battle = moveActorToCell(battle, allyActor.id, ally[0], ally[1]);
    }
  }
  return { battle, friend, monster };
}

const shoot = (battle, friend, monster, random) => attack(battle, {
  attackerId: friend.id, targetId: monster.id, attackBonus: 7, damageExpression: '1d8+3', damageType: '穿刺', range: 'ranged',
}, { random });

test('敌人贴身时远程攻击具有劣势', () => {
  const { battle, friend, monster } = setup({ enemy: [2, 1] });
  const result = shoot(battle, friend, monster, sequence(0.9, 0.1));
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.equal(result.outcome.natural, 3);
  assert.ok(result.outcome.notes.some(note => note.includes('敌人贴身')));
});

test('敌人不在 5 尺内时不受影响', () => {
  const { battle, friend, monster } = setup({ enemy: [3, 1] });
  const result = shoot(battle, friend, monster, sequence(0.9, 0.1));
  assert.equal(result.outcome.mode, 'normal');
  assert.equal(result.outcome.natural, 19);
});

test('近战攻击不受该规则影响', () => {
  const { battle, friend, monster } = setup({ enemy: [2, 1] });
  const result = attack(battle, {
    attackerId: friend.id, targetId: monster.id, attackBonus: 7, damageExpression: '1d8+3', damageType: '穿刺', range: 'melee',
  }, { random: sequence(0.9, 0.1) });
  assert.equal(result.outcome.mode, 'normal');
  assert.equal(result.outcome.natural, 19);
});

test('未启用方格战场时不做判定', () => {
  const { battle, friend, monster } = setup({ grid: false });
  const result = shoot(battle, friend, monster, sequence(0.9, 0.1));
  assert.equal(result.outcome.mode, 'normal');
});

test('贴身的只是友方时不产生劣势', () => {
  const { battle, friend, monster } = setup({ enemy: [4, 1], ally: [2, 1] });
  const result = shoot(battle, friend, monster, sequence(0.9, 0.1));
  assert.equal(result.outcome.mode, 'normal');
});
