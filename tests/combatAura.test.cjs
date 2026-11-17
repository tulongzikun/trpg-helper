const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const {
  activeAuras,
  addAura,
  attack,
  auraBonus,
  configureGrid,
  defaultSaveBonus,
  moveActorToCell,
  removeAura,
  savingThrow,
  startCombat,
} = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

/**
 * 三个单位：一个敌方攻击者，两个友方（一个灵光来源、一个受保护目标）。
 * 方格 10×10、每格 5 尺；来源与目标相邻（5 尺）。
 */
function setup(allyCell = [2, 1], enemyCell = [3, 1]) {
  let store = addMonsters(emptyStore(), card, { newBattleName: '灵光测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  store = addMonsters(store, card, { battleId: store.battles[0].id, side: '友方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const [enemy, owner, ally] = battle.actors.map(actor => actor.id);
  let started = startCombat(battle, { [enemy]: 20, [owner]: 10, [ally]: 5 });
  started = configureGrid(started, { width: 10, height: 10, cellFt: 5 });
  started = moveActorToCell(started, owner, 1, 1);
  started = moveActorToCell(started, ally, allyCell[0], allyCell[1]);
  started = moveActorToCell(started, enemy, enemyCell[0], enemyCell[1]);
  return { started, enemy, owner, ally };
}

test('友方灵光会提高受保护单位的 AC', () => {
  const { started, enemy, ally, owner } = setup();
  const boosted = addAura(started, { name: '守护灵光', ownerId: owner, radiusFt: 10, bonus: 2, kind: 'ac' });
  assert.equal(auraBonus(boosted, ally, 'ac'), 2);
  assert.match(boosted.combat.log.at(-1).text, /守护灵光.*开始生效/);
  const targetAc = boosted.actors.find(actor => actor.id === ally).template.armorClass;
  const shot = attack(boosted, { attackerId: enemy, targetId: ally, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(), makeId: ids() });
  assert.equal(shot.outcome.targetAc, targetAc + 2);
  assert.match(shot.battle.combat.log.at(-1).detail, /灵光 AC \+2/);
});

test('超出灵光半径的单位不获得加值', () => {
  const { started, ally, owner } = setup([6, 6]);
  const boosted = addAura(started, { name: '守护灵光', ownerId: owner, radiusFt: 10, bonus: 2, kind: 'ac' });
  assert.equal(auraBonus(boosted, ally, 'ac'), 0);
  assert.equal(activeAuras(boosted, ally).length, 0);
});

test('灵光不会加给不同阵营的单位', () => {
  const { started, enemy, owner } = setup();
  const boosted = addAura(started, { name: '守护灵光', ownerId: owner, radiusFt: 30, bonus: 3, kind: 'ac' });
  assert.equal(auraBonus(boosted, owner, 'ac'), 3);
  assert.equal(auraBonus(boosted, enemy, 'ac'), 0);
});

test('豁免灵光会加进豁免结果', () => {
  const { started, ally, owner } = setup();
  const boosted = addAura(started, { name: '勇气灵光', ownerId: owner, radiusFt: 10, bonus: 3, kind: 'saves' });
  const outcome = savingThrow(boosted, { actorId: ally, ability: 'dex', dc: 15 }, { random: sequence(0.5), makeId: ids() });
  const natural = 1 + Math.floor(0.5 * 20);
  assert.equal(outcome.outcome.total, natural + defaultSaveBonus(boosted.actors.find(actor => actor.id === ally), 'dex') + 3);
  assert.match(outcome.battle.combat.log.at(-1).detail, new RegExp(`\\+${defaultSaveBonus(boosted.actors.find(actor => actor.id === ally), 'dex') + 3}`));
});

test('灵光的输入校验与结束', () => {
  const { started, owner } = setup();
  assert.throws(() => addAura(started, { name: '  ', ownerId: owner, radiusFt: 10, bonus: 2, kind: 'ac' }), /请填写灵光名称。/);
  assert.throws(() => addAura(started, { name: '灵光', ownerId: owner, radiusFt: 100, bonus: 2, kind: 'ac' }), /灵光半径须为 5 至 60 尺的整数。/);
  assert.throws(() => addAura(started, { name: '灵光', ownerId: owner, radiusFt: 10, bonus: 9, kind: 'ac' }), /灵光加值须为 1 至 5 的整数。/);
  assert.throws(() => addAura(started, { name: '灵光', ownerId: 'missing', radiusFt: 10, bonus: 2, kind: 'ac' }), /灵光的来源单位不存在。/);
  const boosted = addAura(started, { name: '守护灵光', ownerId: owner, radiusFt: 10, bonus: 2, kind: 'ac' });
  const auraId = boosted.auras.at(-1).id;
  const cleared = removeAura(boosted, auraId);
  assert.equal(auraBonus(cleared, owner, 'ac'), 0);
  assert.match(cleared.combat.log.at(-1).text, /守护灵光.*的灵光结束/);
  assert.throws(() => removeAura(cleared, auraId), /灵光不存在。/);
});


