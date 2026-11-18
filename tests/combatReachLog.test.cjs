const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, setEnterReachOpportunity } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `reachlog-${++counter}`;

const hero = equipment => ({
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-reach-log',
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
  let store = addMonsters(emptyStore(), card, { newBattleName: '触及日志', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero(equipment), { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 14, height: 8, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  // 让敌人先行动，才能测它自己走进／走出触及范围
  battle = structuredClone(startCombat(battle, { [guard.id]: 10, [foe.id]: 20 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 0, y: 1 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: startX, y: 1 };
  return { battle, guardId: guard.id, foeId: foe.id };
}

const logText = battle => battle.combat.log.map(item => item.text).join(' ');

test('普通武器离开触及的日志写出 5 尺', () => {
  const { battle, foeId } = setup('长剑', 1);
  const moved = moveActorToCell(battle, foeId, 4, 1);
  assert.match(logText(moved), /离开 守卫 的触及范围（5 尺）/);
});

test('长武器进入触及的日志写出 10 尺', () => {
  const { battle, foeId } = setup('戟', 3);
  const enabled = setEnterReachOpportunity(battle, true);
  const moved = moveActorToCell(enabled, foeId, 2, 1);
  assert.match(logText(moved), /进入 守卫 的触及范围（10 尺）/);
});

test('长武器离开触及的日志同样带 10 尺', () => {
  const { battle, foeId } = setup('戟', 1);
  const moved = moveActorToCell(battle, foeId, 4, 1);
  assert.match(logText(moved), /离开 守卫 的触及范围（10 尺）/);
});
