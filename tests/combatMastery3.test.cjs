const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, offhandAttack, configureGrid, moveActorToCell, startCombat, endTurn } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (equipment) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-mastery3', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment },
  },
});

function setup(equipment, count = 1) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '精通三期', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(equipment), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const friend = withHero.actors.find(actor => actor.side === '友方');
  const monsters = withHero.actors.filter(actor => actor.side === '敌方');
  const initiatives = { [friend.id]: 20 };
  monsters.forEach((item, index) => { initiatives[item.id] = 10 - index; });
  let next = startCombat(withHero, initiatives);
  next = configureGrid(next, { width: 10, height: 3, cellFt: 5 });
  next = moveActorToCell(next, friend.id, 1, 1);
  next = moveActorToCell(next, monsters[0].id, 2, 1);
  if (monsters[1]) next = moveActorToCell(next, monsters[1].id, 2, 2);
  return { battle: next, friend, monsters, monster: monsters[0] };
}

test('巨斧命中后顺劈相邻敌人', () => {
  const { battle, friend, monsters } = setup('巨斧', 2);
  const [, second] = monsters;
  const before = battle.actors.find(actor => actor.id === second.id).currentHp;
  const result = attack(battle, { attackerId: friend.id, targetId: monsters[0].id, attackBonus: 5, damageExpression: '1d12+3', damageType: '挥砍', weaponId: 'weapon:巨斧' }, { random: sequence(0.5, 0.5), makeId: ids() });
  const after = result.battle.actors.find(actor => actor.id === second.id).currentHp;
  assert.equal(before - after, 3);
  assert.match(result.battle.combat.log.at(-1).detail, /精通·顺劈/);
});

test('顺劈不打友军、也不打自己', () => {
  const { battle, friend, monster } = setup('巨斧', 1);
  const before = battle.actors.find(actor => actor.id === friend.id).currentHp;
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d12+3', damageType: '挥砍', weaponId: 'weapon:巨斧' }, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(result.battle.actors.find(actor => actor.id === friend.id).currentHp, before);
  assert.match(result.battle.combat.log.at(-1).detail, /5 尺内没有其他敌对单位/);
});

test('未启用方格时不误伤', () => {
  const { battle, friend, monsters } = setup('巨斧', 2);
  const noGrid = structuredClone(battle);
  delete noGrid.grid;
  noGrid.actors.forEach(actor => { delete actor.position; });
  const before = noGrid.actors.find(actor => actor.id === monsters[1].id).currentHp;
  const result = attack(noGrid, { attackerId: friend.id, targetId: monsters[0].id, attackBonus: 5, damageExpression: '1d12+3', damageType: '挥砍', weaponId: 'weapon:巨斧' }, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(result.battle.actors.find(actor => actor.id === monsters[1].id).currentHp, before);
  assert.match(result.battle.combat.log.at(-1).detail, /未启用方格，无法判定邻近目标/);
});

test('迅击把副手攻击并入攻击动作且不消耗附赠动作', () => {
  const { battle, friend, monster } = setup('匕首');
  const main = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d4+3', damageType: '穿刺', weaponId: 'weapon:匕首' }, { random: sequence(0.5, 0.5), makeId: ids() });
  const offhand = offhandAttack(main.battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d4+3', damageType: '穿刺', weaponId: 'weapon:匕首', nick: true }, { random: sequence(0.5, 0.5), makeId: ids() });
  const state = offhand.battle.actors.find(actor => actor.id === friend.id).combat;
  assert.equal(state.bonusUsed, false);
  assert.equal(state.nickUsed, true);
  assert.match(offhand.battle.combat.log.at(-1).text, /以迅击并入攻击动作/);
});

test('同一回合第二次迅击被拒绝、新回合恢复', () => {
  const { battle, friend, monster } = setup('匕首');
  const main = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d4+3', damageType: '穿刺', weaponId: 'weapon:匕首' }, { random: sequence(0.5, 0.5), makeId: ids() });
  const offhand = offhandAttack(main.battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d4+3', damageType: '穿刺', weaponId: 'weapon:匕首', nick: true }, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.throws(() => offhandAttack(offhand.battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d4+3', damageType: '穿刺', weaponId: 'weapon:匕首', nick: true }), /本回合已经使用过迅击/);
  const nextTurn = endTurn(endTurn(offhand.battle));
  const state = nextTurn.actors.find(actor => actor.id === friend.id).combat;
  assert.equal(state.nickUsed, false);
});

test('非迅击武器不能并入攻击动作', () => {
  const { battle, friend, monster } = setup('短剑');
  const main = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '穿刺', weaponId: 'weapon:短剑' }, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.throws(() => offhandAttack(main.battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '穿刺', weaponId: 'weapon:短剑', nick: true }), /该武器没有迅击精通/);
});
