const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, fleeBattle, endTurn } = require('../apps/web/src/combat.ts');
const { battleOutcome } = require('../apps/web/src/combatOutcome.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `flee-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-flee', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '薇拉', species: '人类', characterClass: '战士', level: 3,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 32, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup(count = 2) {
  let store = addMonsters(emptyStore(), card, { newBattleName: '撤离', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store;
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

test('撤离写入状态并记录日志', () => {
  const { battle, foes } = setup();
  const next = fleeBattle(battle, foes[0].id);
  assert.equal(next.actors.find(actor => actor.id === foes[0].id).combat.fled, true);
  assert.match(logs(next), /撤离了战场/);
  assert.equal(battleOutcome(next), 'ongoing');
});

test('敌方全部撤离判为胜利', () => {
  const { battle, foes } = setup();
  let next = fleeBattle(battle, foes[0].id);
  next = fleeBattle(next, foes[1].id);
  assert.equal(battleOutcome(next), 'victory');
});

test('一方撤离后不再计入胜负，友方全撤判为失败', () => {
  const { battle, ally } = setup();
  const next = fleeBattle(battle, ally.id);
  assert.equal(battleOutcome(next), 'defeat');
});

test('撤离的单位不会被轮到', () => {
  const { battle, ally, foes } = setup();
  const fled = fleeBattle(battle, foes[0].id);
  let next = endTurn(fled, { random: sequence(0.5) });
  // 连续结束回合若干次，应该只会在英雄与未撤离的敌人之间轮转
  const seen = new Set();
  for (let index = 0; index < 4; index += 1) {
    seen.add(next.combat.order[next.combat.turnIndex]);
    next = endTurn(next, { random: sequence(0.5) });
  }
  assert.equal(seen.has(foes[0].id), false);
  assert.ok(seen.has(ally.id));
  assert.ok(seen.has(foes[1].id));
});

test('重复撤离与倒地单位撤离被拒绝', () => {
  const { battle, foes } = setup();
  const once = fleeBattle(battle, foes[0].id);
  assert.throws(() => fleeBattle(once, foes[0].id), /已经撤离了战场/);
  const downed = structuredClone(battle);
  downed.actors.find(actor => actor.id === foes[1].id).combat.status = 'down';
  assert.throws(() => fleeBattle(downed, foes[1].id), /只有在场的单位可以撤离战场/);
});

test('撤离会清掉与自己相关的借机攻击提示', () => {
  const { battle, ally, foes } = setup();
  const pending = structuredClone(battle);
  pending.combat.pendingOpportunity = [{ reactorId: ally.id, targetId: foes[0].id, from: { x: 1, y: 0 }, to: { x: 3, y: 0 } }];
  const next = fleeBattle(pending, foes[0].id);
  assert.deepEqual(next.combat.pendingOpportunity, []);
});
