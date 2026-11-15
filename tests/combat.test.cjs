const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter, removeActor, readBattles, writeBattles, storageKey } = require('../apps/web/src/battle.ts');
const {
  startCombat, endTurn, attack, damageActor, healActor, setTempHp, rollDeathSave, undoCombat,
  resetCombat, spendResource, spendMovement, toggleCondition, actorInitiativeBonus, currentActorId,
} = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };
const character = (overrides = {}) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-1', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: { name: '艾拉', species: '人类', characterClass: '战士', level: 5, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', ...overrides },
});

function battleWithMonsters(count = 2) {
  return addMonsters(emptyStore(), card, { newBattleName: '测试战斗', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store.battles[0];
}
function battleWithParty() {
  const base = battleWithMonsters(1);
  const result = addCharacter({ version: 1, battles: [base] }, character(), { battleId: base.id, side: '友方' }, ids());
  return result.store.battles[0];
}

test('先攻按总点数排序，平手时敏捷更高者优先，并重置首个单位的回合资源', () => {
  const battle = battleWithParty();
  const [monster, hero] = battle.actors;
  monster.template.abilities = { ...monster.template.abilities, dex: 10 };
  hero.combat = undefined;
  const started = startCombat(battle, { [monster.id]: 18, [hero.id]: 18 });
  assert.equal(started.combat.round, 1);
  assert.equal(started.combat.turnIndex, 0);
  assert.deepEqual(started.combat.order, [hero.id, monster.id], '同为 18 时敏捷调整值更高的角色先行动');
  assert.equal(started.combat.log.length, 1);
  assert.equal(started.actors.find(a => a.id === hero.id).combat.actionUsed, false);
});

test('自动投先攻使用怪物先攻加值与角色敏捷、警觉专长', () => {
  const battle = battleWithMonsters(1);
  const monster = battle.actors[0];
  monster.template.initiativeBonus = 3;
  assert.equal(actorInitiativeBonus(monster), 3);
  const party = battleWithParty();
  const hero = party.actors.find(a => a.characterSnapshot);
  assert.equal(actorInitiativeBonus(hero), 2, '5 级角色敏捷 14 的先攻加值为 +2');
  hero.characterSnapshot.sheet.details = { background: '罪犯', abilityMethod: 'manual' };
  assert.equal(actorInitiativeBonus(hero), 5, '罪犯背景的警觉专长提供熟练加值');
});

test('结束回合推进到下一个单位并在轮末进入下一轮', () => {
  const battle = battleWithParty();
  const started = startCombat(battle, {});
  const first = currentActorId(started);
  const later = endTurn(started);
  assert.notEqual(currentActorId(later), first);
  const wrapped = endTurn(later);
  assert.equal(wrapped.combat.round, 2);
  assert.equal(currentActorId(wrapped), first);
  assert.equal(wrapped.combat.log.at(-1).round, 2);
});

test('攻击命中消耗动作，优势取高值，附赠动作仍独立结算', () => {
  const battle = battleWithParty();
  const [monster, hero] = battle.actors;
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  const { battle: resolved, outcome } = attack(started, {
    attackerId: hero.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍',
    mode: 'advantage',
  }, { random: sequence(0.05, 0.7, 0.5), makeId: ids() });
  assert.equal(outcome.natural, 15);
  assert.equal(outcome.total, 20);
  assert.equal(outcome.hit, true);
  assert.equal(outcome.damage, 8);
  assert.equal(outcome.targetHp, monster.maxHp - 8);
  const attacker = resolved.actors.find(a => a.id === hero.id);
  assert.equal(attacker.combat.actionUsed, true);
  assert.equal(attacker.combat.bonusUsed, false, '普通动作不会占用附赠动作');
  assert.equal(resolved.actors.find(a => a.id === monster.id).currentHp, monster.maxHp - 8);
  assert.match(resolved.combat.log.at(-1).detail, /攻击检定/);
});

test('大失败必定未命中，重击翻倍伤害骰但只加一次调整值', () => {
  const battle = battleWithParty();
  const [monster, hero] = battle.actors;
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  const miss = attack(started, { attackerId: hero.id, targetId: monster.id, attackBonus: 30, damageExpression: '1d8', damageType: '挥砍' }, { random: sequence(0.0, 0.5) });
  assert.equal(miss.outcome.hit, false, '掷出 1 时即使总加值够高也未命中');
  const crit = attack(started, { attackerId: hero.id, targetId: monster.id, attackBonus: 5, damageExpression: '2d6+2', damageType: '火焰' }, { random: sequence(0.99, 0, 0, 0, 0) });
  assert.equal(crit.outcome.critical, true);
  assert.equal(crit.outcome.damage, 1 + 1 + 1 + 1 + 2, '重击掷 4 颗 d6，调整值只加一次');
});

test('抗性、易伤、免疫与临时生命依次结算', () => {
  const battle = battleWithMonsters(1);
  const monster = battle.actors[0];
  monster.maxHp = 50; monster.currentHp = 50;
  monster.template.damageResistances = ['火焰'];
  monster.template.damageVulnerabilities = ['寒冷'];
  monster.template.damageImmunities = ['毒素'];
  const started = startCombat(battle, { [monster.id]: 10 });
  const resistant = damageActor(started, monster.id, 10, '火焰').outcome;
  assert.equal(resistant.damage, 5);
  const vulnerable = damageActor(started, monster.id, 5, '寒冷').outcome;
  assert.equal(vulnerable.damage, 10);
  const immune = damageActor(started, monster.id, 9, '毒素').outcome;
  assert.equal(immune.damage, 0);
  const withTemp = setTempHp(started, monster.id, 6);
  const hit = damageActor(withTemp, monster.id, 10, '火焰').outcome;
  assert.equal(hit.damage, 5);
  assert.equal(hit.tempAbsorbed, 5);
  assert.equal(hit.status, 'active');
});

test('生命值归零后角色倒地并可进行死亡豁免，三次失败死亡，掷出 20 恢复 1 点生命', () => {
  const battle = battleWithParty();
  const hero = battle.actors.find(a => a.characterSnapshot);
  const started = startCombat(battle, { [hero.id]: 20 });
  const down = damageActor(started, hero.id, hero.maxHp, '钝击').battle;
  assert.equal(down.actors.find(a => a.id === hero.id).combat.status, 'down', '角色倒地但未立即死亡');
  const fail = rollDeathSave(down, hero.id, { random: sequence(0.0, 0.0) });
  assert.equal(fail.outcome.failures, 2, '掷出 1 记两次失败');
  const stillDown = rollDeathSave(down, hero.id, { random: sequence(0.4) });
  assert.equal(stillDown.outcome.failures, 1);
  const stable = rollDeathSave(down, hero.id, { random: sequence(0.7) });
  assert.equal(stable.outcome.successes, 1);
  const dead = [0, 1].reduce((state) => rollDeathSave(state, hero.id, { random: sequence(0.0) }).battle, down);
  assert.equal(dead.actors.find(a => a.id === hero.id).combat.status, 'dead');
  const revived = rollDeathSave(down, hero.id, { random: sequence(0.99) });
  assert.equal(revived.outcome.revived, true);
  assert.equal(revived.battle.actors.find(a => a.id === hero.id).currentHp, 1);
});

test('怪物生命值归零直接死亡，治疗不能复活死亡单位', () => {
  const battle = battleWithMonsters(1);
  const monster = battle.actors[0];
  const started = startCombat(battle, { [monster.id]: 10 });
  const dead = damageActor(started, monster.id, monster.maxHp, '挥砍').battle;
  assert.equal(dead.actors[0].combat.status, 'dead');
  assert.throws(() => healActor(dead, monster.id, 5), /无法通过治疗恢复/);
});

test('动作与附赠动作独立限一次，非当前回合只能使用反应', () => {
  const battle = battleWithParty();
  const [monster, hero] = battle.actors;
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  const usedAction = spendResource(started, hero.id, 'action');
  assert.throws(() => spendResource(usedAction, hero.id, 'action'), /已经使用过动作/);
  const usedBonus = spendResource(usedAction, hero.id, 'bonus');
  assert.throws(() => spendResource(usedBonus, hero.id, 'bonus'), /已经使用过附赠动作/);
  assert.throws(() => spendResource(started, monster.id, 'action'), /当前回合/);
  assert.doesNotThrow(() => spendResource(started, monster.id, 'reaction'));
});

test('移动距离受速度限制，状态可切换，撤销恢复上一步', () => {
  const battle = battleWithParty();
  const [monster, hero] = battle.actors;
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  const moved = spendMovement(started, hero.id, 20);
  assert.equal(moved.actors.find(a => a.id === hero.id).combat.movementUsed, 20);
  assert.throws(() => spendMovement(moved, hero.id, 15), /速度上限/);
  const conditioned = toggleCondition(moved, monster.id, '恐慌');
  assert.deepEqual(conditioned.actors.find(a => a.id === monster.id).combat.conditions, ['恐慌']);
  const undone = undoCombat(conditioned);
  assert.deepEqual(undone.actors.find(a => a.id === monster.id).combat.conditions, []);
  const reset = resetCombat(undone);
  assert.equal(reset.combat, undefined);
  assert.equal(reset.actors.some(a => a.combat), false);
});

test('战斗开始后拒绝添加单位，移除单位会同步先攻顺序', () => {
  const battle = battleWithParty();
  const started = startCombat(battle, {});
  assert.throws(() => addMonsters({ version: 1, battles: [started] }, card, { battleId: started.id, side: '敌方', count: 1 }, ids()), /战斗已经开始/);
  const removed = removeActor({ version: 1, battles: [started] }, started.id, started.combat.order[0]).battles[0];
  assert.equal(removed.combat.order.length, started.combat.order.length - 1);
  assert.equal(removed.actors.length, started.actors.length - 1);
});

test('攻击倒地角色会累计死亡豁免失败，三次后死亡', () => {
  const battle = battleWithParty();
  const hero = battle.actors.find(a => a.characterSnapshot);
  const monster = battle.actors.find(a => !a.characterSnapshot);
  const started = startCombat(battle, { [hero.id]: 20, [monster.id]: 10 });
  const down = damageActor(started, hero.id, hero.maxHp, '钝击').battle;
  const first = attack(down, { attackerId: monster.id, targetId: hero.id, attackBonus: 20, damageExpression: '1d4', damageType: '挥砍', cost: 'reaction' }, { random: sequence(0.7, 0.5) });
  assert.equal(first.outcome.hit, true);
  assert.equal(first.outcome.targetHp, 0);
  assert.equal(first.outcome.damage, 3);
  const afterFirst = first.battle.actors.find(a => a.id === hero.id).combat;
  assert.equal(afterFirst.deathSaves.failures, 1);
  const afterSecond = damageActor(first.battle, hero.id, 3, '挥砍').battle;
  const dead = damageActor(afterSecond, hero.id, 3, '挥砍').battle;
  assert.equal(dead.actors.find(a => a.id === hero.id).combat.status, 'dead');
});

test('带战斗状态的存档可读写，损坏的战斗状态会被拒绝', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const started = startCombat(battleWithParty(), {});
  const store = { version: 1, battles: [started] };
  writeBattles(storage, store);
  assert.deepEqual(readBattles(storage), store);
  values.set(storageKey, JSON.stringify({ version: 1, battles: [{ ...started, combat: { ...started.combat, order: 'bad' } }] }));
  assert.throws(() => readBattles(storage), /本地战斗数据格式无效/);
});
