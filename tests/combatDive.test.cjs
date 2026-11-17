const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, diveAttack, moveActorToCell, setElevation, setFlying, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const duelist = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-dive', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 44, armorClass: 17, speedFt: 30, saveProficiencies: [],
    actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: { equipment: '长剑' },
  },
};

function setup(monsterCell = [2, 1]) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '俯冲', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, duelist, { battleId: battle.id, side: '友方' }, ids());
  const initiatives = {};
  added.store.battles[0].actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  let started = startCombat(added.store.battles[0], initiatives);
  started = configureGrid(started, { width: 12, height: 10, cellFt: 5 });
  const friend = started.actors.find(actor => actor.side === '友方');
  const monster = started.actors.find(actor => actor.side === '敌方');
  started = moveActorToCell(started, friend.id, 1, 1);
  started = moveActorToCell(started, monster.id, monsterCell[0], monsterCell[1]);
  return { battle: started, friend, monster };
}

const strike = (battle, friend, monster, random) => diveAttack(battle, {
  attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee',
}, { random });

test('从 20 尺高空俯冲获得优势，命中后落地并失去飞行', () => {
  const { battle, friend, monster } = setup();
  const flying = setFlying(setElevation(battle, friend.id, 20), friend.id, true);
  const result = strike(flying, friend, monster, sequence(0.9, 0.1));
  assert.equal(result.outcome.mode, 'advantage');
  assert.equal(result.outcome.natural, 19);
  assert.ok(result.outcome.notes.includes('俯冲攻击：攻击检定优势，落地后失去飞行'));
  const landed = result.battle.actors.find(actor => actor.id === friend.id);
  assert.equal(landed.combat.flying, false);
  assert.equal(landed.elevation, undefined);
  assert.match(result.battle.combat.log.at(-1).text, /俯冲落地/);
});

test('没有飞行状态时不能俯冲', () => {
  const { battle, friend, monster } = setup();
  const lifted = setElevation(battle, friend.id, 20);
  assert.throws(() => strike(lifted, friend, monster, sequence(0.5)), /只有飞行中的单位可以俯冲攻击。/);
});

test('高度不足 10 尺时不能俯冲', () => {
  const { battle, friend, monster } = setup();
  const low = setFlying(setElevation(battle, friend.id, 5), friend.id, true);
  assert.throws(() => strike(low, friend, monster, sequence(0.5)), /俯冲需要至少 10 尺的高度。/);
});

test('俯冲落地后普通攻击不再获得优势', () => {
  const { battle, friend, monster } = setup();
  const flying = setFlying(setElevation(battle, friend.id, 20), friend.id, true);
  const dived = strike(flying, friend, monster, sequence(0.9, 0.1)).battle;
  const next = attack(dived, {
    attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', cost: 'bonus',
  }, { random: sequence(0.5) });
  assert.equal(next.outcome.mode, 'normal');
});

test('俯冲仍受近战触及范围限制', () => {
  const { battle, friend, monster } = setup([6, 1]);
  const flying = setFlying(setElevation(battle, friend.id, 20), friend.id, true);
  assert.throws(() => strike(flying, friend, monster, sequence(0.5)), /超出近战触及范围/);
});
