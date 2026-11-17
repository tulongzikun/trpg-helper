const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, grapple, moveActorToCell, shove, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot() {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '格雷', species: '人类', characterClass: '战士', level: 5,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      maxHp: 44, armorClass: 16, speedFt: 30, actions: '', notes: '',
      details: { equipment: '长剑', skillProficiencies: ['运动'] },
    },
  };
}

function setup() {
  const base = addMonsters(emptyStore(), card, { newBattleName: '擒抱', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  return { battle: started, hero, monster };
}

test('擒抱成功给目标加上擒抱状态', () => {
  const { battle, hero, monster } = setup();
  const result = grapple(battle, { attackerId: hero.id, targetId: monster.id }, { random: sequence(0.95, 0.05) });
  assert.equal(result.outcome.success, true);
  const target = result.battle.actors.find(actor => actor.id === monster.id);
  assert.ok(target.combat.conditions.includes('擒抱'));
  assert.equal(result.battle.actors.find(actor => actor.id === hero.id).combat.actionUsed, true);
});

test('平局与失败都不会加上擒抱状态', () => {
  const { battle, hero, monster } = setup();
  const result = grapple(battle, { attackerId: hero.id, targetId: monster.id }, { random: sequence(0.05, 0.95) });
  assert.equal(result.outcome.success, false);
  const target = result.battle.actors.find(actor => actor.id === monster.id);
  assert.ok(!target.combat.conditions.includes('擒抱'));
});

test('目标超出触及范围时拒绝擒抱', () => {
  const { battle, hero, monster } = setup();
  const withGrid = configureGrid(battle, { width: 8, height: 8, cellFt: 5 });
  const placed = moveActorToCell(moveActorToCell(withGrid, hero.id, 0, 0), monster.id, 4, 0);
  assert.throws(() => grapple(placed, { attackerId: hero.id, targetId: monster.id }, { random: sequence(0.9) }), /超出擒抱范围/);
});

test('被擒抱的单位无法移动', () => {
  const { battle, hero, monster } = setup();
  const withGrid = configureGrid(battle, { width: 8, height: 8, cellFt: 5 });
  const placed = moveActorToCell(moveActorToCell(withGrid, hero.id, 0, 0), monster.id, 1, 0);
  const grappled = grapple(placed, { attackerId: hero.id, targetId: monster.id }, { random: sequence(0.95, 0.05) }).battle;
  const monsterTurn = { ...grappled, combat: { ...grappled.combat, turnIndex: (grappled.combat.turnIndex + 1) % grappled.combat.order.length } };
  assert.throws(() => moveActorToCell(monsterTurn, monster.id, 1, 1), /被擒抱的单位无法移动/);
});

test('推倒成功后目标获得倒地状态', () => {
  const { battle, hero, monster } = setup();
  const result = shove(battle, { attackerId: hero.id, targetId: monster.id, effect: 'prone' }, { random: sequence(0.95, 0.05) });
  const target = result.battle.actors.find(actor => actor.id === monster.id);
  assert.ok(target.combat.conditions.includes('倒地'));
});

test('推撞把目标沿反方向推开一格', () => {
  const { battle, hero, monster } = setup();
  const withGrid = configureGrid(battle, { width: 8, height: 8, cellFt: 5 });
  const placed = moveActorToCell(moveActorToCell(withGrid, hero.id, 0, 0), monster.id, 1, 0);
  const result = shove(placed, { attackerId: hero.id, targetId: monster.id, effect: 'push' }, { random: sequence(0.95, 0.05) });
  const target = result.battle.actors.find(actor => actor.id === monster.id);
  assert.deepEqual(target.position, { x: 2, y: 0 });
  assert.ok(result.battle.combat.log.some(item => /被推开 5 尺/.test(item.text)));
});

test('未启用方格时推撞只记录日志', () => {
  const { battle, hero, monster } = setup();
  const result = shove(battle, { attackerId: hero.id, targetId: monster.id, effect: 'push' }, { random: sequence(0.95, 0.05) });
  assert.ok(result.battle.combat.log.some(item => /未启用方格/.test(item.text)));
});
