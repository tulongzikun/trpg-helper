const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, pendingOpportunities, clearPrompts, readyAction,
} = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `clear-kind-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-clear-kind',
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
  let store = addMonsters(emptyStore(), card, { newBattleName: '分类清空', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 14, height: 8, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = structuredClone(startCombat(battle, { [guard.id]: 20, [foe.id]: 10 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 1, y: 1 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 2, y: 1 };
  return { battle, guardId: guard.id, foeId: foe.id };
}

const logText = battle => battle.combat.log.map(item => item.text).join(' ');

test('只清借机攻击时保留准备动作提示', () => {
  const { battle, guardId, foeId } = setup();
  const filled = structuredClone(battle);
  filled.combat.pendingOpportunity = [
    { reactorId: guardId, targetId: foeId, kind: 'opportunity' },
    { reactorId: guardId, targetId: foeId, kind: 'ready' },
  ];
  const cleared = clearPrompts(filled, {}, 'opportunity');
  const kinds = pendingOpportunities(cleared).map(item => item.kind);
  assert.deepEqual(kinds, ['ready']);
  assert.match(logText(cleared), /清空了 1 条借机攻击提示/);
});

test('只清准备动作时保留借机攻击提示', () => {
  const { battle, guardId, foeId } = setup();
  const filled = structuredClone(battle);
  filled.combat.pendingOpportunity = [
    { reactorId: guardId, targetId: foeId, kind: 'opportunity' },
    { reactorId: guardId, targetId: foeId, kind: 'ready' },
  ];
  const cleared = clearPrompts(filled, {}, 'ready');
  const kinds = pendingOpportunities(cleared).map(item => item.kind);
  assert.deepEqual(kinds, ['opportunity']);
  assert.match(logText(cleared), /清空了 1 条准备动作提示/);
});

test('指定类别没有匹配提示时不改动也不写日志', () => {
  const { battle, guardId, foeId } = setup();
  const filled = structuredClone(battle);
  filled.combat.pendingOpportunity = [{ reactorId: guardId, targetId: foeId, kind: 'opportunity' }];
  const cleared = clearPrompts(filled, {}, 'ready');
  assert.equal(pendingOpportunities(cleared).length, 1);
  assert.doesNotMatch(logText(cleared), /清空了/);
});

test('不传类别时清空全部', () => {
  const { battle, guardId, foeId } = setup();
  const filled = structuredClone(battle);
  filled.combat.pendingOpportunity = [
    { reactorId: guardId, targetId: foeId, kind: 'opportunity' },
    { reactorId: guardId, targetId: foeId, kind: 'ready' },
  ];
  const cleared = clearPrompts(filled);
  assert.equal(pendingOpportunities(cleared).length, 0);
  assert.match(logText(cleared), /清空了 2 条未结算的反应提示/);
});
