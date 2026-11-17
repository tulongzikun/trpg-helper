const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, currentActorId } = require('../apps/web/src/combat.ts');
const { castSpell, counterspell, resolvePendingCast, setCounterspell } = require('../apps/web/src/combatSpells.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `cs-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++ % values.length] ?? 0.5; };

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '反制', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  store = addMonsters(store, card, { battleId: store.battles[0].id, side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const caster = battle.actors.find(item => item.side === '敌方');
  const reactor = battle.actors.find(item => item.side === '友方');
  const grid = configureGrid(battle, { width: 20, height: 4, cellFt: 5 });
  const started = startCombat(grid, { [caster.id]: 20, [reactor.id]: 10 });
  const placed = moveActorToCell(started, caster.id, 0, 0);
  const withBoth = moveActorToCell(placed, reactor.id, 3, 0);
  const ready = setCounterspell(withBoth, reactor.id, true);
  return { battle: ready, caster, reactor };
}

function fireball(casterId, targetId) {
  return {
    casterId,
    spell: '火球术',
    level: 3,
    save: { ability: 'dex', dc: 15, targetIds: [targetId], damageExpression: '8d6', damageType: '火焰', halfOnSuccess: true },
    defer: true,
  };
}

test('延后结算会消耗动作并留下反制窗口', () => {
  const { battle, caster, reactor } = setup();
  const result = castSpell(battle, fireball(caster.id, reactor.id));
  const state = result.battle.actors.find(item => item.id === caster.id).combat;
  assert.equal(state.actionUsed, true);
  assert.equal(result.battle.pendingCast?.spell, '火球术');
  assert.match(result.battle.pendingCast?.casterId ?? '', new RegExp(caster.id));
  assert.match(result.battle.combat.log.at(-1).text, /反制窗口/);
});

test('反制成功会取消待结算法术并消耗反应', () => {
  const { battle, caster, reactor } = setup();
  const queued = castSpell(battle, fireball(caster.id, reactor.id)).battle;
  const result = counterspell(queued, reactor.id, { random: sequence(0.95) });
  assert.equal(result.success, true);
  assert.equal(result.battle.pendingCast, undefined);
  assert.equal(result.battle.actors.find(item => item.id === reactor.id).combat.reactionUsed, true);
  assert.match(result.battle.combat.log.at(-1).text, /反制了「火球术」/);
});

test('反制失败保留法术，窗口结束后照常结算', () => {
  const { battle, caster, reactor } = setup();
  const queued = castSpell(battle, fireball(caster.id, reactor.id)).battle;
  const failed = counterspell(queued, reactor.id, { random: sequence(0) });
  assert.equal(failed.success, false);
  assert.equal(failed.battle.pendingCast?.spell, '火球术');
  const resolved = resolvePendingCast(failed.battle, { random: sequence(0, 0.5) }).battle;
  assert.equal(resolved.pendingCast, undefined);
  const casterHp = resolved.actors.find(item => item.id === caster.id);
  assert.ok(casterHp.currentHp >= 0);
  assert.match(resolved.combat.log.map(item => item.text).join(' '), /反制窗口结束/);
});

test('没有待结算法术时两个接口都报错', () => {
  const { battle, reactor } = setup();
  assert.throws(() => counterspell(battle, reactor.id), /没有待反制的法术/);
  assert.throws(() => resolvePendingCast(battle), /没有待结算的法术/);
});

test('不会反制或超出 60 尺时拒绝', () => {
  const { battle, caster, reactor } = setup();
  const queued = castSpell(battle, fireball(caster.id, reactor.id)).battle;
  const forgetful = { ...queued, actors: queued.actors.map(item => item.id === reactor.id ? { ...item, combat: { ...item.combat, counterspell: false } } : item) };
  assert.throws(() => counterspell(forgetful, reactor.id), /不会法术反制/);
  const far = { ...queued, actors: queued.actors.map(item => item.id === reactor.id ? { ...item, position: { x: 19, y: 0 } } : item) };
  assert.throws(() => counterspell(far, reactor.id, { random: sequence(0.95) }), /60 尺/);
});
