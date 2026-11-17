const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, moveActorToCell, setActorHp, startCombat, toggleWallCell } = require('../apps/web/src/combat.ts');
const { autoAct } = require('../apps/web/src/combatAuto.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot() {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '艾拉', species: '人类', characterClass: '游侠', level: 5,
      abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 8 },
      maxHp: 40, armorClass: 15, speedFt: 30,
      actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '',
      details: { equipment: '长剑' },
    },
  };
}

function setup(heroCell = [5, 5], monsterCell = [6, 5]) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '撤退', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monster = battle.actors.find(actor => actor.side === '敌方');
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  const withGrid = configureGrid(started, { width: 8, height: 8, cellFt: 5 });
  const placed = moveActorToCell(moveActorToCell(withGrid, hero.id, heroCell[0], heroCell[1]), monster.id, monsterCell[0], monsterCell[1]);
  return { battle: placed, hero, monster };
}

test('低血量被贴身时先撤离再后撤', () => {
  const { battle, hero, monster } = setup();
  const hurt = setActorHp(battle, hero.id, 10);
  const result = autoAct(hurt, hero.id, { random: sequence(0.5, 0.5) });
  assert.equal(result.kind, 'retreat');
  const after = result.battle.actors.find(actor => actor.id === hero.id);
  assert.equal(after.combat.disengaged, true);
  const moved = after.position;
  assert.ok(moved.x !== 5 || moved.y !== 5, '应该离开原来的格子');
  const monsterPosition = result.battle.actors.find(actor => actor.id === monster.id).position;
  const before = Math.max(Math.abs(5 - monsterPosition.x), Math.abs(5 - monsterPosition.y));
  const now = Math.max(Math.abs(moved.x - monsterPosition.x), Math.abs(moved.y - monsterPosition.y));
  assert.ok(now > before, '应该比原来离敌人更远');
  assert.match(result.text, /撤离并后撤到/);
});

test('血量充足时不撤退，照常攻击', () => {
  const { battle, hero } = setup();
  const result = autoAct(battle, hero.id, { random: sequence(0.5, 0.5) });
  assert.equal(result.kind, 'attack');
  assert.doesNotMatch(result.text, /后撤/);
});

test('本回合已用动作时只能后撤，无法撤离', () => {
  const { battle, hero } = setup();
  const hurt = setActorHp(battle, hero.id, 10);
  const spent = { ...hurt, actors: hurt.actors.map(actor => actor.id === hero.id ? { ...actor, combat: { ...actor.combat, actionUsed: true } } : actor) };
  const result = autoAct(spent, hero.id, { random: sequence(0.5, 0.5) });
  assert.equal(result.kind, 'retreat');
  const after = result.battle.actors.find(actor => actor.id === hero.id);
  assert.notEqual(after.combat.disengaged, true);
  assert.match(result.text, /后撤到/);
});

test('未启用方格时只撤离不移动', () => {
  const { battle, hero } = setup();
  const hurt = setActorHp(battle, hero.id, 10);
  const noGrid = { ...hurt, grid: undefined };
  const result = autoAct(noGrid, hero.id, { random: sequence(0.5, 0.5) });
  assert.equal(result.kind, 'retreat');
  assert.match(result.text, /未启用方格/);
  assert.deepEqual(result.battle.actors.find(actor => actor.id === hero.id).position, { x: 5, y: 5 });
});

test('四周无路可退时只撤离', () => {
  const { battle, hero } = setup([0, 0], [1, 0]);
  const hurt = setActorHp(battle, hero.id, 10);
  const cornered = toggleWallCell(toggleWallCell(hurt, 0, 1), 1, 1);
  const result = autoAct(cornered, hero.id, { random: sequence(0.5, 0.5) });
  assert.equal(result.kind, 'retreat');
  assert.match(result.text, /无路可退/);
});
