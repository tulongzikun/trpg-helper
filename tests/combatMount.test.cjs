const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, mountUp, dismount, mountCandidates, moveActorToCell, damageActor } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `mount-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-mount', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '凯尔', species: '人类', characterClass: '战士', level: 4,
    abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '骑乘', side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  let next = structuredClone(added.store.battles[0]);
  const mount = next.actors.find(actor => actor.name.includes('雾影兽') || actor.side === '友方' && actor.characterSnapshot === undefined);
  mount.template = { ...mount.template, speedFt: { walk: 60 } };
  next = configureGrid(next, { width: 16, height: 10, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.characterSnapshot ? 20 : 10 - index; });
  next = startCombat(next, initiatives);
  next = structuredClone(next);
  const rider = next.actors.find(actor => actor.characterSnapshot !== undefined);
  const beast = next.actors.find(actor => actor.id !== rider.id);
  rider.position = { x: 0, y: 0 };
  beast.position = { x: 1, y: 0 };
  return { battle: next, rider, beast };
}

const logs = battle => battle.combat.log.map(line => line.text).join('\n');

test('骑上坐骑记录双方关系并继承坐骑速度', () => {
  const { battle, rider, beast } = setup();
  const mounted = mountUp(battle, rider.id, beast.id);
  const riderState = mounted.actors.find(actor => actor.id === rider.id).combat;
  const mountState = mounted.actors.find(actor => actor.id === beast.id).combat;
  assert.equal(riderState.mountedOn, beast.id);
  assert.equal(riderState.mountSpeedFt, 60);
  assert.equal(mountState.riderId, rider.id);
  assert.match(logs(mounted), /骑上了/);
});

test('骑乘后移动上限取自坐骑速度', () => {
  const { battle, rider, beast } = setup();
  assert.throws(() => moveActorToCell(battle, rider.id, 8, 0), /移动距离超出速度上限（30 尺）/);
  const mounted = mountUp(battle, rider.id, beast.id);
  const moved = moveActorToCell(mounted, rider.id, 8, 0);
  const state = moved.actors.find(actor => actor.id === rider.id).combat;
  assert.equal(state.movementUsed, 40);
  assert.deepEqual(moved.actors.find(actor => actor.id === rider.id).position, { x: 8, y: 0 });
});

test('非法骑乘组合会被拒绝', () => {
  const { battle, rider, beast } = setup();
  assert.throws(() => mountUp(battle, rider.id, rider.id), /单位不能骑乘自己/);
  const enemy = structuredClone(battle);
  enemy.actors.find(actor => actor.id === beast.id).side = '敌方';
  assert.throws(() => mountUp(enemy, rider.id, beast.id), /只能骑乘同阵营的坐骑/);
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === beast.id).position = { x: 6, y: 6 };
  assert.throws(() => mountUp(far, rider.id, beast.id), /骑乘需要与坐骑相邻/);
  const mounted = mountUp(battle, rider.id, beast.id);
  assert.throws(() => mountUp(mounted, rider.id, beast.id), /该单位已经骑乘在坐骑上/);
  const twice = structuredClone(mounted);
  const extra = structuredClone(mounted.actors.find(actor => actor.id === rider.id));
  extra.id = 'rider-2';
  extra.name = '第二位骑手';
  extra.combat = { ...(extra.combat ?? {}), status: 'active' };
  delete extra.combat.mountedOn;
  delete extra.combat.mountSpeedFt;
  twice.actors.push(extra);
  assert.throws(() => mountUp(twice, 'rider-2', beast.id), /这匹坐骑上已经有骑手了/);
});

test('下马清除骑乘关系，未骑乘时拒绝', () => {
  const { battle, rider, beast } = setup();
  const mounted = mountUp(battle, rider.id, beast.id);
  const off = dismount(mounted, rider.id);
  const riderState = off.actors.find(actor => actor.id === rider.id).combat;
  const mountState = off.actors.find(actor => actor.id === beast.id).combat;
  assert.equal(riderState.mountedOn, undefined);
  assert.equal(riderState.mountSpeedFt, undefined);
  assert.equal(mountState.riderId, undefined);
  assert.match(logs(off), /上下来/);
  assert.throws(() => dismount(off, rider.id), /该单位没有骑乘坐骑/);
});

test('坐骑死亡时骑手落马并倒地', () => {
  const { battle, rider, beast } = setup();
  const mounted = mountUp(battle, rider.id, beast.id);
  const settled = damageActor(mounted, beast.id, 200, '挥砍').battle;
  assert.equal(settled.actors.find(actor => actor.id === beast.id).combat.status, 'dead');
  const riderState = settled.actors.find(actor => actor.id === rider.id).combat;
  assert.equal(riderState.mountedOn, undefined);
  assert.equal(riderState.mountSpeedFt, undefined);
  assert.ok(riderState.conditions.includes('倒地'));
  assert.match(logs(settled), /骑手落马倒地/);
});

test('可骑乘候选只包含相邻且无人骑乘的同阵营单位', () => {
  const { battle, rider, beast } = setup();
  assert.deepEqual(mountCandidates(battle, rider.id).map(actor => actor.id), [beast.id]);
  const mounted = mountUp(battle, rider.id, beast.id);
  assert.deepEqual(mountCandidates(mounted, rider.id), []);
  const far = structuredClone(battle);
  far.actors.find(actor => actor.id === beast.id).position = { x: 9, y: 9 };
  assert.deepEqual(mountCandidates(far, rider.id), []);
});
