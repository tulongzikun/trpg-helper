const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, pendingOpportunities, promptDetail, setEnterReachOpportunity } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `enterleave-${++counter}`;

const hero = equipment => ({
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-enter-leave',
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
    details: { equipment },
  },
});

function setup(equipment, startX) {
  let store = addMonsters(emptyStore(), card, { newBattleName: '进出触及', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero(equipment), { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 14, height: 8, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = structuredClone(startCombat(battle, { [guard.id]: 10, [foe.id]: 20 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 1, y: 1 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: startX, y: 1 };
  return { battle, guardId: guard.id, foeId: foe.id };
}

test('走出触及写成「离开」并给出路径', () => {
  const { battle, foeId } = setup('长剑', 2);
  const moved = moveActorToCell(battle, foeId, 5, 1);
  const [prompt] = pendingOpportunities(moved);
  const detail = promptDetail(moved, prompt);
  assert.match(detail, /离开 守卫 的 5 尺触及/);
  assert.match(detail, /从（2, 1）移动到（5, 1）/);
});

test('走进长武器触及写成「进入」', () => {
  const { battle, foeId } = setup('戟', 4);
  const enabled = setEnterReachOpportunity(battle, true);
  const moved = moveActorToCell(enabled, foeId, 2, 1);
  const [prompt] = pendingOpportunities(moved);
  const detail = promptDetail(moved, prompt);
  assert.match(detail, /进入 守卫 的 10 尺触及/);
  assert.match(detail, /从（4, 1）移动到（2, 1）/);
});

test('没有坐标时仍按当前间距判断', () => {
  const { battle, guardId, foeId } = setup('戟', 1);
  const inside = promptDetail(battle, { reactorId: guardId, targetId: foeId, kind: 'opportunity' });
  assert.match(inside, /进入 守卫 的 10 尺触及/);
  assert.equal(inside.includes('移动'), false);
});
