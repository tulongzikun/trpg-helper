const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter, validateBattle } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, pendingOpportunities, promptDetail } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `promptpos-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-prompt-pos',
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
    details: { equipment: '戟' },
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '提示坐标', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

test('离开触及的提示记录出发格与落点格', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 5, 1);
  const [prompt] = pendingOpportunities(moved);
  assert.deepEqual(prompt.from, { x: 2, y: 1 });
  assert.deepEqual(prompt.to, { x: 5, y: 1 });
});

test('说明文字写出移动路径', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 5, 1);
  const [prompt] = pendingOpportunities(moved);
  const detail = promptDetail(moved, prompt);
  assert.match(detail, /触发时从（2, 1）移动到（5, 1）/);
  assert.match(detail, /现在相距 20 尺/);
});

test('旧档案里没有坐标的提示仍能生成说明', () => {
  const { battle, guardId, foeId } = setup();
  const detail = promptDetail(battle, { reactorId: guardId, targetId: foeId, kind: 'opportunity' });
  assert.equal(detail.includes('触发时从'), false);
  assert.match(detail, /现在相距 5 尺/);
});

test('存档校验接受带坐标的提示', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 5, 1);
  const prompt = pendingOpportunities(moved)[0];
  assert.doesNotThrow(() => validateBattle(moved));
  const stripped = structuredClone(moved);
  stripped.combat.pendingOpportunity = [{ reactorId: prompt.reactorId, targetId: prompt.targetId }];
  assert.doesNotThrow(() => validateBattle(stripped));
  const bad = structuredClone(moved);
  bad.combat.pendingOpportunity = [{ reactorId: prompt.reactorId, targetId: prompt.targetId, to: { x: 1.5, y: 0 } }];
  assert.throws(() => validateBattle(bad), /战斗数据格式无效/);
});
