const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid } = require('../apps/web/src/combat.ts');
const { autoAct } = require('../apps/web/src/combatAuto.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `autofocus-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '集火', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const hero = { ...base.actors[0], id: 'hero-1', name: '罗兰', side: '友方' };
  const foes = [0, 1].map(index => ({ ...base.actors[0], id: `foe-${index + 1}`, name: `哥布林${index + 1}`, side: '敌方' }));
  let battle = configureGrid({ ...base, actors: [hero, ...foes] }, { width: 12, height: 8, cellFt: 5 });
  const initiatives = { 'hero-1': 20, 'foe-1': 12, 'foe-2': 11 };
  battle = structuredClone(startCombat(battle, initiatives));
  const attacker = battle.actors.find(actor => actor.id === 'hero-1');
  attacker.position = { x: 0, y: 0 };
  battle.actors.find(actor => actor.id === 'foe-1').position = { x: 1, y: 0 };
  battle.actors.find(actor => actor.id === 'foe-2').position = { x: 0, y: 1 };
  return { battle, attacker };
}

test('默认按建议顺序挑选目标', () => {
  const { battle, attacker } = setup();
  const action = autoAct(battle, attacker.id, { random: () => 0.9 });
  assert.equal(action.kind, 'attack');
  assert.ok(action.text.includes('哥布林1'));
});

test('集火时优先攻击已经受伤的敌人', () => {
  const { battle, attacker } = setup();
  const wounded = structuredClone(battle);
  wounded.actors.find(actor => actor.id === 'foe-2').currentHp = 1;
  const action = autoAct(wounded, attacker.id, { random: () => 0.9 }, { focusFire: true });
  assert.equal(action.kind, 'attack');
  assert.ok(action.text.includes('哥布林2'));
});

test('没有受伤敌人时集火与默认选择一致', () => {
  const { battle, attacker } = setup();
  const plain = autoAct(battle, attacker.id, { random: () => 0.9 });
  const focus = autoAct(battle, attacker.id, { random: () => 0.9 }, { focusFire: true });
  assert.equal(focus.text, plain.text);
});

test('集火不影响移动分支', () => {
  const { battle, attacker } = setup();
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === 'foe-1').position = { x: 5, y: 5 };
  far.actors.find(actor => actor.id === 'foe-2').position = { x: 6, y: 6 };
  const action = autoAct(far, attacker.id, { random: () => 0.9 }, { focusFire: true });
  assert.equal(action.kind, 'move');
  assert.ok(action.text.includes('移动到'));
});
