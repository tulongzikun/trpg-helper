const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, moveActorToCell, setElevation, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const archer = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-elevation', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '游侠', level: 5,
    abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, saveProficiencies: [],
    actions: '短弓：+7 命中，1d8+3 穿刺伤害，射程 80/320 尺', notes: '', details: { equipment: '短弓' },
  },
};
const duellist = {
  ...archer,
  characterId: 'char-elevation-melee',
  sheet: {
    ...archer.sheet,
    actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺',
    details: { equipment: '长剑' },
  },
};

function setup(snapshot = archer, enemyCell = [6, 1]) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '高低差', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, snapshot, { battleId: battle.id, side: '友方' }, ids());
  const initiatives = {};
  added.store.battles[0].actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  let started = startCombat(added.store.battles[0], initiatives);
  started = configureGrid(started, { width: 20, height: 10, cellFt: 5 });
  const friend = started.actors.find(actor => actor.side === '友方');
  const monster = started.actors.find(actor => actor.side === '敌方');
  started = moveActorToCell(started, friend.id, 1, 1);
  started = moveActorToCell(started, monster.id, enemyCell[0], enemyCell[1]);
  return { battle: started, friend, monster };
}

const shoot = (battle, friend, monster, random) => attack(battle, {
  attackerId: friend.id, targetId: monster.id, attackBonus: 7, damageExpression: '1d8+3', damageType: '穿刺', range: 'ranged',
}, { random });

test('从 20 尺高处射击获得优势，取两次中较高的一次', () => {
  const { battle, friend, monster } = setup();
  const lifted = setElevation(battle, friend.id, 20);
  const result = shoot(lifted, friend, monster, sequence(0.9, 0.1));
  assert.equal(result.outcome.mode, 'advantage');
  assert.equal(result.outcome.natural, 19);
  assert.ok(result.outcome.notes.includes('从高处（高 20 尺）射击：攻击检定优势'));
});

test('同高度射击按正常检定结算', () => {
  const { battle, friend, monster } = setup();
  const result = shoot(battle, friend, monster, sequence(0.5));
  assert.equal(result.outcome.mode, 'normal');
  assert.equal(result.outcome.natural, 11);
});

test('仰射 20 尺高的目标具有劣势', () => {
  const { battle, friend, monster } = setup();
  const lifted = setElevation(battle, monster.id, 20);
  const result = shoot(lifted, friend, monster, sequence(0.9, 0.1));
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.equal(result.outcome.natural, 3);
  assert.ok(result.outcome.notes.includes('仰射高处目标（低 20 尺）：攻击检定劣势'));
});

test('高低差只影响远程攻击，近战不受影响', () => {
  const { battle, friend, monster } = setup(duellist, [2, 1]);
  const lifted = setElevation(battle, friend.id, 30);
  const result = attack(lifted, {
    attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee',
  }, { random: sequence(0.5) });
  assert.equal(result.outcome.mode, 'normal');
});

test('高度须为 0 至 500 尺的整数，设为 0 会清除高度并记录日志', () => {
  const { battle, friend } = setup();
  assert.throws(() => setElevation(battle, friend.id, -1), /高度须为 0 至 500 尺的整数。/);
  assert.throws(() => setElevation(battle, friend.id, 501), /高度须为 0 至 500 尺的整数。/);
  assert.throws(() => setElevation(battle, friend.id, 2.5), /高度须为 0 至 500 尺的整数。/);
  const lifted = setElevation(battle, friend.id, 15);
  assert.equal(lifted.actors.find(actor => actor.id === friend.id).elevation, 15);
  assert.match(lifted.combat.log.at(-1).text, /的高度设为 15 尺/);
  const grounded = setElevation(lifted, friend.id, 0);
  assert.equal(grounded.actors.find(actor => actor.id === friend.id).elevation, undefined);
  assert.match(grounded.combat.log.at(-1).text, /回到地面/);
});
