const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, startCombat, setSentinel, pendingOpportunities, opportunityAttack, configureGrid, currentActorId } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot(name, equipment) {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name, species: '人类', characterClass: '战士', level: 5,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      maxHp: 44, armorClass: 16, speedFt: 30, actions: '', notes: '',
      details: { equipment },
    },
  };
}

function setup() {
  const first = addMonsters(emptyStore(), card, { newBattleName: '哨兵', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = first.battles[0];
  const second = addCharacter(first, snapshot('布鲁诺', '长棍'), { battleId: base.id, side: '友方' }, ids()).store;
  const withAlly = addCharacter(second, snapshot('艾拉', '长剑'), { battleId: base.id, side: '友方' }, ids()).store.battles[0];
  const hero = withAlly.actors.find(actor => actor.characterSnapshot?.sheet.name === '布鲁诺');
  const ally = withAlly.actors.find(actor => actor.characterSnapshot?.sheet.name === '艾拉');
  const monster = withAlly.actors.find(actor => actor.side === '敌方');
  const initiatives = {};
  initiatives[hero.id] = 25;
  initiatives[ally.id] = 20;
  initiatives[monster.id] = 10;
  let battle = startCombat(withAlly, initiatives);
  battle = configureGrid(battle, { width: 8, height: 8, cellFt: 5 });
  battle = { ...battle, actors: battle.actors.map(actor => actor.id === hero.id ? { ...actor, position: { x: 0, y: 0 } } : actor.id === monster.id ? { ...actor, position: { x: 1, y: 0 } } : actor.id === ally.id ? { ...actor, position: { x: 3, y: 0 } } : actor) };
  const actorOf = id => battle.actors.find(item => item.id === id);
  return { battle, hero: actorOf(hero.id), ally: actorOf(ally.id), monster: actorOf(monster.id) };
}

const asTurn = (battle, actorId) => ({ ...battle, combat: { ...battle.combat, turnIndex: battle.combat.order.indexOf(actorId) } });

const main = { attackBonus: 15, damageExpression: '1d6+3', damageType: '钝击', range: 'melee' };

test('开启哨兵后，被长武器命中的目标本回合移动力清零', () => {
  const { battle, hero, monster } = setup();
  const armed = setSentinel(battle, hero.id, true);
  const result = attack(armed, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:长棍' }, { random: sequence(0.5, 0.5) });
  assert.equal(result.outcome.hit, true);
  const state = result.battle.actors.find(item => item.id === monster.id).combat;
  assert.equal(state.movementUsed, 30);
});

test('没有哨兵专长时不会清零移动力', () => {
  const { battle, hero, monster } = setup();
  const result = attack(battle, { ...main, attackerId: hero.id, targetId: monster.id, weaponId: 'weapon:长棍' }, { random: sequence(0.5, 0.5) });
  const state = result.battle.actors.find(item => item.id === monster.id).combat;
  assert.equal(state.movementUsed, 0);
});

test('邻近敌人攻击其他人时，哨兵可以获得一次反击机会', () => {
  const { battle, hero, ally, monster } = setup();
  const armed = setSentinel(battle, hero.id, true);
  const result = attack(asTurn(armed, monster.id), { ...main, attackerId: monster.id, targetId: ally.id, attackBonus: 15, ignoreDistanceCheck: true, distanceFt: 10, range: 'ranged' }, { random: sequence(0.5) });
  const pending = pendingOpportunities(result.battle);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].reactorId, hero.id);
  assert.equal(pending[0].targetId, monster.id);
  const struck = opportunityAttack(result.battle, hero.id, {}, { random: sequence(0.5, 0.5) });
  assert.equal(pendingOpportunities(struck.battle).length, 0);
});

test('攻击哨兵本人不会触发反击机会', () => {
  const { battle, hero, monster } = setup();
  const armed = setSentinel(battle, hero.id, true);
  const result = attack(asTurn(armed, monster.id), { ...main, attackerId: monster.id, targetId: hero.id }, { random: sequence(0.5) });
  assert.equal(pendingOpportunities(result.battle).length, 0);
});

test('哨兵已经用掉反应时不会产生反击机会', () => {
  const { battle, hero, ally, monster } = setup();
  const armed = setSentinel(battle, hero.id, true);
  const spent = { ...armed, actors: armed.actors.map(actor => actor.id === hero.id ? { ...actor, combat: { ...actor.combat, reactionUsed: true } } : actor) };
  const result = attack(asTurn(spent, monster.id), { ...main, attackerId: monster.id, targetId: ally.id, ignoreDistanceCheck: true, distanceFt: 10, range: 'ranged' }, { random: sequence(0.5) });
  assert.equal(pendingOpportunities(result.battle).length, 0);
});

test('停用哨兵会写日志', () => {
  const { battle, hero } = setup();
  const armed = setSentinel(battle, hero.id, true);
  const off = setSentinel(armed, hero.id, false);
  assert.match(off.combat.log.at(-1).text, /停用哨兵专长/);
});
