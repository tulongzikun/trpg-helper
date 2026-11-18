const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, attack } = require('../apps/web/src/combat.ts');
const { battleCsv } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `avg-dmg-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-avg-dmg',
  revision: 1,
  publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '守卫',
    species: '人类',
    characterClass: '战士',
    level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 60,
    armorClass: 16,
    speedFt: 30,
    actions: '',
    details: { equipment: '长剑' },
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '平均伤害', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 10, height: 10, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = structuredClone(startCombat(battle, { [guard.id]: 20, [foe.id]: 10 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 1, y: 1 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 2, y: 1 };
  return { battle, guardId: guard.id, foeId: foe.id };
}

const swing = { attackBonus: 5, damageExpression: '1d8', damageType: '挥砍' };

function cells(csv) {
  const rows = csv.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean).map(line => line.split(','));
  return { header: rows[0], rows: rows.slice(1, -1), totals: rows.at(-1) };
}

test('表头在造成伤害之后多出平均伤害列', () => {
  const { battle } = setup();
  const { header } = cells(battleCsv(battle));
  assert.equal(header.length, 16);
  assert.equal(header[8], '造成伤害');
  assert.equal(header[9], '平均伤害');
  assert.equal(header[10], '承受伤害');
});

test('命中一次时平均伤害等于总伤害', () => {
  const { battle, guardId, foeId } = setup();
  const hit = attack(battle, { attackerId: guardId, targetId: foeId, ...swing }, { random: () => 0.5 });
  const row = cells(battleCsv(hit.battle)).rows.find(item => item[0] === '守卫');
  const total = Number(row[8]);
  assert.ok(total > 0);
  assert.equal(Number(row[9]), total);
});

test('没有命中时平均伤害为 0', () => {
  const { battle, guardId, foeId } = setup();
  const miss = attack(battle, { attackerId: guardId, targetId: foeId, ...swing }, { random: () => 0.01 });
  const row = cells(battleCsv(miss.battle)).rows.find(item => item[0] === '守卫');
  assert.equal(row[5], '0');
  assert.equal(row[9], '0');
});

test('合计行的平均伤害按总伤害除以总命中数', () => {
  const { battle, guardId, foeId } = setup();
  const hit = attack(battle, { attackerId: guardId, targetId: foeId, ...swing }, { random: () => 0.5 });
  const { totals } = cells(battleCsv(hit.battle));
  const damaged = Number(totals[8]);
  const hits = Number(totals[5]);
  assert.equal(Number(totals[9]), hits ? Math.round((damaged / hits) * 10) / 10 : 0);
});
