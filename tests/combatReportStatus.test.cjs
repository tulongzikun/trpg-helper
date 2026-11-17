const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, fleeBattle, surrender } = require('../apps/web/src/combat.ts');
const { battleReport, battleCsv, statusOf } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `status-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-status', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '诺拉', species: '人类', characterClass: '牧师', level: 3,
    abilities: { str: 12, dex: 12, con: 14, int: 10, wis: 16, cha: 12 },
    maxHp: 28, armorClass: 15, speedFt: 30, actions: '锤矛：+4 命中，1d6+1 钝击伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '状态', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 10, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const ally = next.actors.find(actor => actor.side === '友方');
  const foes = next.actors.filter(actor => actor.side === '敌方');
  return { battle: next, ally, foes };
}

test('statusOf 按阵亡、撤离、投降、生命状态依次判定', () => {
  const { battle, ally, foes } = setup();
  const fled = fleeBattle(battle, foes[0].id);
  const surrendered = surrender(fled, foes[1].id);
  const actors = surrendered.actors;
  assert.equal(statusOf(actors.find(actor => actor.id === ally.id)), '在场');
  assert.equal(statusOf(actors.find(actor => actor.id === foes[0].id)), '已撤离');
  assert.equal(statusOf(actors.find(actor => actor.id === foes[1].id)), '已投降');
  const dead = structuredClone(surrendered);
  const deadFoe = dead.actors.find(actor => actor.id === foes[1].id);
  deadFoe.combat.status = 'dead';
  assert.equal(statusOf(deadFoe), '阵亡');
});

test('Markdown 战报的单位表体现撤离与投降', () => {
  const { battle, foes } = setup();
  const fled = fleeBattle(battle, foes[0].id);
  const report = battleReport(surrender(fled, foes[1].id));
  assert.match(report, /已撤离/);
  assert.match(report, /已投降/);
});

test('CSV 状态列同样体现撤离与投降', () => {
  const { battle, foes } = setup();
  const fled = fleeBattle(battle, foes[0].id);
  const csv = battleCsv(surrender(fled, foes[1].id));
  assert.match(csv, /已撤离/);
  assert.match(csv, /已投降/);
  assert.match(csv, /在场/);
});

test('未受影响时仍显示原有的生命状态标签', () => {
  const { battle, ally } = setup();
  const report = battleReport(battle);
  assert.match(report, /在场/);
  assert.equal(statusOf(ally), '在场');
  const downed = structuredClone(battle);
  downed.actors.find(actor => actor.id === ally.id).combat.status = 'down';
  assert.equal(statusOf(downed.actors.find(actor => actor.id === ally.id)), '倒地待救');
});

test('投降且阵亡以阵亡为准', () => {
  const { battle, foes } = setup();
  const gave = surrender(battle, foes[0].id);
  const dead = structuredClone(gave);
  const expert = dead.actors.find(actor => actor.id === foes[0].id);
  expert.combat.status = 'dead';
  expert.currentHp = 0;
  assert.equal(statusOf(expert), '阵亡');
  assert.match(battleReport(dead), /阵亡/);
});
