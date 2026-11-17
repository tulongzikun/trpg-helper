const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { endTurn, setActorHp, setAutoDeathSaves, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-death-save', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '死亡豁免', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(withHero, initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  return { battle: started, friend };
}

test('开启后倒地的角色在回合开始时自动掷死亡豁免', () => {
  const { battle, friend } = setup();
  const prepared = setAutoDeathSaves(setActorHp(battle, friend.id, 0), true);
  assert.equal(prepared.autoDeathSaves, true);
  const afterMonster = endTurn(prepared, { random: sequence(0.55) });
  const afterHero = endTurn(afterMonster, { random: sequence(0.55) });
  const downed = afterHero.actors.find(actor => actor.id === friend.id);
  assert.equal(downed.combat.status, 'down');
  assert.equal(downed.combat.deathSaves.successes, 1);
  assert.ok(afterHero.combat.log.some(item => item.text.includes('死亡豁免 d20(12)')), 'missing death save log');
});

test('未开启时不自动掷死亡豁免', () => {
  const { battle, friend } = setup();
  const prepared = setActorHp(battle, friend.id, 0);
  const afterMonster = endTurn(prepared);
  const afterHero = endTurn(afterMonster);
  const downed = afterHero.actors.find(actor => actor.id === friend.id);
  assert.equal(downed.combat.deathSaves.successes, 0);
  assert.equal(downed.combat.deathSaves.failures, 0);
  assert.equal(afterHero.combat.log.some(item => item.text.includes('死亡豁免')), false);
});

test('连续三次失败后自动判定死亡', () => {
  const { battle, friend } = setup();
  let current = setAutoDeathSaves(setActorHp(battle, friend.id, 0), true);
  for (let round = 0; round < 3; round += 1) current = endTurn(endTurn(current, { random: sequence(0.2) }), { random: sequence(0.2) });
  const downed = current.actors.find(actor => actor.id === friend.id);
  assert.equal(downed.combat.status, 'dead');
  assert.equal(downed.combat.deathSaves.failures, 3);
});

test('掷出 20 时自动恢复 1 点生命值并起身', () => {
  const { battle, friend } = setup();
  const prepared = setAutoDeathSaves(setActorHp(battle, friend.id, 0), true);
  const afterMonster = endTurn(prepared, { random: sequence(0.99) });
  const afterHero = endTurn(afterMonster, { random: sequence(0.99) });
  const revived = afterHero.actors.find(actor => actor.id === friend.id);
  assert.equal(revived.currentHp, 1);
  assert.equal(revived.combat.status, 'active');
  assert.ok(afterHero.combat.log.some(item => item.text.includes('恢复 1 点生命值')));
});

test('开关可关闭并记录日志', () => {
  const { battle } = setup();
  const on = setAutoDeathSaves(battle, true);
  assert.ok(on.combat.log.at(-1).text.includes('已开启'));
  assert.equal(on.autoDeathSaves, true);
  const off = setAutoDeathSaves(on, false);
  assert.equal(off.autoDeathSaves, undefined);
  assert.ok(off.combat.log.at(-1).text.includes('已关闭'));
});
