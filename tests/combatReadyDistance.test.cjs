const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, endTurn, pendingOpportunities, resolveReadyPrompt, readyAction, triggerDistance, triggerReadyAction,
} = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `ready-dist-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-ready-distance',
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
  let store = addMonsters(emptyStore(), card, { newBattleName: '准备距离', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 14, height: 8, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = structuredClone(startCombat(battle, { [guard.id]: 20, [foe.id]: 10 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 2, y: 2 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 6, y: 2 };
  battle = readyAction(battle, guard.id, { action: '攻击靠近的敌人', trigger: '敌人进入触及' });
  return { battle, guardId: guard.id, foeId: foe.id };
}

test('准备动作的提示带触发瞬间的距离', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(endTurn(battle), foeId, 3, 2);
  const [prompt] = pendingOpportunities(moved);
  assert.equal(prompt.kind, 'ready');
  assert.equal(prompt.reactorId, guardId);
  assert.equal(triggerDistance(moved, prompt), 20);
});

test('结算准备动作后战报写出触发距离', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(endTurn(battle), foeId, 3, 2);
  const resolved = resolveReadyPrompt(moved, guardId);
  const text = resolved.combat.log.map(item => item.text).join(' ');
  assert.match(text, /用反应执行准备好的「攻击靠近的敌人」/);
  assert.match(text, /触发时 守卫 与 雾影兽 相距 20 尺/);
  assert.match(text, /准备动作按触发瞬间的距离结算/);
});

test('没有提示对象时准备动作不写触发距离', () => {
  const { battle, guardId } = setup();
  const resolved = triggerReadyAction(battle, guardId);
  const text = resolved.combat.log.map(item => item.text).join(' ');
  assert.match(text, /用反应执行准备好的「攻击靠近的敌人」/);
  assert.doesNotMatch(text, /触发时/);
});
