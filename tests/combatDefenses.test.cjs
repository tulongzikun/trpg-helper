const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, setDamageDefenses, damageActor } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `defense-${++counter}`;

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '抗性', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  let battle = structuredClone(store.battles[0]);
  battle = structuredClone(startCombat(battle, Object.fromEntries(battle.actors.map(actor => [actor.id, 10]))));
  return { battle, foe: battle.actors[0] };
}

const hpOf = battle => battle.actors[0].currentHp;

test('设置抗性后同类型伤害减半', () => {
  const { battle, foe } = setup();
  const base = hpOf(battle);
  const plain = damageActor(structuredClone(battle), foe.id, 4, '火焰').battle;
  assert.equal(hpOf(plain), base - 4);
  const guarded = setDamageDefenses(battle, foe.id, 'resistances', ['火焰']);
  const halved = damageActor(structuredClone(guarded), foe.id, 4, '火焰').battle;
  assert.equal(hpOf(halved), base - 2);
  assert.match(guarded.combat.log.map(item => item.text).join('\n'), /获得抗性：火焰/);
});

test('免疫让该类型伤害归零', () => {
  const { battle, foe } = setup();
  const base = hpOf(battle);
  const immune = setDamageDefenses(battle, foe.id, 'immunities', ['火焰']);
  const result = damageActor(structuredClone(immune), foe.id, 4, '火焰').battle;
  assert.equal(hpOf(result), base);
  assert.equal(result.actors[0].combat.status, 'active');
});

test('易伤让该类型伤害加倍', () => {
  const { battle, foe } = setup();
  const base = hpOf(battle);
  const weak = setDamageDefenses(battle, foe.id, 'vulnerabilities', ['火焰']);
  const result = damageActor(structuredClone(weak), foe.id, 3, '火焰').battle;
  assert.equal(hpOf(result), base - 6);
});

test('抗性与易伤同时存在时互相抵消', () => {
  const { battle, foe } = setup();
  const base = hpOf(battle);
  const both = setDamageDefenses(setDamageDefenses(battle, foe.id, 'resistances', ['火焰']), foe.id, 'vulnerabilities', ['火焰']);
  const result = damageActor(structuredClone(both), foe.id, 6, '火焰').battle;
  assert.equal(hpOf(result), base - 6);
});

test('伤害类型名可带「伤害」后缀，重复项会去重', () => {
  const { battle, foe } = setup();
  const guarded = setDamageDefenses(battle, foe.id, 'resistances', ['火焰伤害', '火焰', '寒冷']);
  const state = guarded.actors[0].combat;
  assert.deepEqual(state.damageResistances, ['火焰', '寒冷']);
  const base = hpOf(battle);
  assert.equal(hpOf(damageActor(structuredClone(guarded), foe.id, 4, '火焰').battle), base - 2);
  assert.equal(hpOf(damageActor(structuredClone(guarded), foe.id, 4, '寒冷').battle), base - 2);
});

test('传空数组清除、未知类型报错', () => {
  const { battle, foe } = setup();
  const guarded = setDamageDefenses(battle, foe.id, 'resistances', ['火焰']);
  const cleared = setDamageDefenses(guarded, foe.id, 'resistances', []);
  assert.equal(cleared.actors[0].combat.damageResistances, undefined);
  assert.match(cleared.combat.log.map(item => item.text).join('\n'), /的抗性已清除/);
  assert.throws(() => setDamageDefenses(battle, foe.id, 'immunities', ['圣光']), /不认识的伤害类型/);
});
