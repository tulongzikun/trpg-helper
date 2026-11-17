const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { addOngoingEffect, endTurn, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-regen', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '牧师', level: 5,
    abilities: { str: 12, dex: 12, con: 14, int: 10, wis: 16, cha: 10 },
    maxHp: 40, armorClass: 16, speedFt: 30, saveProficiencies: [],
    actions: '长棍：+4 命中，1d6+2 钝击伤害，触及 5 尺', notes: '', details: { equipment: '长棍' },
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '再生', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const initiatives = {};
  added.store.battles[0].actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(added.store.battles[0], initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  return { battle: started, friend };
}

test('持续效果在结算时机按治疗骰恢复生命值', () => {
  const { battle, friend } = setup();
  const hurt = { ...battle, actors: battle.actors.map(actor => actor.id === friend.id ? { ...actor, currentHp: 20 } : actor) };
  const added = addOngoingEffect(hurt, friend.id, { name: '再生', damageExpression: '1d4', damageType: '火焰', healExpression: '1d8' }, { random: sequence(0, 0.5) });
  assert.equal(added.battle.combat.log.at(-1).detail.includes('同一时机恢复 1d8 点生命值'), true);
  const wounded = added.battle.actors.find(actor => actor.id === friend.id);
  assert.equal(wounded.currentHp, 20);
});

test('结算时先受伤再回血，并写入恢复日志', () => {
  const { battle, friend } = setup();
  const hurt = { ...battle, actors: battle.actors.map(actor => actor.id === friend.id ? { ...actor, currentHp: 20 } : actor) };
  const added = addOngoingEffect(hurt, friend.id, { name: '再生', damageExpression: '1d4', damageType: '火焰', healExpression: '1d8' }, { random: sequence(0, 0.1) });
  const next = endTurn(endTurn(added.battle, { random: sequence(0, 0.1) }), { random: sequence(0, 0.1) });
  const healed = next.actors.find(actor => actor.id === friend.id);
  assert.equal(healed.currentHp, 20, '1d4 掷出 1、1d8 掷出 1，净变化为 0');
  assert.ok(next.combat.log.some(item => item.text.includes('「再生」') && item.text.includes('造成')));
  assert.ok(next.combat.log.some(item => item.text.includes('「再生」') && item.text.includes('恢复')));
});

test('恢复量不会超过生命值上限', () => {
  const { battle, friend } = setup();
  const hurt = { ...battle, actors: battle.actors.map(actor => actor.id === friend.id ? { ...actor, currentHp: 38 } : actor) };
  const added = addOngoingEffect(hurt, friend.id, { name: '再生', damageExpression: '1d4', damageType: '火焰', healExpression: '1d8' }, { random: sequence(0, 0.9) });
  const next = endTurn(endTurn(added.battle, { random: sequence(0, 0.9) }), { random: sequence(0, 0.9) });
  const healed = next.actors.find(actor => actor.id === friend.id);
  assert.equal(healed.currentHp, healed.maxHp);
});

test('治疗骰格式非法时拒绝添加', () => {
  const { battle, friend } = setup();
  assert.throws(() => addOngoingEffect(battle, friend.id, { name: '再生', damageExpression: '1d4', damageType: '火焰', healExpression: 'abc' }), /伤害骰格式无效/);
});

test('只记录治疗骰的效果也能生效（伤害骰为 0 点时仅回血）', () => {
  const { battle, friend } = setup();
  const hurt = { ...battle, actors: battle.actors.map(actor => actor.id === friend.id ? { ...actor, currentHp: 20 } : actor) };
  const added = addOngoingEffect(hurt, friend.id, { name: '祝福', damageExpression: '1d4', damageType: '火焰', healExpression: '1d8', timing: 'end' }, { random: sequence(0, 0.1) });
  const still = added.battle.actors.find(actor => actor.id === friend.id);
  assert.equal(still.currentHp, 20);
});
