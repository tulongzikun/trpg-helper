const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, endTurn, pendingOpportunities, readyAction, readyTriggersOnEnter,
} = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `ready-trigger-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-ready-trigger',
  revision: 1,
  publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '守卫',
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
};

function setUp(action, trigger = '敌人进入触及') {
  let store = addMonsters(emptyStore(), card, { newBattleName: '触发判定', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 14, height: 8, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = structuredClone(startCombat(battle, { [guard.id]: 20, [foe.id]: 10 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 2, y: 2 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 6, y: 2 };
  battle = readyAction(battle, guard.id, { action, trigger });
  return { battle, guardId: guard.id, foeId: foe.id };
}

test('攻击类准备动作会在敌人进入时自动提示', () => {
  const { battle, guardId, foeId } = setUp('攻击靠近的敌人');
  const guard = battle.actors.find(actor => actor.id === guardId);
  assert.equal(readyTriggersOnEnter(guard), true);
  const moved = moveActorToCell(endTurn(battle), foeId, 3, 2);
  const prompts = pendingOpportunities(moved).filter(item => item.kind === 'ready');
  assert.equal(prompts.length, 1);
});

test('施法类准备动作同样会排队提示', () => {
  const { battle, guardId } = setUp('施放火球术');
  const guard = battle.actors.find(actor => actor.id === guardId);
  assert.equal(readyTriggersOnEnter(guard), true);
});

test('触发条件里写了「进入」的非攻击动作也会排队', () => {
  const { battle, guardId } = setUp('关上身后的大门', '有人进入房间');
  const guard = battle.actors.find(actor => actor.id === guardId);
  assert.equal(readyTriggersOnEnter(guard), true);
});

test('既不含攻击也不含进入的准备动作不会自动提示', () => {
  const { battle, guardId, foeId } = setUp('关上身后的大门', '有人靠近');
  const guard = battle.actors.find(actor => actor.id === guardId);
  assert.equal(readyTriggersOnEnter(guard), false);
  const moved = moveActorToCell(endTurn(battle), foeId, 3, 2);
  assert.equal(pendingOpportunities(moved).length, 0);
});

test('没有准备动作的单位不参与自动提示', () => {
  const { battle, foeId } = setUp('攻击靠近的敌人');
  const foe = battle.actors.find(actor => actor.id === foeId);
  assert.equal(readyTriggersOnEnter(foe), false);
});
