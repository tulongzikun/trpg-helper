const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, setActorHp, stabilize, rollDeathSave, configureGrid, endTurn, setAutoDeathSaves, damageActor } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

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
  const first = addMonsters(emptyStore(), card, { newBattleName: '稳定', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = first.battles[0];
  const second = addCharacter(first, snapshot('布鲁诺'), { battleId: base.id, side: '友方' }, ids()).store;
  const withAlly = addCharacter(second, snapshot('艾拉'), { battleId: base.id, side: '友方' }, ids()).store.battles[0];
  const hero = withAlly.actors.find(actor => actor.characterSnapshot?.sheet.name === '布鲁诺');
  const ally = withAlly.actors.find(actor => actor.characterSnapshot?.sheet.name === '艾拉');
  const monster = withAlly.actors.find(actor => actor.side === '敌方');
  const initiatives = { [hero.id]: 25, [ally.id]: 20, [monster.id]: 10 };
  let battle = startCombat(withAlly, initiatives);
  battle = configureGrid(battle, { width: 8, height: 8, cellFt: 5 });
  battle = { ...battle, actors: battle.actors.map(actor => actor.id === hero.id ? { ...actor, position: { x: 0, y: 0 } } : actor.id === ally.id ? { ...actor, position: { x: 1, y: 0 } } : actor.id === monster.id ? { ...actor, position: { x: 5, y: 5 } } : actor) };
  battle = setActorHp(battle, ally.id, 0);
  const live = id => battle.actors.find(item => item.id === id);
  return { battle, hero: live(hero.id), ally: live(ally.id), monster: live(monster.id) };
}

test('医药检定成功后倒地单位被稳定', () => {
  const { battle, hero, ally } = setup();
  const result = stabilize(battle, hero.id, ally.id, { random: sequence(0.5) });
  assert.equal(result.outcome.success, true);
  const state = result.battle.actors.find(item => item.id === ally.id).combat;
  assert.equal(state.stable, true);
  assert.match(result.battle.combat.log.at(-1).text, /稳定了/);
});

test('医药检定失败时不会稳定，但动作照常消耗', () => {
  const { battle, hero, ally } = setup();
  const result = stabilize(battle, hero.id, ally.id, { random: sequence(0) });
  assert.equal(result.outcome.success, false);
  const state = result.battle.actors.find(item => item.id === ally.id).combat;
  assert.equal(state.stable, undefined);
  const healer = result.battle.actors.find(item => item.id === hero.id).combat;
  assert.equal(healer.actionUsed, true);
  assert.match(result.battle.combat.log.at(-1).text, /失败/);
});

test('稳定后再次受伤会取消稳定并追加一次死亡豁免失败', () => {
  const { battle, hero, ally } = setup();
  const stabilized = stabilize(battle, hero.id, ally.id, { random: sequence(0.5) }).battle;
  const damaged = damageActor(stabilized, ally.id, 5, '挥砍').battle;
  const state = damaged.actors.find(item => item.id === ally.id).combat;
  assert.equal(state.stable, undefined);
  assert.equal(state.deathSaves.failures, 1);
});

test('已稳定的单位不再需要掷死亡豁免', () => {
  const { battle, hero, ally } = setup();
  const stabilized = stabilize(battle, hero.id, ally.id, { random: sequence(0.5) }).battle;
  assert.throws(() => rollDeathSave(stabilized, ally.id, { random: sequence(0.5) }), /已经稳定/);
});

test('开启自动死亡豁免时，已稳定的单位不会被自动掷骰', () => {
  const { battle, hero, ally } = setup();
  const stabilized = stabilize(battle, hero.id, ally.id, { random: sequence(0.5) }).battle;
  const auto = setAutoDeathSaves(stabilized, true);
  let next = endTurn(auto);
  next = endTurn(next);
  next = endTurn(next);
  const state = next.actors.find(item => item.id === ally.id).combat;
  assert.equal(state.deathSaves.successes, 0);
  assert.equal(state.deathSaves.failures, 0);
  assert.equal(state.stable, true);
});

test('目标没有倒地或距离过远时不能稳定伤势', () => {
  const { battle, hero, ally, monster } = setup();
  assert.throws(() => stabilize(battle, hero.id, monster.id, { random: sequence(0.5) }), /只有 0 点生命值倒地的单位需要稳定伤势/);
  const far = { ...battle, actors: battle.actors.map(actor => actor.id === ally.id ? { ...actor, position: { x: 6, y: 6 } } : actor) };
  assert.throws(() => stabilize(far, hero.id, ally.id, { random: sequence(0.5) }), /5 尺内/);
});
