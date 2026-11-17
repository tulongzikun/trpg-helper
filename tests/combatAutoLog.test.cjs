const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, currentActorId } = require('../apps/web/src/combat.ts');
const { autoAct, autoTurn } = require('../apps/web/src/combatAuto.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `auto-log-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '自动日志', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  for (const actor of battle.actors) actor.position = { x: 4, y: 4 };
  const hero = { ...structuredClone(battle.actors[0]), id: 'hero-1', name: '英雄', side: '友方' };
  hero.combat = undefined;
  hero.position = { x: 3, y: 4 };
  battle.actors.push(hero);
  battle = structuredClone(startCombat(battle, Object.fromEntries(battle.actors.map(actor => [actor.id, actor.id === 'hero-1' ? 20 : 10]))));
  battle = configureGrid(battle, { width: 12, height: 12, cellFt: 5 });
  const foeId = battle.actors.find(actor => actor.id !== 'hero-1').id;
  return { battle, heroId: 'hero-1', foeId };
}

test('自动攻击会把理由写进战报', () => {
  const { battle, heroId } = setup();
  const action = autoAct(battle, heroId, { random: () => 0.5 });
  assert.equal(action.kind, 'attack');
  const texts = action.battle.combat.log.map(item => item.text);
  assert.ok(texts.some(text => text.startsWith('自动行动：攻击')), texts.join(' | '));
});

test('自动移动会把理由写进战报', () => {
  const created = addMonsters(emptyStore(), card, { newBattleName: '自动移动', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const foePosition = structuredClone(battle.actors[0].position);
  for (const actor of battle.actors) actor.position = { x: 0, y: 0 };
  const hero = { ...structuredClone(battle.actors[0]), id: 'hero-1', name: '英雄', side: '友方' };
  hero.combat = undefined;
  hero.position = { x: 0, y: 1 };
  battle.actors.push(hero);
  battle = structuredClone(startCombat(battle, Object.fromEntries(battle.actors.map(actor => [actor.id, actor.id === 'hero-1' ? 20 : 10]))));
  battle = configureGrid(battle, { width: 12, height: 12, cellFt: 5 });
  battle.actors.find(actor => actor.id !== 'hero-1').position = { x: 2, y: 0 };
  const action = autoAct(battle, 'hero-1', { random: () => 0.5 });
  assert.ok(action.kind === 'move' || action.kind === 'attack');
  const texts = action.battle.combat.log.map(item => item.text);
  assert.ok(texts.some(text => text.startsWith('自动行动：')), texts.join(' | '));
});

test('无事可做时不写日志也不改动战斗对象', () => {
  const { battle, heroId, foeId } = setup();
  const quiet = structuredClone(battle);
  const foe = quiet.actors.find(actor => actor.id === foeId);
  foe.combat.status = 'dead';
  foe.currentHp = 0;
  const before = quiet.combat.log.length;
  const action = autoAct(quiet, heroId, { random: () => 0.5 });
  assert.equal(action.kind, 'wait');
  assert.equal(action.battle, quiet);
  assert.equal(quiet.combat.log.length, before);
});

test('自动整轮把每一步都写进战报', () => {
  const { battle, heroId } = setup();
  const turn = autoTurn(battle, heroId, { random: () => 0.5 });
  const texts = turn.battle.combat.log.map(item => item.text);
  const autoLines = texts.filter(text => text.startsWith('自动行动：'));
  assert.ok(autoLines.length >= 1, autoLines.join(' | '));
  assert.ok(turn.steps.every(step => step.startsWith('自动行动：')));
  assert.ok(turn.steps.some(step => step.includes('结束回合')));
});

test('自动行动日志出现在对应轮次，且不影响战报顺序', () => {
  const { battle, heroId } = setup();
  const turn = autoTurn(battle, heroId, { random: () => 0.5 });
  const log = turn.battle.combat.log;
  assert.ok(log.some(item => item.text.startsWith('自动行动：')));
  const rounds = log.map(item => item.round);
  assert.deepEqual(rounds, [...rounds].sort((a, b) => a - b));
  assert.equal(currentActorId(turn.battle) !== heroId, true);
});
