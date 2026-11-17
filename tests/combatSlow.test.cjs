const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { attack, castSlow, configureGrid, endConcentration, moveActorToCell, spendResource, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `slow-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '缓慢', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const build = (id, name, side) => ({ ...base.actors[0], id, name, side });
  const seeded = { ...base, actors: [build('caster', '艾拉', '友方'), build('ally', '布鲁', '友方'), build('foe', '哥布林', '敌方')] };
  const config = configureGrid(seeded, { width: 20, height: 20, cellFt: 5 });
  let battle = startCombat(config, { caster: 20, ally: 15, foe: 10 });
  battle = moveActorToCell(battle, 'caster', 4, 5);
  battle = moveActorToCell(battle, 'ally', 3, 5);
  battle = moveActorToCell(battle, 'foe', 5, 5);
  return { battle };
}

test('缓慢术消耗动作与专注，豁免失败者被减速 10 轮', () => {
  const { battle } = setup();
  const next = castSlow(battle, 'caster', ['foe'], { random: sequence(0.05) });
  const foeState = next.actors.find(actor => actor.id === 'foe').combat;
  assert.equal(foeState.slowed, 10);
  assert.equal(foeState.slowedBy, 'caster');
  const casterState = next.actors.find(actor => actor.id === 'caster').combat;
  assert.equal(casterState.actionUsed, true);
  assert.equal(casterState.concentration.spell, '缓慢术');
  assert.ok(next.combat.log.some(line => line.text.includes('被缓慢术影响')));
});

test('豁免成功的目标不受影响', () => {
  const { battle } = setup();
  const next = castSlow(battle, 'caster', ['foe'], { random: sequence(0.99) });
  const foeState = next.actors.find(actor => actor.id === 'foe').combat;
  assert.equal(foeState.slowed, undefined);
  assert.equal(foeState.slowedBy, undefined);
  assert.ok(next.combat.log.some(line => line.text.includes('抵抗了缓慢术')));
  assert.ok(next.combat.log.some(line => line.text.includes('没有影响到任何单位')));
});

test('被减速的目标 AC 降低 2 点', () => {
  const { battle } = setup();
  const plain = attack(battle, { attackerId: 'caster', targetId: 'foe', attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  const slowed = castSlow(battle, 'caster', ['foe'], { random: sequence(0.05) });
  slowed.actors.find(actor => actor.id === 'caster').combat.actionUsed = false;
  const shot = attack(slowed, { attackerId: 'caster', targetId: 'foe', attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(shot.outcome.targetAc, plain.outcome.targetAc - 2);
});

test('被减速的目标无法使用反应', () => {
  const { battle } = setup();
  const slowed = castSlow(battle, 'caster', ['foe'], { random: sequence(0.05) });
  assert.throws(() => spendResource(slowed, 'foe', 'reaction'), /缓慢术的影响下无法使用反应/);
  assert.doesNotThrow(() => spendResource(battle, 'foe', 'reaction'));
});

test('结束专注与长休都会解除缓慢术', () => {
  const { battle } = setup();
  const slowed = castSlow(battle, 'caster', ['foe'], { random: sequence(0.05) });
  const cleared = endConcentration(slowed, 'caster');
  assert.equal(cleared.actors.find(actor => actor.id === 'foe').combat.slowed, undefined);
  assert.ok(cleared.combat.log.some(line => line.text.includes('缓慢术结束了')));
  const rested = takeLongRest(slowed);
  assert.equal(rested.actors.find(actor => actor.id === 'foe').combat.slowed, undefined);
});

test('缓慢术会拒绝自己、同伴、超员、超距与空目标', () => {
  const { battle } = setup();
  assert.throws(() => castSlow(battle, 'caster', []), /请选择缓慢术的目标/);
  assert.throws(() => castSlow(battle, 'caster', ['caster']), /不能对自己施放/);
  assert.throws(() => castSlow(battle, 'caster', ['ally']), /只能影响敌对单位/);
  assert.throws(() => castSlow(battle, 'caster', ['a', 'b', 'c', 'd', 'e', 'f', 'g']), /最多影响 6 名单位/);
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === 'foe').position = { x: 13, y: 5 };
  assert.throws(() => castSlow(far, 'caster', ['foe'], { random: sequence(0.05) }), /40 尺内/);
});
