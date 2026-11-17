const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, addItem, useItem } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '物品', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const hero = { ...base.actors[0], id: 'hero', name: '艾拉', side: '友方', currentHp: 10, maxHp: 40 };
  const ally = { ...base.actors[0], id: 'ally', name: '同伴', side: '友方', currentHp: 40, maxHp: 40 };
  const battle = startCombat({ ...base, actors: [hero, ally, base.actors[0]] }, { hero: 20, ally: 15, [base.actors[0].id]: 1 });
  return addItem(battle, 'hero', '治疗药水', 2, '2d4+2');
}

test('使用物品治疗自己并消耗动作与数量', () => {
  const battle = setup();
  const result = useItem(battle, 'hero', '治疗药水', undefined, { random: sequence(0.5, 0.5) });
  assert.equal(result.healed, 8);
  const hero = result.battle.actors.find(item => item.id === 'hero');
  assert.equal(hero.currentHp, 18);
  assert.equal(hero.combat.actionUsed, true);
  assert.equal(hero.combat.items[0].quantity, 1);
  assert.match(result.battle.combat.log.at(-1).text, /使用「治疗药水」/);
});

test('用完后物品从列表移除', () => {
  let battle = setup();
  let result = useItem(battle, 'hero', '治疗药水', undefined, { random: sequence(0.5, 0.5) });
  assert.equal(result.battle.actors.find(item => item.id === 'hero').combat.items[0].quantity, 1);
  const reopened = { ...result.battle, actors: result.battle.actors.map(item => item.id === 'hero' ? { ...item, combat: { ...item.combat, actionUsed: false } } : item) };
  result = useItem(reopened, 'hero', '治疗药水', undefined, { random: sequence(0.5, 0.5) });
  const heroState = result.battle.actors.find(item => item.id === 'hero').combat;
  assert.equal(heroState.items, undefined);
});

test('可以给 5 尺内的倒地同伴使用物品', () => {
  let battle = setup();
  battle = { ...battle, actors: battle.actors.map(item => item.id === 'ally' ? { ...item, currentHp: 0, combat: { ...item.combat, status: 'down', deathSaves: { successes: 1, failures: 0 } } } : item) };
  const result = useItem(battle, 'hero', '治疗药水', 'ally', { random: sequence(0.5, 0.5) });
  const ally = result.battle.actors.find(item => item.id === 'ally');
  assert.equal(ally.currentHp, 8);
  assert.equal(ally.combat.status, 'active');
  assert.deepEqual(ally.combat.deathSaves, { successes: 0, failures: 0 });
});

test('没有物品或数量为零时报错', () => {
  const battle = setup();
  assert.throws(() => useItem(battle, 'hero', '火把'), /该单位没有「火把」这个物品。/);
  const empty = { ...battle, actors: battle.actors.map(item => item.id === 'hero' ? { ...item, combat: { ...item.combat, items: [] } } : item) };
  assert.throws(() => useItem(empty, 'hero', '治疗药水'), /该单位没有「治疗药水」这个物品。/);
});

test('动作已用或不在自己回合时拒绝使用', () => {
  const battle = setup();
  const used = { ...battle, actors: battle.actors.map(item => item.id === 'hero' ? { ...item, combat: { ...item.combat, actionUsed: true } } : item) };
  assert.throws(() => useItem(used, 'hero', '治疗药水'), /该单位本回合已经使用过动作。/);
  const { endTurn } = require('../apps/web/src/combat.ts');
  assert.throws(() => useItem(endTurn(battle), 'hero', '治疗药水'), /只有当前回合的单位可以使用物品。/);
});

test('物品输入校验', () => {
  const battle = setup();
  assert.throws(() => addItem(battle, 'hero', '  ', 1), /请填写物品名称。/);
  assert.throws(() => addItem(battle, 'hero', '干粮', 0), /物品数量须为 1 至 99 的整数。/);
  assert.throws(() => addItem(battle, 'hero', '毒药', 1, 'abc'), /伤害骰格式无效/);
});
