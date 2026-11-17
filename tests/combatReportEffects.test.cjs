const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat } = require('../apps/web/src/combat.ts');
const { battleReport, effectsOf } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `report-effects-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '状态战报', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const foe = battle.actors[0];
  foe.position = { x: 0, y: 0 };
  battle = structuredClone(startCombat(battle, { [foe.id]: 20 }));
  return { battle, foeId: foe.id };
}

test('没有状态时返回空数组，战报不出现状态小节', () => {
  const { battle } = setup();
  assert.deepEqual(effectsOf(battle.actors[0]), []);
  assert.doesNotMatch(battleReport(battle), /## 状态/);
});

test('轮数类状态带剩余轮数', () => {
  const { battle, foeId } = setup();
  const cloned = structuredClone(battle);
  const state = cloned.actors.find(actor => actor.id === foeId).combat;
  state.blessed = 10;
  state.slowed = 3;
  const parts = effectsOf(cloned.actors.find(actor => actor.id === foeId));
  assert.deepEqual(parts, ['祝福（10 轮）', '缓慢（3 轮）']);
});

test('布尔类状态没有轮数', () => {
  const { battle, foeId } = setup();
  const cloned = structuredClone(battle);
  const state = cloned.actors.find(actor => actor.id === foeId).combat;
  state.entangled = true;
  state.suppressed = true;
  state.aimed = true;
  state.commanded = 'halt';
  assert.deepEqual(effectsOf(cloned.actors.find(actor => actor.id === foeId)), ['命令：停止', '被藤蔓缠住', '被压制', '瞄准']);
});

test('护盾与援助显示数值', () => {
  const { battle, foeId } = setup();
  const cloned = structuredClone(battle);
  const state = cloned.actors.find(actor => actor.id === foeId).combat;
  state.shield = 5;
  state.aided = 5;
  assert.deepEqual(effectsOf(cloned.actors.find(actor => actor.id === foeId)), ['护盾（AC +5）', '援助（生命上限 +5）']);
});

test('零轮数视为已结束，不出现在列表里', () => {
  const { battle, foeId } = setup();
  const cloned = structuredClone(battle);
  const state = cloned.actors.find(actor => actor.id === foeId).combat;
  state.blessed = 0;
  state.polymorphed = 0;
  assert.deepEqual(effectsOf(cloned.actors.find(actor => actor.id === foeId)), []);
});

test('战报的状态小节列出每个有状态单位', () => {
  const { battle, foeId } = setup();
  const cloned = structuredClone(battle);
  const foe = cloned.actors.find(actor => actor.id === foeId);
  foe.combat.blessed = 10;
  foe.combat.paralyzed = 2;
  const report = battleReport(cloned);
  assert.match(report, /## 状态/);
  assert.match(report, new RegExp(`${foe.name}：祝福（10 轮）、麻痹（2 轮）`));
});
