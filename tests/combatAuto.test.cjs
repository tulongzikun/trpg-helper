const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, currentActorId, endTurn, moveActorToCell, startCombat, toggleWallCell } = require('../apps/web/src/combat.ts');
const { autoAct, autoSide, autoTurn } = require('../apps/web/src/combatAuto.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot(actions = '短弓：+7 命中，1d8+3 穿刺伤害，射程 80/320 尺', equipment = '短弓') {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '艾拉', species: '人类', characterClass: '游侠', level: 5,
      abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 8 },
      maxHp: 40, armorClass: 15, speedFt: 30, actions, notes: '',
      details: { equipment },
    },
  };
}

function setup(count = 1, actions, equipment) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '自动', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(actions, equipment), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monsters = battle.actors.filter(actor => actor.side === '敌方');
  const initiatives = { [hero.id]: 20 };
  monsters.forEach((monster, index) => { initiatives[monster.id] = 10 - index; });
  const started = startCombat(battle, initiatives);
  return { battle: started, hero, monsters };
}

test('射程内直接攻击最优目标', () => {
  const { battle, hero } = setup();
  const result = autoAct(battle, hero.id, { random: sequence(0.5, 0.5) });
  assert.equal(result.kind, 'attack');
  assert.ok(result.battle.combat.log.some(item => /命中/.test(item.text) || /未命中/.test(item.text)));
  assert.equal(result.battle.actors.find(actor => actor.id === hero.id).combat.actionUsed, true);
});

test('射程外时朝目标移动一格', () => {
  const { battle, hero, monsters } = setup(1, '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', '长剑');
  const withGrid = configureGrid(battle, { width: 24, height: 24, cellFt: 5 });
  const placed = moveActorToCell(moveActorToCell(withGrid, hero.id, 0, 0), monsters[0].id, 0, 20);
  const result = autoAct(placed, hero.id, { random: sequence(0.5) });
  assert.equal(result.kind, 'move');
  const moved = result.battle.actors.find(actor => actor.id === hero.id);
  assert.ok(moved.position.x >= 1 || moved.position.y >= 1);
  assert.ok(moved.combat.movementUsed > 0);
});

test('没有敌人时原地待命', () => {
  const { battle, hero } = setup();
  const cleared = structuredClone(battle);
  for (const actor of cleared.actors) {
    if (actor.side === '敌方') actor.combat.status = 'dead';
  }
  const result = autoAct(cleared, hero.id, { random: sequence(0.5) });
  assert.equal(result.kind, 'wait');
  assert.equal(currentActorId(result.battle), hero.id);
});

test('被墙包围时不再移动', () => {
  const { battle, hero, monsters } = setup();
  let withGrid = configureGrid(battle, { width: 8, height: 8, cellFt: 5 });
  withGrid = moveActorToCell(moveActorToCell(withGrid, hero.id, 0, 0), monsters[0].id, 7, 7);
  withGrid = toggleWallCell(withGrid, 1, 0);
  withGrid = toggleWallCell(withGrid, 0, 1);
  withGrid = toggleWallCell(withGrid, 1, 1);
  const result = autoAct(withGrid, hero.id, { random: sequence(0.5) });
  assert.equal(result.kind, 'wait');
});

test('多目标时优先攻击血量比例更低者', () => {
  const { battle, hero } = setup(2);
  const wounded = structuredClone(battle);
  const second = wounded.actors.filter(actor => actor.side === '敌方')[1];
  second.currentHp = 1;
  const result = autoAct(wounded, hero.id, { random: sequence(0.5, 0.5) });
  assert.equal(result.kind, 'attack');
  const after = result.battle.actors.find(actor => actor.id === second.id);
  assert.equal(after.currentHp, 0);
  assert.equal(after.combat.status, 'dead');
});



test('自动回合：射程外先靠近再攻击', () => {
  const { battle, hero, monsters } = setup(1, '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', '长剑');
  let placed = configureGrid(battle, { width: 24, height: 24, cellFt: 5 });
  placed = moveActorToCell(moveActorToCell(placed, hero.id, 0, 0), monsters[0].id, 0, 4);
  const result = autoTurn(placed, hero.id, { random: sequence(0.5, 0.5, 0.5, 0.5) }, { endTurn: false });
  assert.equal(result.kind, 'attack');
  assert.ok(result.steps.length >= 2);
  const actor = result.battle.actors.find(item => item.id === hero.id);
  assert.equal(actor.combat.actionUsed, true);
  assert.ok(result.battle.combat.log.some(item => /命中/.test(item.text) || /未命中/.test(item.text)));
});

