const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const {
  startCombat, attack, attackSequence, damageActor, toggleCondition, useActionSurge, secondWind, recoverClassResources,
} = require('../apps/web/src/combat.ts');
const { actionSurgeMax, attacksPerAction, attackerAdjustment, combineAttackModes, isAutomaticCritical, targetAdjustment } = require('../apps/web/src/combatModifiers.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };
const character = (overrides = {}) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: { name: '艾拉', species: '人类', characterClass: '战士', level: 5, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', ...overrides },
});

/** 建立一场「1 个怪物 + 1 个角色」的战斗，角色先攻较高，处于自己的回合。 */
function setup(overrides = {}) {
  const base = addMonsters(emptyStore(), card, { newBattleName: '测试战斗', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
  const withHero = addCharacter({ version: 1, battles: [base] }, character(overrides), { battleId: base.id, side: '友方' }, ids()).store.battles[0];
  const hero = withHero.actors.find(actor => actor.characterSnapshot);
  const monster = withHero.actors.find(actor => !actor.characterSnapshot);
  const started = startCombat(withHero, { [hero.id]: 20, [monster.id]: 1 });
  return {
    battle: started,
    heroId: hero.id,
    monsterId: monster.id,
    actor: (id) => started.actors.find(item => item.id === id),
  };
}

const attackOptions = (heroId, monsterId, overrides = {}) => ({
  attackerId: heroId, targetId: monsterId, attackBonus: 20, damageExpression: '1d8+3', damageType: '挥砍', ...overrides,
});

test('状态修正：目盲、中毒、束缚让攻击者处于劣势，隐形成优势', () => {
  const { battle, heroId } = setup();
  const hero = battle.actors.find(item => item.id === heroId);
  assert.equal(attackerAdjustment(hero).mode, 'normal');
  const blinded = toggleCondition(battle, heroId, '目盲');
  assert.equal(attackerAdjustment(blinded.actors.find(item => item.id === heroId)).mode, 'disadvantage');
  const poisoned = toggleCondition(battle, heroId, '中毒');
  assert.equal(attackerAdjustment(poisoned.actors.find(item => item.id === heroId)).mode, 'disadvantage');
  const invisible = toggleCondition(battle, heroId, '隐形');
  assert.equal(attackerAdjustment(invisible.actors.find(item => item.id === heroId)).mode, 'advantage');
  assert.match(attackerAdjustment(invisible.actors.find(item => item.id === heroId)).notes.join('；'), /隐形/);
});

test('状态修正：目标倒地时近战有优势、远程有劣势', () => {
  const { battle, monsterId } = setup();
  const prone = toggleCondition(battle, monsterId, '倒地');
  const target = prone.actors.find(item => item.id === monsterId);
  assert.equal(targetAdjustment(target, 'melee').mode, 'advantage');
  assert.equal(targetAdjustment(target, 'ranged').mode, 'disadvantage');
});

test('优势与劣势同时存在时互相抵消为正常检定', () => {
  const combined = combineAttackModes('normal', [
    { mode: 'disadvantage', notes: ['攻击方劣势：目盲'] },
    { mode: 'advantage', notes: ['目标倒地（近战）'] },
  ]);
  assert.equal(combined.mode, 'normal');
  assert.match(combined.notes.join('；'), /相互抵消/);
  assert.equal(combineAttackModes('advantage', [{ mode: 'disadvantage', notes: [] }]).mode, 'normal');
  assert.equal(combineAttackModes('advantage', [{ mode: 'advantage', notes: [] }]).mode, 'advantage', '优势不叠加');
});

test('目盲的攻击者取两次 d20 中较低者', () => {
  const { battle, heroId, monsterId } = setup();
  const blinded = toggleCondition(battle, heroId, '目盲');
  const { outcome } = attack(blinded, attackOptions(heroId, monsterId), { random: sequence(0.9, 0.1), makeId: ids() });
  assert.equal(outcome.mode, 'disadvantage');
  assert.equal(outcome.natural, 3, '0.9→19 与 0.1→3，劣势取 3');
  assert.ok(outcome.notes.some(note => note.includes('目盲')));
});

test('近战攻击麻痹目标命中即重击，伤害骰翻倍', () => {
  const { battle, heroId, monsterId } = setup();
  const paralyzed = toggleCondition(battle, monsterId, '麻痹');
  const { outcome } = attack(paralyzed, attackOptions(heroId, monsterId), { random: sequence(0.7, 0.0, 0.0, 0.5), makeId: ids() });
  assert.equal(outcome.natural, 15);
  assert.equal(outcome.hit, true);
  assert.equal(outcome.critical, true, '目标麻痹且在 5 尺内，命中即重击');
  assert.equal(outcome.damage, 1 + 5 + 3, '1d8+3 重击骰两次为 1 + 5 + 3');
  assert.ok(outcome.notes.some(note => note.includes('重击')));
});

test('麻痹目标在 10 尺外近战不再自动重击', () => {
  const { battle, heroId, monsterId } = setup();
  const paralyzed = toggleCondition(battle, monsterId, '麻痹');
  assert.equal(isAutomaticCritical(paralyzed.actors.find(item => item.id === monsterId), 'ranged', 5), false);
  const { outcome } = attack(paralyzed, attackOptions(heroId, monsterId, { distanceFt: 10 }), { random: sequence(0.7), makeId: ids() });
  assert.equal(outcome.critical, false);
});

test('处于失能、麻痹或昏迷的单位不能攻击', () => {
  const { battle, heroId, monsterId } = setup();
  const incapacitated = toggleCondition(battle, heroId, '失能');
  assert.throws(() => attack(incapacitated, attackOptions(heroId, monsterId)), /无法进行动作/);
  const paralyzed = toggleCondition(battle, heroId, '麻痹');
  assert.throws(() => attack(paralyzed, attackOptions(heroId, monsterId)), /无法进行动作/);
});

test('额外攻击次数按职业与等级计算', () => {
  const count = (overrides) => {
    const { battle, heroId } = setup(overrides);
    return attacksPerAction(battle.actors.find(item => item.id === heroId));
  };
  assert.equal(count({ level: 4 }), 1);
  assert.equal(count({ level: 5 }), 2);
  assert.equal(count({ level: 11 }), 3);
  assert.equal(count({ level: 20 }), 4);
  assert.equal(count({ characterClass: '法师', level: 11 }), 1);
  assert.equal(count({ characterClass: '野蛮人', level: 5 }), 2);
});

test('一次攻击动作可以连续攻击多次，但只消耗一个动作', () => {
  const { battle, heroId, monsterId } = setup({ maxHp: 200 });
  const { battle: resolved, outcomes } = attackSequence(battle, attackOptions(heroId, monsterId, { attacks: 2 }), {
    random: sequence(0.7, 0.1, 0.7, 0.2), makeId: ids(),
  });
  assert.equal(outcomes.length, 2);
  const hero = resolved.actors.find(item => item.id === heroId);
  assert.equal(hero.combat.actionUsed, true);
  assert.equal(hero.combat.bonusUsed, false);
  assert.equal(resolved.actors.find(item => item.id === monsterId).currentHp, card.block.hitPoints.average - outcomes[0].damage - outcomes[1].damage);
});

test('攻击次数超过额外攻击上限会被拒绝', () => {
  const { battle, heroId, monsterId } = setup({ level: 5 });
  assert.throws(() => attackSequence(battle, attackOptions(heroId, monsterId, { attacks: 3 })), /最多攻击 2 次/);
});

test('目标在序列中死亡后停止后续攻击', () => {
  const { battle, heroId, monsterId } = setup({ maxHp: 200 });
  const wounded = structuredClone(battle);
  wounded.actors.find(item => item.id === monsterId).currentHp = 1;
  const { outcomes } = attackSequence(wounded, attackOptions(heroId, monsterId, { attacks: 2, damageExpression: '1d4+10' }), {
    random: sequence(0.7, 0.5, 0.7, 0.5), makeId: ids(),
  });
  assert.equal(outcomes.length, 1, '目标已经死亡，不再进行第二击');
  assert.equal(outcomes[0].status, 'dead');
});

test('动作如潮让战士额外获得一个动作，且每场战斗次数受限', () => {
  const { battle, heroId, monsterId } = setup({ level: 2 });
  assert.equal(actionSurgeMax(battle.actors.find(item => item.id === heroId)), 1);
  const spent = attack(battle, attackOptions(heroId, monsterId), { random: sequence(0.7, 0.1), makeId: ids() }).battle;
  assert.equal(spent.actors.find(item => item.id === heroId).combat.actionUsed, true);
  const surged = useActionSurge(spent, heroId, { makeId: ids() });
  const hero = surged.actors.find(item => item.id === heroId);
  assert.equal(hero.combat.actionUsed, false, '动作如潮重置动作');
  assert.equal(hero.combat.actionSurgeUsed, 1);
  assert.throws(() => useActionSurge(surged, heroId), /已经用完/);
});

test('非战士不能使用动作如潮', () => {
  const { battle, heroId } = setup({ characterClass: '法师', level: 5 });
  assert.equal(actionSurgeMax(battle.actors.find(item => item.id === heroId)), 0);
  assert.throws(() => useActionSurge(battle, heroId), /只有 2 级及以上的战士/);
});

test('回气消耗附赠动作恢复 1d10 + 战士等级，短休后恢复使用次数', () => {
  const { battle, heroId } = setup({ level: 3 });
  const hurt = damageActor(battle, heroId, 20, '挥砍', { makeId: ids() }).battle;
  const before = hurt.actors.find(item => item.id === heroId).currentHp;
  const { battle: healed, healed: amount } = secondWind(hurt, heroId, { random: sequence(0.5), makeId: ids() });
  assert.equal(amount, 6 + 3, 'd10 掷出 6，加上 3 级战士等级');
  const hero = healed.actors.find(item => item.id === heroId);
  assert.equal(hero.currentHp, before + 9);
  assert.equal(hero.combat.bonusUsed, true);
  assert.equal(hero.combat.secondWindUsed, true);
  assert.throws(() => secondWind(healed, heroId), /已经使用过回气/);
  const rested = recoverClassResources(healed);
  assert.equal(rested.actors.find(item => item.id === heroId).combat.secondWindUsed, false);
  assert.equal(rested.actors.find(item => item.id === heroId).combat.actionSurgeUsed, 0);
  assert.ok(secondWind(rested, heroId, { random: sequence(0.0) }).healed > 0);
});
