const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { abilityCheck, setActorHp, startCombat, toggleCondition } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };
const hero = () => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: { name: '艾拉', species: '人类', characterClass: '游侠', level: 5, abilities: { str: 14, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }, maxHp: 40, armorClass: 16, speedFt: 30, actions: '短弓：+7 命中，1d8+3 穿刺伤害，射程 80/320 尺', notes: '', details: { skillProficiencies: ['隐匿', '察觉'], equipment: '短弓' } },
});

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '检定', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(), { battleId: battle.id, side: '友方' }, ids());
  const current = added.store.battles[0];
  const friend = current.actors.find(actor => actor.side === '友方');
  const enemy = current.actors.find(actor => actor.side === '敌方');
  const started = startCombat(current, { [friend.id]: 20, [enemy.id]: 10 });
  return { battle: started, friend, enemy };
}

test('熟练技能加上熟练加值并写日志', () => {
  const { battle, friend } = setup();
  const result = abilityCheck(battle, { actorId: friend.id, ability: 'dex', skill: '隐匿', dc: 12 }, { random: sequence(0.5) });
  assert.equal(result.outcome.natural, 11);
  assert.equal(result.outcome.total, 11 + 3 + 3);
  assert.equal(result.outcome.success, true);
  assert.match(result.battle.combat.log.at(-1).text, /敏捷（隐匿）检定成功/);
});

test('天然 20 必成、天然 1 必败', () => {
  const { battle, friend } = setup();
  const lucky = abilityCheck(battle, { actorId: friend.id, ability: 'wis', dc: 30 }, { random: sequence(0.99) });
  assert.equal(lucky.outcome.success, true);
  const unlucky = abilityCheck(battle, { actorId: friend.id, ability: 'wis', dc: 2 }, { random: sequence(0.0) });
  assert.equal(unlucky.outcome.success, false);
});

test('中毒时属性检定具有劣势并取较低值', () => {
  const { battle, friend } = setup();
  const poisoned = toggleCondition(battle, friend.id, '中毒');
  const result = abilityCheck(poisoned, { actorId: friend.id, ability: 'str', dc: 10 }, { random: sequence(0.9, 0.1) });
  assert.equal(result.outcome.mode, 'disadvantage');
  assert.equal(result.outcome.natural, 3);
  assert.ok(result.outcome.notes.some(note => /中毒/.test(note)));
});

test('DC 越界、倒地单位与未开战时拒绝', () => {
  const { battle, friend } = setup();
  assert.throws(() => abilityCheck(battle, { actorId: friend.id, ability: 'str', dc: 0 }), /DC 须为 1 至 40 的整数/);
  const downed = setActorHp(battle, friend.id, 0);
  assert.throws(() => abilityCheck(downed, { actorId: friend.id, ability: 'str', dc: 10 }), /只有在场的单位可以进行检定/);
  assert.throws(() => abilityCheck({ ...battle, combat: undefined }, { actorId: friend.id, ability: 'str', dc: 10 }), /战斗尚未开始/);
});
