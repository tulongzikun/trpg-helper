const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, resolveAllPrompts, pendingOpportunities } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `resolvealllog-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = name => ({
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: `char-${name}`,
  revision: 1,
  publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name,
    species: '人类',
    characterClass: '战士',
    level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40,
    armorClass: 16,
    speedFt: 30,
    actions: '',
    notes: '',
    details: { equipment: '长剑' },
  },
});

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '一键结算日志', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero('守卫'), { battleId, side: '友方' }, ids()).store;
  store = addCharacter(store, hero('同伴'), { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const guards = battle.actors.filter(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  const initiatives = {};
  battle.actors.forEach(actor => { initiatives[actor.id] = actor.id === foe.id ? 20 : 10; });
  battle = structuredClone(startCombat(battle, initiatives));
  battle.actors.find(actor => actor.id === guards[0].id).position = { x: 1, y: 1 };
  battle.actors.find(actor => actor.id === guards[1].id).position = { x: 1, y: 2 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 2, y: 1 };
  return { battle, guardIds: guards.map(actor => actor.id), foeId: foe.id };
}

const logText = battle => battle.combat.log.map(item => item.text).join(' ');

test('结算成功时战报记录完成条数', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 5, 1);
  const result = resolveAllPrompts(moved, { random: sequence(0.9, 0.5, 0.9, 0.5) });
  assert.match(logText(result.battle), /一键结算：完成 2 条反应（借机攻击 2、准备动作 0）。/);
  assert.match(logText(result.battle), /已结算：守卫：借机攻击 → /);
});

test('有跳过时战报写出原因', () => {
  const { battle, guardIds, foeId } = setup();
  const spent = structuredClone(battle);
  spent.actors.find(actor => actor.id === guardIds[0]).combat.reactionUsed = true;
  const moved = moveActorToCell(spent, foeId, 5, 1);
  const result = resolveAllPrompts(moved, { random: sequence(0.9, 0.5) });
  const text = logText(result.battle);
  assert.match(text, /完成 1 条反应（借机攻击 1、准备动作 0），跳过 1 条/);
  assert.match(text, /反应/);
});

test('没有待结算提示时不写日志', () => {
  const { battle } = setup();
  const before = battle.combat.log.length;
  const result = resolveAllPrompts(battle);
  assert.equal(result.battle.combat.log.length, before);
  assert.equal(pendingOpportunities(result.battle).length, 0);
});
