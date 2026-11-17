const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { castMassHealingWord, configureGrid, healTargets, moveActorToCell, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `mass-${++counter}`;

const hero = name => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: `char-${name}`, revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name, species: '人类', characterClass: '牧师', level: 5,
    abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 16, cha: 10 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '硬头锤：+5 命中，1d6+2 钝击伤害，触及 5 尺', notes: '', details: {},
  },
});

const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };
const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;
const logs = battle => battle.combat.log.map(line => line.text).join('\n');

function setup(allyCount = 1) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '群体治疗', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  let current = store;
  for (let index = 0; index < allyCount; index += 1) {
    current = addCharacter(current, hero(index === 0 ? '艾拉' : `同伴${index}`), { battleId: battle.id, side: '友方' }, ids()).store;
  }
  let withAllies = current.battles[0];
  const initiatives = {};
  withAllies.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 - index : 5; });
  let started = startCombat(withAllies, initiatives);
  started = configureGrid(started, { width: 20, height: 20, cellFt: 5 });
  const allies = started.actors.filter(actor => actor.side === '友方');
  const monster = started.actors.find(actor => actor.side === '敌方');
  started = moveActorToCell(started, allies[0].id, 1, 1);
  allies.forEach((actor, index) => {
    if (index > 0) started = moveActorToCell(started, actor.id, 1 + index, 1);
  });
  started = moveActorToCell(started, started.actors.find(actor => actor.id === monster.id).id, 1, 8);
  return { battle: started, allies: started.actors.filter(actor => actor.side === '友方'), monster };
}

test('附赠动作治疗自己与同伴', () => {
  const { battle, allies } = setup(2);
  const hurt = structuredClone(battle);
  hurt.actors.find(actor => actor.id === allies[0].id).currentHp = 20;
  hurt.actors.find(actor => actor.id === allies[1].id).currentHp = 10;
  const result = castMassHealingWord(hurt, allies[0].id, [allies[0].id, allies[1].id], { random: sequence(0.5) });
  assert.equal(result.healed.length, 2);
  assert.equal(result.healed[0].amount, 6);
  assert.equal(result.battle.actors.find(actor => actor.id === allies[0].id).currentHp, 26);
  assert.equal(result.battle.actors.find(actor => actor.id === allies[1].id).currentHp, 16);
  assert.equal(stateOf(result.battle, allies[0].id).bonusUsed, true);
  assert.ok(logs(result.battle).includes('群体治疗术'));
});

test('治疗目标只含同阵营且可含自己', () => {
  const { battle, allies, monster } = setup(2);
  const ids = healTargets(battle, allies[0].id).map(actor => actor.id);
  assert.ok(ids.includes(allies[0].id));
  assert.ok(ids.includes(allies[1].id));
  assert.ok(!ids.includes(monster.id));
});

test('拒绝敌人、空目标与超过 6 个目标', () => {
  const { battle, allies, monster } = setup(2);
  assert.throws(() => castMassHealingWord(battle, allies[0].id, [monster.id]), /群体治疗术只能影响 60 尺内的同阵营单位/);
  assert.throws(() => castMassHealingWord(battle, allies[0].id, []), /请选择群体治疗术的目标/);
  const many = setup(7);
  const list = many.allies.map(actor => actor.id);
  assert.throws(() => castMassHealingWord(many.battle, many.allies[0].id, list), /最多影响 6 名单位/);
});

test('超出 60 尺的同伴不在治疗范围内', () => {
  const { battle, allies } = setup(2);
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === allies[1].id).position = { x: 19, y: 19 };
  const reachable = healTargets(far, allies[0].id).map(actor => actor.id);
  assert.ok(!reachable.includes(allies[1].id));
  assert.throws(() => castMassHealingWord(far, allies[0].id, [allies[1].id]), /60 尺内的同阵营单位/);
});

test('沉默区域与已用附赠动作时无法施放', () => {
  const { battle, allies } = setup(2);
  const silenced = structuredClone(battle);
  silenced.silence = [{ x: 1, y: 1 }];
  silenced.silenceBy = allies[0].id;
  assert.throws(() => castMassHealingWord(silenced, allies[0].id, [allies[0].id]), /沉默区域/);
  const spent = structuredClone(battle);
  spent.actors.find(actor => actor.id === allies[0].id).combat.bonusUsed = true;
  assert.throws(() => castMassHealingWord(spent, allies[0].id, [allies[0].id]), /附赠动作/);
});

test('倒下的同伴被治疗并重新站起', () => {
  const { battle, allies } = setup(2);
  const downed = structuredClone(battle);
  const victim = downed.actors.find(actor => actor.id === allies[1].id);
  victim.currentHp = 0;
  victim.combat.status = 'down';
  victim.combat.deathSaves = { successes: 1, failures: 2 };
  const result = castMassHealingWord(downed, allies[0].id, [allies[1].id], { random: sequence(0.9) });
  const healed = result.battle.actors.find(actor => actor.id === allies[1].id);
  assert.equal(healed.combat.status, 'active');
  assert.equal(healed.currentHp, 7);
  assert.deepEqual(healed.combat.deathSaves, { successes: 0, failures: 0 });
  assert.ok(logs(result.battle).includes('重新站起'));
});
