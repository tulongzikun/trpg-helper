const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, castHaste, castInvisible, endConcentration, endTurn, savingThrow, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `spell-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-spell', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '牧师', level: 5,
    abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 16, cha: 10 },
    maxHp: 36, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '加速战', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  let next = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids()).store;
  next = addCharacter(next, { ...hero, characterId: 'char-spell-ally', sheet: { ...hero.sheet, name: '布兰' } }, { battleId: battle.id, side: '友方' }, ids()).store;
  const current = next.battles[0];
  const initiatives = {};
  current.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 - index : 10 - index; });
  const started = startCombat(current, initiatives);
  const friends = started.actors.filter(actor => actor.side === '友方');
  const enemy = started.actors.find(actor => actor.side === '敌方');
  return { battle: started, caster: friends[0], ally: friends[1], enemy };
}

function turnTo(battle, actorId) {
  let current = battle;
  for (let guard = 0; guard < 20; guard++) {
    const combat = current.combat;
    if (!combat) break;
    if (combat.order[combat.turnIndex] === actorId) return current;
    current = endTurn(current);
  }
  throw new Error('没有轮到 ' + actorId);
}

test('加速术消耗动作、建立专注并写战报', () => {
  const { battle, caster, ally } = setup();
  const next = castHaste(battle, caster.id, ally.id);
  const casterState = next.actors.find(item => item.id === caster.id).combat;
  const allyState = next.actors.find(item => item.id === ally.id).combat;
  assert.equal(allyState.hasted, 10);
  assert.equal(allyState.hastedBy, caster.id);
  assert.equal(casterState.actionUsed, true);
  assert.equal(casterState.concentration.spell, '加速术');
  assert.ok(next.combat.log.some(line => line.text.includes('受到加速术影响')));
});

test('加速的目标 AC 提高 2 点', () => {
  const { battle, caster, ally, enemy } = setup();
  const normal = turnTo(battle, ally.id);
  const base = attack(normal, { attackerId: ally.id, targetId: enemy.id, attackBonus: 5, damageExpression: '1d8', damageType: '挥砍' }, { random: sequence(0.5) }).outcome;
  const hastedBattle = castHaste(battle, caster.id, enemy.id);
  const hastedTurn = turnTo(hastedBattle, ally.id);
  const hasted = attack(hastedTurn, { attackerId: ally.id, targetId: enemy.id, attackBonus: 5, damageExpression: '1d8', damageType: '挥砍' }, { random: sequence(0.5) }).outcome;
  assert.equal(hasted.targetAc, base.targetAc + 2);
});

test('加速的目标敏捷豁免具有优势', () => {
  const { battle, caster, ally } = setup();
  const hasted = castHaste(battle, caster.id, ally.id);
  const { outcome } = savingThrow(hasted, { actorId: ally.id, ability: 'dex', dc: 20 }, { random: sequence(0.1, 0.9) });
  assert.equal(outcome.mode, 'advantage');
  assert.ok(outcome.notes.some(note => note.includes('加速术：敏捷豁免优势')));
});

test('隐形目标受到的攻击检定具有劣势', () => {
  const { battle, caster, ally, enemy } = setup();
  const invisible = castInvisible(battle, caster.id, ally.id);
  const turn = turnTo(invisible, enemy.id);
  const { outcome } = attack(turn, { attackerId: enemy.id, targetId: ally.id, attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.9, 0.1) });
  assert.equal(outcome.mode, 'disadvantage');
  assert.ok(outcome.notes.some(note => note.includes('目标处于隐形')));
});

test('隐形单位的攻击检定具有优势', () => {
  const { battle, caster, ally, enemy } = setup();
  const invisible = castInvisible(battle, caster.id, ally.id);
  const turn = turnTo(invisible, ally.id);
  const { outcome } = attack(turn, { attackerId: ally.id, targetId: enemy.id, attackBonus: 5, damageExpression: '1d8', damageType: '挥砍' }, { random: sequence(0.5) });
  assert.equal(outcome.mode, 'advantage');
  assert.ok(outcome.notes.some(note => note.includes('攻击者处于隐形')));
});

test('结束专注会清除加速术与隐形术', () => {
  const hasteCase = setup();
  const hasted = castHaste(hasteCase.battle, hasteCase.caster.id, hasteCase.ally.id);
  const afterHaste = endConcentration(hasted, hasteCase.caster.id);
  assert.equal(afterHaste.actors.find(item => item.id === hasteCase.ally.id).combat.hasted, undefined);
  assert.ok(afterHaste.combat.log.some(line => line.text.includes('加速术结束了')));

  const invisibleCase = setup();
  const invisible = castInvisible(invisibleCase.battle, invisibleCase.caster.id, invisibleCase.caster.id);
  const afterInvisible = endConcentration(invisible, invisibleCase.caster.id);
  assert.equal(afterInvisible.actors.find(item => item.id === invisibleCase.caster.id).combat.invisible, undefined);
  assert.ok(afterInvisible.combat.log.some(line => line.text.includes('隐形术结束了')));
});
