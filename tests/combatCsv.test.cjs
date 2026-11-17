const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, attack, healActor, damageActor } = require('../apps/web/src/combat.ts');
const { battleCsv, csvFileName } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `csv-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-csv', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '塞拉', species: '人类', characterClass: '战士', level: 3,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 40, armorClass: 15, speedFt: 30, actions: '长剑：+6 命中，1d8+3 挥砍伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '导出, 测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 12, height: 8, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const attacker = next.actors.find(actor => actor.side === '友方');
  const target = next.actors.find(actor => actor.side === '敌方');
  attacker.position = { x: 0, y: 0 };
  target.position = { x: 1, y: 0 };
  return { battle: next, attacker, target };
}

const swing = { attackBonus: 8, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee' };
const lines = text => text.replace(/^\uFEFF/, '').split('\r\n').filter(line => line.length > 0);

test('表头带 BOM 与十一列，行尾为 CRLF', () => {
  const { battle } = setup();
  const csv = battleCsv(battle);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.endsWith('\r\n'));
  const rows = lines(csv);
  assert.equal(rows[0], '单位,阵营,状态,攻击,命中,重击,命中率,造成伤害,承受伤害,治疗,伤害构成,防御');
  assert.equal(rows.length, battle.actors.length + 2);
  assert.ok(rows[rows.length - 1].startsWith('合计,'));
});

test('攻击与治疗数据按单位落到对应列', () => {
  const { battle, attacker, target } = setup();
  const hit = attack(battle, { attackerId: attacker.id, targetId: target.id, ...swing }, { random: sequence(0.5, 0.5) });
  const wounded = damageActor(hit.battle, attacker.id, 6, '穿刺').battle;
  const healed = healActor(wounded, attacker.id, 3);
  const rows = lines(battleCsv(healed)).slice(1, -1);
  const heroRow = rows.find(row => row.startsWith('塞拉,'));
  assert.ok(heroRow);
  const cells = heroRow.split(',');
  assert.equal(cells[3], '1');
  assert.equal(cells[4], '1');
  assert.equal(cells[6], '1');
  assert.equal(cells[7], String(hit.outcome.damage));
  assert.equal(cells[9], '3');
  assert.equal(cells[10], '穿刺 6');
});

test('含逗号的名称会被双引号包裹', () => {
  const { battle } = setup();
  const rows = lines(battleCsv(battle));
  const battleNameRow = battle.actors.find(actor => actor.name === '塞拉');
  assert.ok(battleNameRow);
  assert.match(battle.name, /,/);
  const quotedHeader = lines(battleCsv(battle)).slice(1, -1);
  assert.equal(quotedHeader.length, battle.actors.length);
});

test('阵营与状态用中文标签', () => {
  const { battle, target } = setup();
  const killed = damageActor(battle, target.id, 200, '挥砍').battle;
  const rows = lines(battleCsv(killed)).slice(1, -1);
  const foeRow = rows.find(row => row.includes('敌方'));
  assert.ok(foeRow.includes('阵亡'));
  const heroRow = rows.find(row => row.startsWith('塞拉,'));
  assert.ok(heroRow.includes('友方'));
  assert.ok(heroRow.includes('在场'));
});

test('没有攻击记录时也输出完整表格', () => {
  const { battle } = setup();
  const rows = lines(battleCsv(battle));
  assert.equal(rows.length, battle.actors.length + 2);
  assert.equal(rows[rows.length - 1], '合计,,,0,0,0,0,0,0,0,,');
});

test('文件名为 <战斗名>-统计.csv 并替换非法字符', () => {
  const { battle } = setup();
  assert.equal(csvFileName(battle), '导出, 测试-统计.csv');
  assert.equal(csvFileName({ ...battle, name: 'A/B:C*D' }), 'A_B_C_D-统计.csv');
  const unnamed = { ...battle, name: '' };
  assert.equal(csvFileName(unnamed), '战斗-统计.csv');
});
