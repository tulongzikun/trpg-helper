const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, attack, healActor, damageActor } = require('../apps/web/src/combat.ts');
const { battleReport } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `rstat-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-rstat', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '伊莎', species: '人类', characterClass: '战士', level: 2,
    abilities: { str: 15, dex: 12, con: 13, int: 10, wis: 10, cha: 10 },
    maxHp: 30, armorClass: 15, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '统计战报', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 10, height: 8, cellFt: 5 });
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

test('没有攻击记录时统计小节给出提示', () => {
  const { battle } = setup();
  const text = battleReport(battle);
  assert.match(text, /## 统计\n\n（暂无攻击记录）/);
  assert.ok(!text.includes('| 单位 | 攻击 | 命中 |'));
});

test('攻击之后统计表列出该单位与命中数', () => {
  const { battle, attacker, target } = setup();
  const hit = attack(battle, { attackerId: attacker.id, targetId: target.id, ...swing }, { random: sequence(0.5, 0.5) });
  const text = battleReport(hit.battle);
  assert.match(text, /\| 单位 \| 攻击 \| 命中 \| 重击 \| 造成伤害 \| 承受伤害 \| 治疗 \|/);
  assert.match(text, new RegExp(`\\| ${attacker.name} \\| 1 \\| 1 \\| 0 \\| ${hit.outcome.damage} \\| 0 \\| 0 \\|`));
  assert.match(text, new RegExp(`\\| ${target.name} \\| 0 \\| 0 \\| 0 \\| 0 \\| ${hit.outcome.damage} \\| 0 \\|`));
});

test('统计小节附带轮次摘要与伤害构成', () => {
  const { battle, target } = setup();
  const next = damageActor(battle, target.id, 6, '火焰').battle;
  const text = battleReport(next);
  assert.match(text, /- 第 1 轮：还没有攻击记录。/);
  assert.match(text, /- 伤害构成：火焰 6（100%）/);
});

test('治疗量计入统计表', () => {
  const { battle, target } = setup();
  const wounded = damageActor(battle, target.id, 3, '挥砍').battle;
  const healed = healActor(wounded, target.id, 2);
  const text = battleReport(healed);
  assert.match(text, new RegExp(`\\| ${target.name} \\| 0 \\| 0 \\| 0 \\| 0 \\| 3 \\| 2 \\|`));
});

test('统计小节位于单位表与战报之间', () => {
  const { battle } = setup();
  const text = battleReport(battle);
  const unit = text.indexOf('| 单位 | 阵营 |');
  const stats = text.indexOf('## 统计');
  const log = text.indexOf('## 战报');
  assert.ok(unit > 0 && stats > unit && log > stats);
});
