const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, surrender, fleeBattle, lootCorpse, endTurn } = require('../apps/web/src/combat.ts');
const { battleOutcome } = require('../apps/web/src/combatOutcome.ts');
const { rewardSummary, encounterReward } = require('../apps/web/src/encounterReward.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `surrender-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-surr', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '卡尔', species: '人类', characterClass: '圣武士', level: 3,
    abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 14 },
    maxHp: 34, armorClass: 17, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup(count = 2) {
  let store = addMonsters(emptyStore(), card, { newBattleName: '投降', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 10, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const ally = next.actors.find(actor => actor.side === '友方');
  const foes = next.actors.filter(actor => actor.side === '敌方');
  ally.position = { x: 0, y: 0 };
  foes.forEach((foe, index) => { foe.position = { x: 1 + index, y: 0 }; });
  return { battle: next, ally, foes };
}

const logs = battle => battle.combat.log.map(item => item.text).join('\n');

test('投降写入状态并记录日志，计入击败经验', () => {
  const { battle, foes } = setup();
  const next = surrender(battle, foes[0].id);
  const state = next.actors.find(actor => actor.id === foes[0].id).combat;
  assert.equal(state.surrendered, true);
  assert.match(logs(next), /投降/);
  const reward = encounterReward(next);
  assert.equal(reward.defeated, 1);
  assert.equal(reward.remaining, 1);
  assert.match(rewardSummary(next), /已击败 1 个单位/);
});

test('敌方全部投降判为胜利', () => {
  const { battle, foes } = setup();
  let next = surrender(battle, foes[0].id);
  next = surrender(next, foes[1].id);
  assert.equal(battleOutcome(next), 'victory');
  const reward = encounterReward(next);
  assert.equal(reward.completed, true);
  assert.equal(reward.defeated, 2);
});

test('投降者不再被轮到', () => {
  const { battle, ally, foes } = setup();
  const surrendered = surrender(battle, foes[0].id);
  let next = surrendered;
  const seen = new Set();
  for (let index = 0; index < 4; index += 1) {
    seen.add(next.combat.order[next.combat.turnIndex]);
    next = endTurn(next, { random: sequence(0.5) });
  }
  assert.equal(seen.has(foes[0].id), false);
  assert.ok(seen.has(ally.id));
});

test('投降的单位可以被搜刮', () => {
  const { battle, ally, foes } = setup();
  const target = foes[0];
  const withItem = structuredClone(battle);
  withItem.actors.find(actor => actor.id === target.id).combat.items = [{ name: '短剑', quantity: 1, identified: true }];
  const surrendered = surrender(withItem, target.id);
  const result = lootCorpse(surrendered, ally.id, target.id);
  assert.deepEqual(result.looted, ['短剑']);
});

test('重复投降、倒地单位与撤离后投降都会被拒绝', () => {
  const { battle, foes } = setup();
  const once = surrender(battle, foes[0].id);
  assert.throws(() => surrender(once, foes[0].id), /已经投降/);
  const downed = structuredClone(battle);
  downed.actors.find(actor => actor.id === foes[1].id).combat.status = 'down';
  assert.throws(() => surrender(downed, foes[1].id), /只有在场的单位可以投降/);
  const fled = fleeBattle(battle, foes[1].id);
  assert.throws(() => surrender(fled, foes[1].id), /只有在场的单位可以投降/);
});

test('投降与撤离的胜负与经验互不影响', () => {
  const { battle, foes } = setup();
  let next = surrender(battle, foes[0].id);
  next = fleeBattle(next, foes[1].id);
  assert.equal(battleOutcome(next), 'victory');
  const reward = encounterReward(next);
  assert.equal(reward.defeated, 1);
  assert.equal(reward.remaining, 0);
});
