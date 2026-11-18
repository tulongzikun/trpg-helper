const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, configureGrid, moveActorToCell, endTurn, pendingOpportunities, undoLastPrompt, clearPrompts,
} = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `undo-prompt-${++counter}`;

const hero = name => ({
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: `char-${name}`,
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
});

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '撤回提示', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero('守卫'), { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 14, height: 8, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = structuredClone(startCombat(battle, { [guard.id]: 10, [foe.id]: 20 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 1, y: 1 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 2, y: 1 };
  return { battle, guardId: guard.id, foeId: foe.id };
}

test('撤回最后一条提示并写日志', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  assert.equal(pendingOpportunities(moved).length, 1);
  const undone = undoLastPrompt(moved);
  assert.equal(pendingOpportunities(undone).length, 0);
  const text = undone.combat.log.map(item => item.text).join(' ');
  assert.match(text, /撤回了 守卫 对 雾影兽 的借机攻击提示/);
});

test('撤回不消耗反应', () => {
  const { battle, guardId, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const undone = undoLastPrompt(moved);
  const guard = undone.actors.find(actor => actor.id === guardId);
  assert.notEqual(guard.combat.reactionUsed, true);
});

test('队列为空时撤回会报错', () => {
  const { battle } = setup();
  assert.throws(() => undoLastPrompt(battle), /没有待结算的反应提示/);
});

test('撤回只去掉最后一条，前面的保留', () => {
  const { battle, foeId } = setup();
  const moved = moveActorToCell(battle, foeId, 4, 1);
  const extra = {
    ...moved,
    combat: {
      ...moved.combat,
      pendingOpportunity: [
        ...moved.combat.pendingOpportunity,
        { reactorId: 'ghost-a', targetId: 'ghost-b', kind: 'opportunity' },
      ],
    },
  };
  const undone = undoLastPrompt(extra);
  const prompts = pendingOpportunities(undone);
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].reactorId, undone.actors.find(actor => actor.side === '友方').id);
});
