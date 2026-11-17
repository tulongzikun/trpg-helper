const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, delayTurn, currentActorId, endTurn } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;

function snapshot(name) {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name, species: '人类', characterClass: '战士', level: 5,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      maxHp: 44, armorClass: 16, speedFt: 30, actions: '', notes: '',
      details: { equipment: '长剑' },
    },
  };
}

function setup() {
  const first = addMonsters(emptyStore(), card, { newBattleName: '延迟', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = first.battles[0];
  const second = addCharacter(first, snapshot('布鲁诺'), { battleId: base.id, side: '友方' }, ids()).store;
  const withAlly = addCharacter(second, snapshot('艾拉'), { battleId: base.id, side: '友方' }, ids()).store.battles[0];
  const hero = withAlly.actors.find(actor => actor.characterSnapshot?.sheet.name === '布鲁诺');
  const ally = withAlly.actors.find(actor => actor.characterSnapshot?.sheet.name === '艾拉');
  const monster = withAlly.actors.find(actor => actor.side === '敌方');
  const battle = startCombat(withAlly, { [hero.id]: 30, [ally.id]: 20, [monster.id]: 10 });
  return { battle, hero, ally, monster };
}

test('延迟行动把当前行动者排到本轮最后', () => {
  const { battle, hero, ally, monster } = setup();
  const delayed = delayTurn(battle, hero.id);
  assert.deepEqual(delayed.combat.order, [ally.id, monster.id, hero.id]);
  assert.equal(currentActorId(delayed), ally.id);
  assert.match(delayed.combat.log.at(-1).text, /延迟行动/);
});

test('延迟后轮到该单位时标记被清除', () => {
  const { battle, hero, ally, monster } = setup();
  let next = delayTurn(battle, hero.id);
  next = endTurn(next);
  next = endTurn(next);
  assert.equal(currentActorId(next), hero.id);
  const state = next.actors.find(item => item.id === hero.id).combat;
  assert.equal(state.delayed, false);
});

test('非当前回合的单位不能延迟行动', () => {
  const { battle, ally } = setup();
  assert.throws(() => delayTurn(battle, ally.id), /只有当前回合的单位可以延迟行动/);
});

test('已经是本轮最后一个行动者时不能延迟', () => {
  const { battle, hero } = setup();
  let next = delayTurn(battle, hero.id);
  next = endTurn(next);
  next = endTurn(next);
  assert.throws(() => delayTurn(next, hero.id), /只有当前回合的单位可以延迟行动|已经是本轮的最后一个行动者/);
});

test('只有一名行动者时不能延迟', () => {
  const base = addMonsters(emptyStore(), card, { newBattleName: '单挑', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = base.battles[0];
  const monster = battle.actors[0];
  const started = startCombat(battle, { [monster.id]: 10 });
  assert.throws(() => delayTurn(started, monster.id), /只有一名行动者时无法延迟/);
});
