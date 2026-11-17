const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { currentActorId, endTurn, setInitiative, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const hero = () => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: { name: '艾拉', species: '人类', characterClass: '战士', level: 5, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8 }, maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: { equipment: '长剑' } },
});

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '先攻', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(), { battleId: battle.id, side: '友方' }, ids());
  const current = added.store.battles[0];
  const friend = current.actors.find(actor => actor.side === '友方');
  const enemy = current.actors.find(actor => actor.side === '敌方');
  const started = startCombat(current, { [friend.id]: 20, [enemy.id]: 10 });
  return { battle: started, friend, enemy };
}

test('调整先攻后重新排序但当前行动者不变', () => {
  const { battle, friend, enemy } = setup();
  const moved = setInitiative(battle, enemy.id, 25);
  assert.equal(moved.combat.order[0], enemy.id);
  assert.equal(currentActorId(moved), friend.id);
  assert.equal(moved.actors.find(actor => actor.id === enemy.id).combat.initiative, 25);
  assert.ok(moved.combat.log.some(item => /先攻改为 25/.test(item.text)));
});

test('下一个回合按调整后的顺序推进', () => {
  const { battle, friend, enemy } = setup();
  const moved = setInitiative(battle, enemy.id, 25);
  const next = endTurn(moved);
  assert.equal(currentActorId(next), enemy.id);
  assert.equal(next.combat.order[next.combat.turnIndex], enemy.id);
});

test('先攻值非法、单位不存在或战斗未开始时拒绝', () => {
  const { battle, friend } = setup();
  assert.throws(() => setInitiative(battle, friend.id, 99), /先攻值须为 -20 至 60 的整数/);
  assert.throws(() => setInitiative(battle, 'missing', 10), /该单位不在战斗中/);
  assert.throws(() => setInitiative({ ...battle, combat: undefined }, friend.id, 10), /战斗尚未开始/);
});

test('先攻相同时保持原有顺序', () => {
  const { battle, friend, enemy } = setup();
  const tied = setInitiative(battle, enemy.id, 20);
  assert.deepEqual(tied.combat.order, [friend.id, enemy.id]);
});
