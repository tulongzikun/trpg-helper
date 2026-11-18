const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, pendingOpportunities, clearPrompts, PROMPT_QUEUE_LIMIT,
} = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `prompt-queue-${++counter}`;

function makeHero(name, characterId) {
  return {
    schemaVersion: 'manual-character-snapshot/v1',
    characterId,
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
  };
}

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '提示队列', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, makeHero('守卫', 'char-queue-guard'), { battleId, side: '友方' }, ids()).store;
  store = addCharacter(store, makeHero('游侠', 'char-queue-ranger'), { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 14, height: 8, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.name === '守卫');
  const ranger = battle.actors.find(actor => actor.name === '游侠');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = structuredClone(startCombat(battle, { [guard.id]: 5, [ranger.id]: 4, [foe.id]: 20 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 1, y: 1 };
  battle.actors.find(actor => actor.id === ranger.id).position = { x: 1, y: 5 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 2, y: 1 };
  return { battle, guardId: guard.id, rangerId: ranger.id, foeId: foe.id };
}

test('清空提示会移除队列并写日志', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  assert.equal(pendingOpportunities(moved).length, 1);
  const cleared = clearPrompts(moved);
  assert.equal(pendingOpportunities(cleared).length, 0);
  assert.match(cleared.combat.log.map(item => item.text).join(' '), /清空了 1 条未结算的反应提示/);
});

test('队列为空时清空不写日志', () => {
  const { battle } = setup();
  const cleared = clearPrompts(battle);
  assert.equal(pendingOpportunities(cleared).length, 0);
  assert.doesNotMatch(cleared.combat.log.map(item => item.text).join(' '), /清空了/);
});

test('队列超过上限时丢弃最早的提示并写明数量', () => {
  const { battle, guardId, rangerId, foeId } = setup();
  const filled = structuredClone(battle);
  filled.combat.pendingOpportunity = Array.from({ length: PROMPT_QUEUE_LIMIT }, (_, index) => ({
    reactorId: index % 2 === 0 ? guardId : rangerId,
    targetId: `ghost-${index}`,
    kind: 'opportunity',
  }));
  const moved = moveActorToCell(filled, foeId, 4, 1);
  assert.equal(pendingOpportunities(moved).length, PROMPT_QUEUE_LIMIT);
  assert.match(moved.combat.log.map(item => item.text).join(' '), /反应提示超过 8 条，最早的 1 条被丢弃/);
});

test('未超过上限时不写丢弃日志', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  assert.doesNotMatch(moved.combat.log.map(item => item.text).join(' '), /被丢弃/);
});
