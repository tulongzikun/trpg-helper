const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, moveActorToCell, setActorHp, saveAttackPreset, attackWithPreset } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `rt-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '改打', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const enemies = base.actors.map((item, index) => ({ ...item, id: `foe${index}`, name: `敌${index}`, currentHp: 60, maxHp: 60 }));
  const hero = { ...enemies[0], id: 'hero', name: '艾拉', side: '友方', currentHp: 60, maxHp: 60 };
  let battle = configureGrid({ ...base, actors: [hero, ...enemies] }, { width: 12, height: 8, cellFt: 5 });
  battle = startCombat(battle, { hero: 20, foe0: 10, foe1: 5 });
  battle = moveActorToCell(battle, 'hero', 0, 0);
  battle = moveActorToCell(battle, 'foe0', 1, 0);
  battle = moveActorToCell(battle, 'foe1', 5, 0);
  return battle;
}

function preset(battle, targetId, name = '长剑') {
  return saveAttackPreset(battle, { name, attackerId: 'hero', targetId, attackBonus: 7, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee' }, ids());
}

test('目标仍可攻击时按原目标结算', () => {
  const battle = setup();
  const saved = preset(battle, 'foe0');
  const result = attackWithPreset(saved.battle, saved.presetId, { random: () => 0.9 });
  assert.equal(result.targetId, 'foe0');
  const foe0 = result.battle.actors.find(item => item.id === 'foe0');
  assert.ok(foe0.currentHp < 60);
});

test('目标已经死亡时改打最近的敌对单位', () => {
  const battle = setup();
  const saved = preset(battle, 'foe1');
  const dead = setActorHp(saved.battle, 'foe1', 0);
  const result = attackWithPreset(dead, saved.presetId, { random: () => 0.9 });
  assert.equal(result.targetId, 'foe0');
  const foe0 = result.battle.actors.find(item => item.id === 'foe0');
  assert.ok(foe0.currentHp < 60);
});

test('没有可攻击目标时报错', () => {
  const battle = setup();
  const saved = preset(battle, 'foe0');
  const cleared = setActorHp(setActorHp(saved.battle, 'foe0', 0), 'foe1', 0);
  assert.throws(() => attackWithPreset(cleared, saved.presetId), /没有可以攻击的目标。/);
});

test('攻击者离场或预设不存在时报错', () => {
  const battle = setup();
  const saved = preset(battle, 'foe0');
  const withoutHero = { ...saved.battle, actors: saved.battle.actors.filter(item => item.id !== 'hero') };
  assert.throws(() => attackWithPreset(withoutHero, saved.presetId), /该常用攻击的攻击者不在战斗中。/);
  assert.throws(() => attackWithPreset(saved.battle, 'missing'), /该常用攻击不存在。/);
});
