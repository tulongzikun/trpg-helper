const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, readyAction, endTurn } = require('../apps/web/src/combat.ts');
const { battleReport, readyOf } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `report-ready-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '准备战报', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const foe = battle.actors[0];
  foe.position = { x: 0, y: 0 };
  const hero = { ...structuredClone(foe), id: 'hero-1', name: '英雄', side: '友方', position: { x: 0, y: 3 } };
  hero.combat = undefined;
  battle.actors.push(hero);
  battle = structuredClone(startCombat(battle, { [foe.id]: 20, 'hero-1': 10 }));
  return { battle, foeId: foe.id };
}

test('准备动作会出现在战报的准备动作小节里', () => {
  const { battle, foeId } = setup();
  const ready = readyAction(battle, foeId, { action: '攻击靠近的敌人', trigger: '有人进入 5 尺' });
  const report = battleReport(ready);
  assert.match(report, /## 准备动作/);
  assert.match(report, /准备「攻击靠近的敌人」（触发：有人进入 5 尺）/);
});

test('没有准备动作时整个小节省略', () => {
  const { battle } = setup();
  assert.doesNotMatch(battleReport(battle), /## 准备动作/);
});

test('readyOf 在没有准备时返回空串', () => {
  const { battle } = setup();
  assert.equal(readyOf(battle.actors[0]), '');
});

test('缺少触发条件时只写动作', () => {
  const { battle, foeId } = setup();
  const ready = structuredClone(battle);
  ready.actors.find(actor => actor.id === foeId).combat.ready = { action: '射击', trigger: '' };
  assert.equal(readyOf(ready.actors.find(actor => actor.id === foeId)), '准备「射击」');
});

test('反应已用会在摘要里标出', () => {
  const { battle, foeId } = setup();
  const ready = readyAction(battle, foeId, { action: '攻击靠近的敌人', trigger: '有人进入 5 尺' });
  const cloned = structuredClone(ready);
  cloned.actors.find(actor => actor.id === foeId).combat.reactionUsed = true;
  assert.match(readyOf(cloned.actors.find(actor => actor.id === foeId)), /反应已用/);
});

test('多个单位的准备动作按出场顺序列出', () => {
  const { battle, foeId } = setup();
  const ready = structuredClone(readyAction(battle, foeId, { action: '攻击靠近的敌人', trigger: '有人进入 5 尺' }));
  const hero = ready.actors.find(actor => actor.id === 'hero-1');
  hero.combat = { ...(hero.combat ?? {}), status: 'active', conditions: [], ready: { action: '掩护射击', trigger: '敌人进入 30 尺' } };
  const report = battleReport(ready);
  const foeLine = report.indexOf('攻击靠近的敌人');
  const heroLine = report.indexOf('掩护射击');
  assert.ok(foeLine > -1 && heroLine > -1 && foeLine < heroLine);
  assert.equal(endTurn(ready, { random: () => 0.5 }).combat.round >= 1, true);
});
