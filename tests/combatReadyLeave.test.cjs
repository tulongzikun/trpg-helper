const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, endTurn, pendingOpportunities, readyAction, readyTriggersOnLeave,
} = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `ready-leave-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-ready-leave',
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

function setup(trigger) {
  let store = addMonsters(emptyStore(), card, { newBattleName: '离开触发', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 14, height: 8, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = structuredClone(startCombat(battle, { [guard.id]: 20, [foe.id]: 10 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 1, y: 1 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 2, y: 1 };
  battle = readyAction(battle, guard.id, { action: '攻击靠近的敌人', trigger });
  return { battle, guardId: guard.id, foeId: foe.id };
}

test('触发条件含「离开」的准备动作在目标离开时排队', () => {
  const { battle, guardId, foeId } = setup('敌人离开触及');
  const guard = battle.actors.find(actor => actor.id === guardId);
  assert.equal(readyTriggersOnLeave(guard), true);
  const moved = moveActorToCell(endTurn(battle), foeId, 4, 1);
  const readyPrompts = pendingOpportunities(moved).filter(item => item.kind === 'ready');
  assert.equal(readyPrompts.length, 1);
  assert.equal(readyPrompts[0].reactorId, guardId);
});

test('离开时同时保留借机攻击与准备动作两条提示', () => {
  const { battle, foeId } = setup('敌人离开触及');
  const moved = moveActorToCell(endTurn(battle), foeId, 4, 1);
  const prompts = pendingOpportunities(moved);
  assert.equal(prompts.length, 2);
  assert.deepEqual(prompts.map(item => item.kind ?? 'opportunity').sort(), ['opportunity', 'ready']);
});

test('触发条件含「进入」时不会在离开时排队', () => {
  const { battle, guardId, foeId } = setup('敌人进入触及');
  const guard = battle.actors.find(actor => actor.id === guardId);
  assert.equal(readyTriggersOnLeave(guard), false);
  const moved = moveActorToCell(endTurn(battle), foeId, 4, 1);
  assert.equal(pendingOpportunities(moved).filter(item => item.kind === 'ready').length, 0);
});

test('没有准备动作的单位不算离开触发', () => {
  const { battle, foeId } = setup('敌人离开触及');
  const foe = battle.actors.find(actor => actor.id === foeId);
  assert.equal(readyTriggersOnLeave(foe), false);
});