test('自动回合：endTurn 为 false 时保持当前行动者', () => {
  const { battle, hero } = setup();
  const result = autoTurn(battle, hero.id, { random: sequence(0.5, 0.5) }, { endTurn: false });
  assert.equal(currentActorId(result.battle), hero.id);
});

test('自动回合：默认在行动后结束回合', () => {
  const { battle, hero } = setup();
  const result = autoTurn(battle, hero.id, { random: sequence(0.5, 0.5) });
  assert.notEqual(currentActorId(result.battle), hero.id);
  assert.ok(result.steps.includes('自动行动：结束回合。'));
});

test('自动回合：无法行动时待命并结束回合', () => {
  const { battle, hero, monsters } = setup();
  let placed = configureGrid(battle, { width: 12, height: 12, cellFt: 5 });
  placed = moveActorToCell(moveActorToCell(placed, hero.id, 0, 0), monsters[0].id, 5, 5);
  for (const [x, y] of [[1, 0], [0, 1], [1, 1]]) placed = toggleWallCell(placed, x, y);
  const result = autoTurn(placed, hero.id, { random: sequence(0.5) });
  assert.equal(result.kind, 'wait');
  assert.ok(result.steps.some(text => text.includes('原地待命')));
  assert.ok(result.steps.includes('自动行动：结束回合。'));
  assert.notEqual(currentActorId(result.battle), hero.id);
});


test('整轮自动：连续推进两个敌方单位', () => {
  const { battle, hero } = setup(2);
  const atEnemy = endTurn(battle);
  const result = autoSide(atEnemy, '敌方', { random: sequence(0.5, 0.5, 0.5, 0.5, 0.5, 0.5) });
  assert.equal(result.turns.length, 2);
  assert.ok(result.turns.every(text => text.includes('自动行动')));
  assert.equal(currentActorId(result.battle), hero.id);
});

test('整轮自动：当前不是该阵营时不做任何事', () => {
  const { battle, hero } = setup(2);
  const result = autoSide(battle, '敌方', { random: sequence(0.5) });
  assert.equal(result.turns.length, 0);
  assert.equal(currentActorId(result.battle), hero.id);
});

test('整轮自动：遵守 maxTurns 上限', () => {
  const { battle } = setup(2);
  const atEnemy = endTurn(battle);
  const result = autoSide(atEnemy, '敌方', { random: sequence(0.5, 0.5, 0.5) }, { maxTurns: 1 });
  assert.equal(result.turns.length, 1);
});


test('自动回合：从 30 尺外连续移动后仍能攻击', () => {
  const { battle, hero, monsters } = setup(1, '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', '长剑');
  let placed = configureGrid(battle, { width: 12, height: 12, cellFt: 5 });
  placed = moveActorToCell(moveActorToCell(placed, hero.id, 0, 0), monsters[0].id, 0, 6);
  const result = autoTurn(placed, hero.id, { random: sequence(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5) }, { endTurn: false });
  assert.equal(result.kind, 'attack');
  assert.ok(result.steps.length >= 6);
  const actor = result.battle.actors.find(item => item.id === hero.id);
  assert.equal(actor.combat.actionUsed, true);
  assert.ok(actor.combat.movementUsed >= 25);
  assert.ok(result.battle.combat.log.some(item => /命中/.test(item.text) || /未命中/.test(item.text)));
});

test('自动行动：轻型武器命中后追加副手攻击', () => {
  const { battle, hero, monsters } = setup(1, '匕首：+5 命中，1d4+3 穿刺伤害，触及 5 尺', '匕首');
  let placed = configureGrid(battle, { width: 8, height: 8, cellFt: 5 });
  placed = moveActorToCell(moveActorToCell(placed, hero.id, 0, 0), monsters[0].id, 0, 1);
  const result = autoAct(placed, hero.id, { random: sequence(0.5, 0.5, 0.5, 0.5) });
  assert.equal(result.kind, 'attack');
  assert.match(result.text, /副手武器追加/);
  const actor = result.battle.actors.find(item => item.id === hero.id);
  assert.equal(actor.combat.bonusUsed, true);
});

test('自动行动：非轻型武器不追加副手攻击', () => {
  const { battle, hero, monsters } = setup(1, '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', '长剑');
  let placed = configureGrid(battle, { width: 8, height: 8, cellFt: 5 });
  placed = moveActorToCell(moveActorToCell(placed, hero.id, 0, 0), monsters[0].id, 0, 1);
  const result = autoAct(placed, hero.id, { random: sequence(0.5, 0.5, 0.5, 0.5) });
  assert.equal(result.kind, 'attack');
  const actor = result.battle.actors.find(item => item.id === hero.id);
  assert.equal(actor.combat.bonusUsed, false);
});
