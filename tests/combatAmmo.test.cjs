const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, attackSequence, defaultAmmo, endTurn, reloadAmmo, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (equipment) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '',
    details: { equipment },
  },
});

function setup(equipment = '短弓') {
  const store = addMonsters(emptyStore(), card, { newBattleName: '弹药测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(equipment), { battleId: battle.id, side: '友方' }, ids()).store.battles[0];
  const shooter = added.actors.find(actor => actor.side === '友方');
  const target = added.actors.find(actor => actor.side !== '友方');
  const order = { [shooter.id]: 20 };
  let seed = 10;
  for (const actor of added.actors) if (actor.id !== shooter.id) order[actor.id] = seed--;
  return { battle: startCombat(added, order), shooter, target };
}

const options = (shooter, target, extra = {}) => ({
  attackerId: shooter.id, targetId: target.id, attackBonus: 5, damageExpression: '1d6', damageType: '穿刺',
  range: 'ranged', distanceFt: 30, weaponId: 'weapon:短弓', ...extra,
});

const backToShooter = (battle) => endTurn(endTurn(battle));
const ammoOf = (battle, actorId) => battle.actors.find(actor => actor.id === actorId).combat.ammo;

test('带弹药的远程武器每次攻击消耗一发', () => {
  const { battle, shooter, target } = setup();
  const one = attack(battle, options(shooter, target), { random: sequence(), makeId: ids() });
  assert.equal(ammoOf(one.battle, shooter.id), defaultAmmo - 1);
  const two = attack(backToShooter(one.battle), options(shooter, target), { random: sequence(), makeId: ids() });
  assert.equal(ammoOf(two.battle, shooter.id), defaultAmmo - 2);
});

test('弹药耗尽后拒绝攻击', () => {
  const { battle, shooter, target } = setup();
  const one = attack(reloadAmmo(battle, shooter.id, 1), options(shooter, target), { random: sequence(), makeId: ids() });
  assert.equal(ammoOf(one.battle, shooter.id), 0);
  assert.throws(() => attack(backToShooter(one.battle), options(shooter, target), { random: sequence(), makeId: ids() }), /弹药不足：剩余 0 发，需要 1 发。/);
});

test('连续攻击按次数扣减弹药，不足时整体拒绝', () => {
  const { battle, shooter, target } = setup();
  const burst = attackSequence(battle, options(shooter, target, { attacks: 2 }), { random: sequence(), makeId: ids() });
  assert.equal(burst.outcomes.length, 2);
  assert.equal(ammoOf(burst.battle, shooter.id), defaultAmmo - 2);
  const scarce = reloadAmmo(battle, shooter.id, 1);
  assert.throws(() => attackSequence(scarce, options(shooter, target, { attacks: 2 }), { random: sequence(), makeId: ids() }), /弹药不足：剩余 1 发，需要 2 发。/);
});

test('补充弹药会写入日志并可指定数量', () => {
  const { battle, shooter } = setup();
  const refilled = reloadAmmo(battle, shooter.id, 7);
  assert.equal(ammoOf(refilled, shooter.id), 7);
  assert.match(refilled.combat.log.at(-1).text, /补充弹药至 7 发/);
  assert.throws(() => reloadAmmo(battle, shooter.id, 0), /弹药数量须为 1 至 999 的整数。/);
});

test('没有弹药特性的武器不消耗弹药', () => {
  const { battle, shooter, target } = setup('长剑');
  const melee = attack(battle, options(shooter, target, { weaponId: 'weapon:长剑', range: 'melee', distanceFt: 5, damageExpression: '1d8', damageType: '挥砍' }), { random: sequence(), makeId: ids() });
  assert.equal(ammoOf(melee.battle, shooter.id), undefined);
});
