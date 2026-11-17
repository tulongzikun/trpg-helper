const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, castBless, configureGrid, addHazard, setTerrain, moveActorToCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `hz-${++counter}`;
const seq = values => () => values.shift() ?? 0.5;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '地形专注', side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const caster = battle.actors[0];
  caster.name = '法师';
  caster.position = { x: 0, y: 0 };
  const ally = { ...structuredClone(caster), id: 'ally-1', name: '战士', position: { x: 0, y: 1 } };
  ally.combat = undefined;
  battle.actors = [caster, ally];
  battle = structuredClone(startCombat(battle, { [caster.id]: 20, 'ally-1': 10 }));
  battle = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  battle.combat.turnIndex = battle.combat.order.indexOf(caster.id);
  const blessed = castBless(battle, caster.id, ['ally-1']);
  return { battle: blessed, casterId: caster.id };
}

const textsOf = battle => (battle.combat?.log ?? []).map(item => item.text);
const detailOf = battle => (battle.combat?.log ?? []).map(item => item.detail ?? '').join(' | ');

test('踏入危险地形受伤后要做专注检定', () => {
  const { battle, casterId } = setup();
  const withHazard = addHazard(battle, { x: 1, y: 0, damageExpression: '1d6', damageType: '火焰' });
  const moved = moveActorToCell(withHazard, casterId, 1, 0, { random: seq([0.5, 0.02]) });
  const caster = moved.actors.find(actor => actor.id === casterId);
  assert.equal(caster.combat.concentration, undefined);
  assert.match(detailOf(moved), /专注检定/);
  assert.ok(textsOf(moved).some(text => /祝福术结束了/.test(text)));
});

test('专注检定成功时保留专注', () => {
  const { battle, casterId } = setup();
  const withHazard = addHazard(battle, { x: 1, y: 0, damageExpression: '1d4', damageType: '火焰' });
  const moved = moveActorToCell(withHazard, casterId, 1, 0, { random: seq([0.25, 0.98]) });
  const caster = moved.actors.find(actor => actor.id === casterId);
  assert.equal(caster.combat.concentration.spell, '祝福术');
});

test('岩浆伤害也会触发专注检定', () => {
  const { battle, casterId } = setup();
  const lava = setTerrain(battle, 'lava');
  const moved = moveActorToCell(lava, casterId, 1, 0, { random: seq([0.02, 0.02]) });
  const caster = moved.actors.find(actor => actor.id === casterId);
  assert.equal(caster.combat.concentration, undefined);
  assert.match(detailOf(moved), /专注检定/);
});

test('荆棘伤害也会触发专注检定', () => {
  const { battle, casterId } = setup();
  const brambles = setTerrain(battle, 'brambles');
  const moved = moveActorToCell(brambles, casterId, 2, 0, { random: seq([0.02]) });
  const caster = moved.actors.find(actor => actor.id === casterId);
  assert.equal(caster.combat.concentration, undefined);
  assert.match(detailOf(moved), /专注检定/);
});

test('没有专注的单位不会写专注检定', () => {
  const { battle, casterId } = setup();
  const plain = structuredClone(battle);
  delete plain.actors.find(actor => actor.id === casterId).combat.concentration;
  const withHazard = addHazard(plain, { x: 1, y: 0, damageExpression: '1d6', damageType: '火焰' });
  const moved = moveActorToCell(withHazard, casterId, 1, 0, { random: seq([0.5]) });
  assert.doesNotMatch(detailOf(moved), /专注检定/);
});
