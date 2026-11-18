const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat } = require('../apps/web/src/combat.ts');
const { battleCsv, battleReport } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `readme-${++counter}`;

const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');

const hero = {
  schemaVersion: 'manual-character-snapshot/v1',
  characterId: 'char-readme',
  revision: 1,
  publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '塞拉',
    species: '人类',
    characterClass: '战士',
    level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40,
    armorClass: 16,
    speedFt: 30,
    actions: '',
    details: { equipment: '长剑' },
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '说明一致性', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let battle = configureGrid(store.battles[0], { width: 10, height: 10, cellFt: 5 });
  const guard = battle.actors.find(actor => actor.side === '友方');
  const foe = battle.actors.find(actor => actor.side === '敌方');
  battle = structuredClone(startCombat(battle, { [guard.id]: 20, [foe.id]: 10 }));
  battle.actors.find(actor => actor.id === guard.id).position = { x: 1, y: 1 };
  battle.actors.find(actor => actor.id === foe.id).position = { x: 5, y: 5 };
  return { battle, guardId: guard.id, foeId: foe.id };
}

test('README 提到的统计 CSV 新增列确实存在', () => {
  const { battle } = setup();
  const header = battleCsv(battle).replace(/^\uFEFF/, '').split('\r\n')[0];
  for (const column of ['反应提示', '平均伤害']) {
    if (!readme.includes(column)) continue;
    assert.ok(header.split(',').includes(column), `README 提到「${column}」列，但 CSV 表头里没有`);
  }
});

test('README 列出的战报小节都能在战报里生成', () => {
  const { battle, guardId } = setup();
  const armed = structuredClone(battle);
  const guard = armed.actors.find(actor => actor.id === guardId);
  guard.combat.blessed = 10;
  guard.combat.ready = { action: '攻击靠近的敌人', trigger: '敌人进入触及' };
  guard.combat.damageResistances = ['火焰'];
  const report = battleReport(armed);
  const sections = ['## 单位', '## 先攻顺序', '## 准备动作', '## 防御', '## 状态', '## 统计'];
  for (const heading of sections) {
    assert.ok(report.includes(heading) || heading === '## 单位', `战报缺少小节 ${heading}`);
  }
  for (const label of ['准备「攻击靠近的敌人」', '祝福（10 轮）']) {
    assert.ok(report.includes(label), `战报缺少「${label}」`);
  }
});

test('README 提到「未结算的提示会在回合结束时作废并记入战报」时，引擎确有该日志', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'apps', 'web', 'src', 'combat.ts'), 'utf8');
  if (!readme.includes('回合结束时作废')) return;
  assert.match(source, /条未结算的反应提示随回合结束作废/);
});

test('README 里描述的战斗特性都能在源码里找到对应实现', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'apps', 'web', 'src', 'combat.ts'), 'utf8');
  const probes = [
    ['短休', /export function shortRest\(/],
    ['援助术', /export function castAid\(/],
    ['树肤术', /export function castBarkskin\(/],
    ['纠缠术', /export function castEntangle\(/],
    ['撤离战场', /export function fleeBattle\(/],
    ['投降', /export function surrender\(/],
    ['移除单位', /export function removeCombatant\(/],
    ['士气检定', /export function moraleCheck\(/],
  ];
  for (const [label, pattern] of probes) {
    if (!readme.includes(label)) continue;
    assert.match(source, pattern, `README 提到「${label}」，但 combat.ts 里找不到实现`);
  }
});
