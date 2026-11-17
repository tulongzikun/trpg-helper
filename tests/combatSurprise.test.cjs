const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { endTurn, markSurprised, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `surprise-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '突袭', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const build = (id, name, side) => ({ ...base.actors[0], id, name, side });
  return startCombat({ ...base, actors: [build('hero', '艾拉', '友方'), build('foe', '哥布林', '敌方')] }, { hero: 20, foe: 10 });
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;
const logs = battle => battle.combat.log.map(line => line.text).join('\n');

test('标记突袭会写入状态并留下战报', () => {
  const battle = setup();
  const next = markSurprised(battle, ['foe']);
  assert.equal(stateOf(next, 'foe').surprised, true);
  assert.ok(logs(next).includes('遭到突袭'));
});

test('被突袭的单位轮到时跳过回合，状态随即清除', () => {
  const battle = setup();
  const marked = markSurprised(battle, ['foe']);
  const next = endTurn(marked, { random: sequence(0.5) });
  assert.equal(currentActorIdOf(next), 'hero');
  assert.equal(stateOf(next, 'foe').surprised, undefined);
  assert.ok(logs(next).includes('措手不及，本回合无法行动'));
});

function currentActorIdOf(battle) {
  return battle.combat.order[battle.combat.turnIndex];
}

test('重复标记会被拒绝，未开始战斗同样报错', () => {
  const battle = setup();
  const once = markSurprised(battle, ['foe']);
  assert.equal(once.combat.log.filter(line => line.text.includes('遭到突袭')).length, 1);
  assert.throws(() => markSurprised(once, ['foe']), /已经处于突袭状态/);
  const store = addMonsters(emptyStore(), card, { newBattleName: '未开始', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  assert.throws(() => markSurprised(store.battles[0], ['x']), /战斗尚未开始/);
});

test('空目标与已倒下单位会被拒绝', () => {
  const battle = setup();
  assert.throws(() => markSurprised(battle, []), /请选择要标记为措手不及的单位/);
  const downed = structuredClone(battle);
  downed.actors.find(actor => actor.id === 'foe').combat.status = 'down';
  assert.throws(() => markSurprised(downed, ['foe']), /只有在场的单位可以被标记为突袭/);
});

test('长休会清除突袭标记', () => {
  const battle = setup();
  const rested = takeLongRest(markSurprised(battle, ['foe']));
  assert.equal(stateOf(rested, 'foe').surprised, undefined);
});

test('只标记指定单位，其他单位照常获得回合', () => {
  const battle = setup();
  const marked = markSurprised(battle, ['hero']);
  assert.equal(stateOf(marked, 'foe').surprised, undefined);
  const next = endTurn(marked, { random: sequence(0.5) });
  assert.equal(currentActorIdOf(next), 'foe');
  assert.equal(stateOf(next, 'hero').surprised, true);
  assert.equal(logs(next).includes('措手不及，本回合无法行动'), false);
});
