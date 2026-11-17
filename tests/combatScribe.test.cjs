const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { addItem, scribeScroll, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `scribe-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-scribe', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '莉安', species: '高等精灵', characterClass: '法师', level: 3,
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    maxHp: 24, armorClass: 13, speedFt: 30, actions: '短剑：+4 命中，1d6+2 穿刺伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '抄写', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(withHero, initiatives);
  return { battle: started, hero: started.actors.find(actor => actor.side === '友方') };
}

const itemsOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat.items ?? [];
const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;
const logs = battle => battle.combat.log.map(line => line.text).join('\n');

test('抄写卷轴会消耗羊皮纸并生成 1 环卷轴', () => {
  const { battle, hero } = setup();
  const prepared = addItem(battle, hero.id, '空白羊皮纸', 2);
  const next = scribeScroll(prepared, hero.id, '治疗术');
  const items = itemsOf(next, hero.id);
  const paper = items.find(item => item.name === '空白羊皮纸');
  const scroll = items.find(item => item.name === '法术卷轴：治疗术（1 环）');
  assert.equal(paper.quantity, 1);
  assert.equal(scroll.quantity, 1);
  assert.equal(stateOf(next, hero.id).actionUsed, true);
  assert.ok(logs(next).includes('抄写'));
  assert.ok(logs(next).includes('法术卷轴：治疗术（1 环）'));
});

test('再次抄写同一法术会累加卷轴数量并继续消耗羊皮纸', () => {
  const { battle, hero } = setup();
  const prepared = addItem(battle, hero.id, '空白羊皮纸', 3);
  const once = scribeScroll(prepared, hero.id, '祝福术');
  const refreshed = structuredClone(once);
  refreshed.actors.find(actor => actor.id === hero.id).combat.actionUsed = false;
  const twice = scribeScroll(refreshed, hero.id, '祝福术');
  const scroll = itemsOf(twice, hero.id).find(item => item.name === '法术卷轴：祝福术（1 环）');
  const paper = itemsOf(twice, hero.id).find(item => item.name === '空白羊皮纸');
  assert.equal(scroll.quantity, 2);
  assert.equal(paper.quantity, 1);
});

test('最后一张羊皮纸用完后从物品列表移除', () => {
  const { battle, hero } = setup();
  const prepared = addItem(battle, hero.id, '空白羊皮纸', 1);
  const next = scribeScroll(prepared, hero.id, '群体治疗术');
  assert.equal(itemsOf(next, hero.id).some(item => item.name === '空白羊皮纸'), false);
  assert.ok(itemsOf(next, hero.id).some(item => item.name === '法术卷轴：群体治疗术（1 环）'));
});

test('抄写出的卷轴可以正常阅读施放', () => {
  const { readScroll } = require('../apps/web/src/combat.ts');
  const { battle, hero } = setup();
  const prepared = addItem(battle, hero.id, '空白羊皮纸', 1);
  const scribed = scribeScroll(prepared, hero.id, '治疗术');
  const ready = structuredClone(scribed);
  ready.actors.find(actor => actor.id === hero.id).currentHp = 10;
  ready.actors.find(actor => actor.id === hero.id).combat.actionUsed = false;
  let index = 0;
  const values = [0.5, 0.5, 0.5];
  const random = () => values[Math.min(index++, values.length - 1)];
  const result = readScroll(ready, hero.id, '法术卷轴：治疗术（1 环）', { random });
  assert.equal(result.success, true);
  assert.ok(result.battle.actors.find(actor => actor.id === hero.id).currentHp > 10);
});

test('没有羊皮纸或不支持的法术会被拒绝', () => {
  const { battle, hero } = setup();
  assert.throws(() => scribeScroll(battle, hero.id, '治疗术'), /空白羊皮纸/);
  const prepared = addItem(battle, hero.id, '空白羊皮纸', 1);
  assert.throws(() => scribeScroll(prepared, hero.id, '火球术'), /目前只能抄写/);
});

test('非当前回合与已用动作都会被拒绝', () => {
  const { battle, hero } = setup();
  const foe = battle.actors.find(actor => actor.side === '敌方');
  const prepared = addItem(battle, hero.id, '空白羊皮纸', 2);
  assert.throws(() => scribeScroll(prepared, foe.id, '治疗术'), /只有当前回合的单位可以抄写卷轴/);
  const spent = structuredClone(prepared);
  spent.actors.find(actor => actor.id === hero.id).combat.actionUsed = true;
  assert.throws(() => scribeScroll(spent, hero.id, '治疗术'), /本回合已经使用过动作/);
});
