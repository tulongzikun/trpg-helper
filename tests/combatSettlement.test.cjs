const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { damageActor, startCombat, toggleCondition } = require('../apps/web/src/combat.ts');
const { settleBattle, settlementText } = require('../apps/web/src/combatSettlement.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function snapshot() {
  return {
    schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
    sheet: {
      name: '艾拉', species: '人类', characterClass: '战士', level: 5,
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
      maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: {},
    },
  };
}

function setup(count = 1) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '结算', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const added = addCharacter({ version: 1, battles: [base] }, snapshot(), { battleId: base.id, side: '友方' }, ids());
  const battle = added.store.battles[0];
  const hero = battle.actors.find(actor => actor.side === '友方');
  const monsters = battle.actors.filter(actor => actor.side === '敌方');
  const initiatives = { [hero.id]: 20 };
  monsters.forEach((monster, index) => { initiatives[monster.id] = 10 - index; });
  return { battle: startCombat(battle, initiatives), hero, monsters };
}

test('结算摘要包含各单位生命与资源', () => {
  const { battle, hero, monsters } = setup(2);
  const hit = damageActor(battle, hero.id, 12, '钝击', { random: sequence(0.5) }).battle;
  const summary = settleBattle(hit);
  assert.equal(summary.actors.length, 3);
  const heroRow = summary.actors.find(row => row.actorId === hero.id);
  assert.equal(heroRow.currentHp, 28);
  assert.equal(heroRow.maxHp, 40);
  assert.equal(heroRow.side, '友方');
  assert.equal(heroRow.resources.actionUsed, false);
  assert.equal(summary.completed, false);
  assert.equal(summary.actors.filter(row => row.side === '敌方').length, 2);
});

test('击败全部敌人后标记完成并给出经验', () => {
  const { battle, hero, monsters } = setup(1);
  const dead = damageActor(battle, monsters[0].id, 999, '钝击', { random: sequence(0.5) }).battle;
  const summary = settleBattle(dead);
  assert.equal(summary.completed, true);
  assert.equal(summary.defeated, 1);
  assert.ok(summary.xp > 0);
  assert.ok(summary.notes.some(note => note.includes('阵亡')));
});

test('倒地与需要回血会写进提示', () => {
  const { battle, hero } = setup(1);
  const wounded = damageActor(battle, hero.id, 30, '钝击', { random: sequence(0.5) }).battle;
  const summary = settleBattle(wounded);
  assert.ok(summary.notes.some(note => note.includes('需要回血') && note.includes('10/40')));
});

test('战报文本包含经验与各单位行', () => {
  const { battle, hero } = setup(1);
  const prone = toggleCondition(battle, hero.id, '倒地');
  const text = settlementText(prone);
  assert.ok(text.includes('艾拉（友方）'));
  assert.ok(text.includes('倒地'));
  assert.ok(text.includes('战斗进行中') || text.includes('战斗结束'));
});
