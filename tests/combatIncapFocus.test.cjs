const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, castBless, castHoldPerson, castSleep, castPolymorph, castSleepCloud, configureGrid, attack } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `incap-${++counter}`;
const seq = values => () => values.shift() ?? 0.5;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '失能中断专注', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const caster = battle.actors[0];
  caster.name = '敌法师';
  caster.position = { x: 0, y: 0 };
  const ally = { ...structuredClone(caster), id: 'foe-ally', name: '敌兵', position: { x: 0, y: 1 } };
  ally.combat = undefined;
  const hero = { ...structuredClone(caster), id: 'hero-1', name: '英雄', side: '友方', position: { x: 0, y: 1 } };
  hero.combat = undefined;
  battle.actors = [caster, ally, hero];
  battle = structuredClone(startCombat(battle, { [caster.id]: 20, 'foe-ally': 10, 'hero-1': 5 }));
  battle = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  return { battle, casterId: caster.id, allyId: 'foe-ally', heroId: 'hero-1' };
}

// 敌法师先施祝福（建立专注），然后把回合交给英雄并清掉英雄的动作消耗。
function blessFirst(battle, casterId, allyId, heroId) {
  const turn = structuredClone(battle);
  turn.combat.turnIndex = turn.combat.order.indexOf(casterId);
  const blessed = castBless(turn, casterId, [allyId]);
  const ready = structuredClone(blessed);
  ready.combat.turnIndex = ready.combat.order.indexOf(heroId);
  const hero = ready.actors.find(actor => actor.id === heroId);
  hero.combat.actionUsed = false;
  hero.combat.bonusUsed = false;
  hero.combat.reactionUsed = false;
  return ready;
}

const textsOf = battle => (battle.combat?.log ?? []).map(item => item.text);
const actorOf = (battle, id) => battle.actors.find(actor => actor.id === id);

test('被定身术麻痹时中断专注并解除祝福', () => {
  const { battle, casterId, allyId, heroId } = setup();
  const ready = blessFirst(battle, casterId, allyId, heroId);
  const held = castHoldPerson(ready, heroId, casterId, { random: seq([0.02, 0.02]) });
  assert.equal(actorOf(held, casterId).combat.concentration, undefined);
  assert.equal(actorOf(held, allyId).combat.blessed, undefined);
  assert.ok(textsOf(held).some(text => /被定身麻痹，专注的祝福术中断/.test(text)));
});

test('陷入沉睡时中断专注', () => {
  const { battle, casterId, allyId, heroId } = setup();
  const ready = blessFirst(battle, casterId, allyId, heroId);
  const slept = castSleep(ready, heroId, [casterId], { random: seq(Array(20).fill(0.95)) });
  assert.equal(actorOf(slept.battle, casterId).combat.sleeping, true);
  assert.equal(actorOf(slept.battle, casterId).combat.concentration, undefined);
  assert.ok(textsOf(slept.battle).some(text => /陷入沉睡，专注的祝福术中断/.test(text)));
});

test('被变成小兽而失能时中断专注', () => {
  const { battle, casterId, allyId, heroId } = setup();
  const ready = blessFirst(battle, casterId, allyId, heroId);
  const shaped = castPolymorph(ready, heroId, casterId, { random: seq([0.02, 0.02]) });
  assert.equal(actorOf(shaped.battle, casterId).combat.concentration, undefined);
  assert.ok(textsOf(shaped.battle).some(text => /被变成小兽而失能，专注的祝福术中断/.test(text)));
});

test('被非致命攻击打倒时中断专注', () => {
  const { battle, casterId, allyId, heroId } = setup();
  const ready = blessFirst(battle, casterId, allyId, heroId);
  const struck = attack(ready, {
    attackerId: heroId,
    targetId: casterId,
    attackBonus: 20,
    damageExpression: '20d10',
    damageType: '挥砍',
    range: 'melee',
    nonLethal: true,
  }, { random: seq(Array(10).fill(0.9)) });
  assert.equal(struck.outcome.hit, true);
  assert.equal(actorOf(struck.battle, casterId).combat.status, 'down');
  assert.equal(actorOf(struck.battle, casterId).combat.concentration, undefined);
  assert.ok(textsOf(struck.battle).some(text => /失去意识，专注的祝福术中断/.test(text)));
});

test('睡眠云让专注者沉睡时同样中断', () => {
  const { battle, casterId, allyId, heroId } = setup();
  const ready = blessFirst(battle, casterId, allyId, heroId);
  const cloud = castSleepCloud(ready, heroId, [{ x: 0, y: 0 }], { random: seq([0.02, 0.02]) });
  assert.equal(actorOf(cloud, casterId).combat.sleeping, true);
  assert.equal(actorOf(cloud, casterId).combat.concentration, undefined);
});

test('没有专注的单位失去意识时不会产生中断日志', () => {
  const { battle, allyId, heroId } = setup();
  const ready = structuredClone(battle);
  ready.combat.turnIndex = ready.combat.order.indexOf(heroId);
  ready.actors.find(actor => actor.id === heroId).combat.actionUsed = false;
  const hit = attack(ready, {
    attackerId: 'hero-1',
    targetId: allyId,
    attackBonus: 20,
    damageExpression: '20d10',
    damageType: '挥砍',
    range: 'melee',
    nonLethal: true,
  }, { random: seq(Array(10).fill(0.9)) });
  assert.ok(!textsOf(hit.battle).some(text => /专注的/.test(text)));
});
