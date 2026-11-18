const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, pendingOpportunities, promptCells } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `promptcells-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-prompt-cells',
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

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '落点格', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = structuredClone(startCombat(battle, { [guard.id]: 10, [foe.id]: 20 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 1, y: 1 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 2, y: 1 };
  return { battle, guardId: guard.id, foeId: foe.id };
}

test('没有提示时返回空数组', () => {
  const { battle } = setup();
  assert.deepEqual(promptCells(battle), []);
});

test('提示落点格被收集', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 5, 1);
  assert.equal(pendingOpportunities(moved).length, 1);
  assert.deepEqual(promptCells(moved), [{ x: 5, y: 1 }]);
});

test('重复落点只留一个，旧提示没有坐标就跳过', () => {
  const { battle, guardId, foeId } = setup();
  const withPrompts = structuredClone(battle);
  withPrompts.combat.pendingOpportunity = [
    { reactorId: guardId, targetId: foeId, kind: 'opportunity', from: { x: 2, y: 1 }, to: { x: 5, y: 1 } },
    { reactorId: foeId, targetId: guardId, kind: 'opportunity', from: { x: 3, y: 3 }, to: { x: 5, y: 1 } },
    { reactorId: guardId, targetId: foeId, kind: 'ready' },
  ];
  assert.deepEqual(promptCells(withPrompts), [{ x: 5, y: 1 }]);
});
