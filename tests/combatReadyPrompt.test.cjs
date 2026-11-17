const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, moveActorToCell, endTurn, readyAction, pendingOpportunities, resolveReadyPrompt, declineOpportunity, currentActorId } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `rp-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '准备', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const enemy = base.actors[0];
  const ally = { ...enemy, id: 'ally', name: '艾拉', side: '友方', template: { ...enemy.template, armorClass: 16, hitPoints: { ...enemy.template.hitPoints, average: 40 } } };
  let battle = configureGrid({ ...base, actors: [ally, enemy] }, { width: 10, height: 6, cellFt: 5 });
  battle = startCombat(battle, { ally: 20, [enemy.id]: 5 });
  battle = moveActorToCell(battle, 'ally', 1, 1);
  battle = moveActorToCell(battle, enemy.id, 5, 1);
  return { battle, allyId: 'ally', enemyId: enemy.id };
}

test('准备好的攻击动作在敌人进入触及范围时排入待结算', () => {
  const { battle, allyId, enemyId } = setup();
  const prepared = readyAction(battle, allyId, { action: '攻击', trigger: '有敌人靠近' });
  assert.equal(prepared.actors.find(item => item.id === allyId).combat.ready.action, '攻击');
  const enemyTurn = endTurn(prepared);
  assert.equal(currentActorId(enemyTurn), enemyId);
  const moved = moveActorToCell(enemyTurn, enemyId, 2, 1);
  const prompts = pendingOpportunities(moved);
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].kind, 'ready');
  assert.equal(prompts[0].reactorId, allyId);
  assert.ok(moved.combat.log.some(item => item.text.includes('触发了') && item.text.includes('准备好的「攻击」')));
});

test('结算准备动作提示会消耗反应并清除提示', () => {
  const { battle, allyId, enemyId } = setup();
  const prepared = readyAction(battle, allyId, { action: '攻击', trigger: '有敌人靠近' });
  const moved = moveActorToCell(endTurn(prepared), enemyId, 2, 1);
  const resolved = resolveReadyPrompt(moved, allyId);
  const ally = resolved.actors.find(item => item.id === allyId);
  assert.equal(ally.combat.reactionUsed, true);
  assert.equal(ally.combat.ready, undefined);
  assert.equal(pendingOpportunities(resolved).length, 0);
  assert.ok(resolved.combat.log.some(item => item.text.includes('用反应执行准备好的「攻击」')));
});

test('放弃准备动作提示会记录日志且不消耗反应', () => {
  const { battle, allyId, enemyId } = setup();
  const prepared = readyAction(battle, allyId, { action: '攻击', trigger: '有敌人靠近' });
  const moved = moveActorToCell(endTurn(prepared), enemyId, 2, 1);
  const declined = declineOpportunity(moved, allyId);
  const ally = declined.actors.find(item => item.id === allyId);
  assert.equal(ally.combat.reactionUsed, false);
  assert.ok(declined.combat.log.some(item => item.text.includes('放弃准备好的动作')));
});

test('非攻击性的准备动作不会自动排入提示', () => {
  const { battle, allyId, enemyId } = setup();
  const prepared = readyAction(battle, allyId, { action: '喝下药水', trigger: '受伤时' });
  const moved = moveActorToCell(endTurn(prepared), enemyId, 2, 1);
  assert.equal(pendingOpportunities(moved).length, 0);
});

test('同样场景下离开触及仍然生成借机攻击提示', () => {
  const { battle, allyId, enemyId } = setup();
  const adjacent = moveActorToCell(endTurn(battle), enemyId, 2, 1);
  const backToEnemy = endTurn(endTurn(adjacent));
  const away = moveActorToCell(backToEnemy, enemyId, 6, 1);
  const prompts = pendingOpportunities(away);
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].kind, undefined);
  assert.equal(prompts[0].reactorId, allyId);
});
