const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { healActor, setActorHp, spendResource, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const hero = () => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: { name: '艾拉', species: '人类', characterClass: '牧师', level: 5, abilities: { str: 12, dex: 12, con: 14, int: 10, wis: 16, cha: 10 }, maxHp: 40, armorClass: 16, speedFt: 30, actions: '锤子：+4 命中，1d8+1 钝击伤害，触及 5 尺', notes: '', details: { equipment: '战锤' } },
});

function setup(count = 2) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '治疗', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(), { battleId: battle.id, side: '友方' }, ids());
  const current = added.store.battles[0];
  const friend = current.actors.find(actor => actor.side === '友方');
  const enemies = current.actors.filter(actor => actor.side === '敌方');
  const initiatives = { [friend.id]: 20 };
  enemies.forEach((enemy, index) => { initiatives[enemy.id] = 10 - index; });
  return { battle: startCombat(current, initiatives), friend, enemies };
}

test('治疗倒地单位会使其重新站起并清空死亡豁免', () => {
  const { battle, friend } = setup();
  const downed = setActorHp(battle, friend.id, 0);
  assert.equal(downed.actors.find(actor => actor.id === friend.id).combat.status, 'down');
  const healed = healActor(downed, friend.id, 10);
  const actor = healed.actors.find(item => item.id === friend.id);
  assert.equal(actor.currentHp, 10);
  assert.equal(actor.combat.status, 'active');
  assert.deepEqual(actor.combat.deathSaves, { successes: 0, failures: 0 });
  assert.match(healed.combat.log.at(-1).text, /重新站起/);
});

test('治疗不会超过生命值上限', () => {
  const { battle, friend } = setup();
  const hurt = setActorHp(battle, friend.id, 35);
  const healed = healActor(hurt, friend.id, 20);
  assert.equal(healed.actors.find(actor => actor.id === friend.id).currentHp, 40);
});

test('死亡单位与非法治疗量会被拒绝', () => {
  const { battle, friend, enemies } = setup();
  const dead = setActorHp(battle, enemies[0].id, 0);
  assert.equal(dead.actors.find(actor => actor.id === enemies[0].id).combat.status, 'dead');
  assert.throws(() => healActor(dead, enemies[0].id, 5), /无法通过治疗恢复/);
  assert.throws(() => healActor(battle, friend.id, 0), /治疗量须为正整数/);
});

test('治疗会消耗当前单位的动作', () => {
  const { battle, friend } = setup();
  const spent = spendResource(battle, friend.id, 'action');
  assert.throws(() => spendResource(spent, friend.id, 'action'), /已经使用过动作/);
});
