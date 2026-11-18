const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, pendingOpportunities, opportunityAttack, triggerDistance } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `triggerdist-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = equipment => ({
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-trigger-distance',
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

function setup(equipment) {
  let store = addMonsters(emptyStore(), card, { newBattleName: '触发距离', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero(equipment), { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = structuredClone(startCombat(battle, { [guard.id]: 10, [foe.id]: 20 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 1, y: 1 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 2, y: 1 };
  return { battle, guardId: guard.id, foeId: foe.id };
}

test('提示里的触发距离按出发格计算', () => {
  const { battle, foeId } = setup('长剑');
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const [prompt] = pendingOpportunities(moved);
  assert.equal(triggerDistance(moved, prompt), 5);
});

test('没有坐标的旧提示算不出距离', () => {
  const { battle, guardId, foeId } = setup('长剑');
  assert.equal(triggerDistance(battle, { reactorId: guardId, targetId: foeId, kind: 'opportunity' }), undefined);
});

test('借机攻击后战报写出触发距离', () => {
  const { battle, guardId, foeId } = setup('戟');
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const shot = opportunityAttack(moved, guardId, {}, { random: sequence(0.9, 0.5) });
  const text = shot.battle.combat.log.map(item => item.text).join(' ');
  assert.match(text, /触发时 守卫 与 雾影兽 相距 5 尺/);
  assert.match(text, /借机出手按该距离判定/);
});
