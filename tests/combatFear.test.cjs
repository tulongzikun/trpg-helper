const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { attack, castFear, configureGrid, endConcentration, endTurn, moveActorToCell, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `fear-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '恐惧', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const build = (id, name, side) => ({ ...base.actors[0], id, name, side });
  const seeded = { ...base, actors: [build('caster', '艾拉', '友方'), build('ally', '布鲁', '友方'), build('foe', '哥布林', '敌方')] };
  const config = configureGrid(seeded, { width: 20, height: 20, cellFt: 5 });
  let battle = startCombat(config, { caster: 20, ally: 15, foe: 10 });
  battle = moveActorToCell(battle, 'caster', 4, 5);
  battle = moveActorToCell(battle, 'ally', 5, 4);
  battle = moveActorToCell(battle, 'foe', 8, 5);
  return { battle };
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;

test('恐惧术消耗动作与专注，豁免失败者陷入恐慌', () => {
  const { battle } = setup();
  const next = castFear(battle, 'caster', ['foe'], { random: sequence(0.05) });
  const foeState = stateOf(next, 'foe');
  assert.equal(foeState.frightened, 10);
  assert.equal(foeState.frightenedBy, 'caster');
  assert.ok(foeState.conditions.includes('恐慌'));
  const casterState = stateOf(next, 'caster');
  assert.equal(casterState.actionUsed, true);
  assert.equal(casterState.concentration.spell, '恐惧术');
  assert.ok(next.combat.log.some(line => line.text.includes('陷入恐慌')));
});

test('豁免成功的目标不受影响', () => {
  const { battle } = setup();
  const next = castFear(battle, 'caster', ['foe'], { random: sequence(0.99) });
  const foeState = stateOf(next, 'foe');
  assert.equal(foeState.frightened, undefined);
  assert.ok(!foeState.conditions.includes('恐慌'));
  assert.ok(next.combat.log.some(line => line.text.includes('抵抗了恐惧术')));
});

test('恐慌的单位无法朝恐惧源移动，但可以远离', () => {
  const { battle } = setup();
  const feared = castFear(battle, 'caster', ['foe'], { random: sequence(0.05) });
  const cur = endTurn(endTurn(feared, { random: sequence(0.5) }), { random: sequence(0.05) });
  assert.throws(() => moveActorToCell(cur, 'foe', 6, 5), /无法朝恐惧源移动/);
  const away = moveActorToCell(cur, 'foe', 10, 5);
  assert.deepEqual(away.actors.find(actor => actor.id === 'foe').position, { x: 10, y: 5 });
});

test('恐慌的单位攻击恐惧源时具有劣势', () => {
  const { battle } = setup();
  const feared = castFear(battle, 'caster', ['foe'], { random: sequence(0.05) });
  const cur = endTurn(endTurn(feared, { random: sequence(0.5) }), { random: sequence(0.05) });
  const adjacent = structuredClone(cur);
  adjacent.actors.find(actor => actor.id === 'foe').position = { x: 5, y: 5 };
  const strike = attack(adjacent, { attackerId: 'foe', targetId: 'caster', attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(strike.outcome.mode, 'disadvantage');
  assert.ok(strike.outcome.notes.some(note => note.includes('恐慌')));
});

test('回合开始再豁免成功即克服恐惧，结束专注与长休也会解除', () => {
  const { battle } = setup();
  const feared = castFear(battle, 'caster', ['foe'], { random: sequence(0.05) });
  const freed = endTurn(endTurn(feared, { random: sequence(0.5) }), { random: sequence(0.99) });
  const foeState = stateOf(freed, 'foe');
  assert.equal(foeState.frightened, undefined);
  assert.ok(!foeState.conditions.includes('恐慌'));
  assert.ok(freed.combat.log.some(line => line.text.includes('克服了恐惧术')));
  const cleared = endConcentration(feared, 'caster');
  assert.equal(stateOf(cleared, 'foe').frightened, undefined);
  assert.ok(cleared.combat.log.some(line => line.text.includes('恐惧术结束了')));
  assert.equal(stateOf(takeLongRest(feared), 'foe').frightened, undefined);
});

test('恐惧术会拒绝自己、同伴、超距、超员与重复施放', () => {
  const { battle } = setup();
  assert.throws(() => castFear(battle, 'caster', ['caster']), /不能对自己施放/);
  assert.throws(() => castFear(battle, 'caster', ['ally']), /只能影响敌对单位/);
  assert.throws(() => castFear(battle, 'caster', []), /请选择恐惧术的目标/);
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === 'foe').position = { x: 14, y: 5 };
  assert.throws(() => castFear(far, 'caster', ['foe'], { random: sequence(0.05) }), /30 尺内/);
  const feared = castFear(battle, 'caster', ['foe'], { random: sequence(0.05) });
  assert.throws(() => castFear(feared, 'caster', ['foe'], { random: sequence(0.05) }), /已经使用过动作/);
});
