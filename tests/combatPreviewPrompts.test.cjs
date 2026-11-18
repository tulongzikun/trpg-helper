const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, pendingOpportunities, previewPrompts,
} = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `preview-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-preview',
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
  let store = addMonsters(emptyStore(), card, { newBattleName: '预览提示', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

test('能出手的反应在预览里标为可结算', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const [row] = previewPrompts(moved);
  assert.equal(row.ok, true);
  assert.equal(row.reactorId, guardId);
  assert.equal(row.kind, '借机攻击');
  assert.equal(row.reason, undefined);
});

test('已经用过反应的单位在预览里被标出原因', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const guard = moved.actors.find(actor => actor.side === '友方');
  guard.combat.reactionUsed = true;
  const [row] = previewPrompts(moved);
  assert.equal(row.ok, false);
  assert.match(row.reason, /已经使用过反应/);
});

test('麻痹的反应方在预览里报无法行动', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const guard = moved.actors.find(actor => actor.side === '友方');
  guard.combat.conditions.push('麻痹');
  const [row] = previewPrompts(moved);
  assert.equal(row.ok, false);
  assert.match(row.reason, /无法行动/);
});

test('没有待确认提示时预览为空', () => {
  const { battle } = setup();
  assert.deepEqual(previewPrompts(battle), []);
});
