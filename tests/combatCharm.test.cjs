const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { attack, castCharmPerson, configureGrid, endConcentration, endTurn, moveActorToCell, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `charm-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '魅惑', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const build = (id, name, side) => ({ ...base.actors[0], id, name, side });
  const seeded = { ...base, actors: [build('caster', '艾拉', '友方'), build('ally', '布鲁', '友方'), build('foe', '哥布林', '敌方')] };
  const config = configureGrid(seeded, { width: 20, height: 20, cellFt: 5 });
  let battle = startCombat(config, { caster: 20, ally: 15, foe: 10 });
  battle = moveActorToCell(battle, 'caster', 4, 5);
  battle = moveActorToCell(battle, 'ally', 5, 4);
  battle = moveActorToCell(battle, 'foe', 5, 5);
  return { battle };
}

test('魅惑术消耗动作与专注，豁免失败者被魅惑', () => {
  const { battle } = setup();
  const next = castCharmPerson(battle, 'caster', 'foe', { random: sequence(0.05) });
  const foeState = next.actors.find(actor => actor.id === 'foe').combat;
  assert.equal(foeState.charmed, 10);
  assert.equal(foeState.charmedBy, 'caster');
  assert.ok(foeState.conditions.includes('魅惑'));
  const casterState = next.actors.find(actor => actor.id === 'caster').combat;
  assert.equal(casterState.actionUsed, true);
  assert.equal(casterState.concentration.spell, '魅惑术');
  assert.ok(next.combat.log.some(line => line.text.includes('被魅惑')));
});

test('豁免成功的目标不受影响', () => {
  const { battle } = setup();
  const next = castCharmPerson(battle, 'caster', 'foe', { random: sequence(0.99) });
  const foeState = next.actors.find(actor => actor.id === 'foe').combat;
  assert.equal(foeState.charmed, undefined);
  assert.ok(!foeState.conditions.includes('魅惑'));
  assert.ok(next.combat.log.some(line => line.text.includes('抵抗了魅惑术')));
});

test('被魅惑的单位无法攻击施法者，但可以攻击其他单位', () => {
  const { battle } = setup();
  const charmed = castCharmPerson(battle, 'caster', 'foe', { random: sequence(0.05) });
  let cur = endTurn(charmed, { random: sequence(0.05) });
  cur = endTurn(cur, { random: sequence(0.05) });
  const options = { attackerId: 'foe', targetId: 'caster', attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' };
  assert.throws(() => attack(cur, options, { random: sequence(0.5, 0.5, 0.5), makeId: ids() }), /无法攻击魅惑它的施法者/);
  const onAlly = { ...options, targetId: 'ally' };
  const strike = attack(cur, onAlly, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.ok(strike.outcome);
});

test('被魅惑的单位在自己回合开始时做感知豁免，成功即摆脱', () => {
  const { battle } = setup();
  const charmed = castCharmPerson(battle, 'caster', 'foe', { random: sequence(0.05) });
  const freed = endTurn(endTurn(charmed, { random: sequence(0.5) }), { random: sequence(0.99) });
  const foeState = freed.actors.find(actor => actor.id === 'foe').combat;
  assert.equal(foeState.charmed, undefined);
  assert.ok(!foeState.conditions.includes('魅惑'));
  assert.ok(freed.combat.log.some(line => line.text.includes('摆脱了魅惑术')));
});

test('结束专注与长休都会解除魅惑术', () => {
  const { battle } = setup();
  const charmed = castCharmPerson(battle, 'caster', 'foe', { random: sequence(0.05) });
  const cleared = endConcentration(charmed, 'caster');
  assert.equal(cleared.actors.find(actor => actor.id === 'foe').combat.charmed, undefined);
  assert.ok(cleared.combat.log.some(line => line.text.includes('魅惑术结束了')));
  const rested = takeLongRest(charmed);
  assert.equal(rested.actors.find(actor => actor.id === 'foe').combat.charmed, undefined);
});

test('魅惑术会拒绝自己、同伴、超距与重复施放', () => {
  const { battle } = setup();
  assert.throws(() => castCharmPerson(battle, 'caster', 'caster'), /不能对自己施放/);
  assert.throws(() => castCharmPerson(battle, 'caster', 'ally'), /只能影响敌对单位/);
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === 'foe').position = { x: 12, y: 5 };
  assert.throws(() => castCharmPerson(far, 'caster', 'foe', { random: sequence(0.05) }), /30 尺内/);
  const charmed = castCharmPerson(battle, 'caster', 'foe', { random: sequence(0.05) });
  assert.throws(() => castCharmPerson(charmed, 'caster', 'foe', { random: sequence(0.05) }), /已经使用过动作/);
});
