const { test } = require('node:test');
const assert = require('node:assert/strict');
const { addMonsters, emptyStore, updateActorHp, removeActor, readBattles, writeBattles, storageKey } = require('../apps/web/src/battle.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
const ids = () => { let n=0; return () => `id-${++n}`; };
test('create a battle with independent monster snapshots', () => {
  const base=emptyStore(); const {store,battleId}=addMonsters(base,card,{newBattleName:'遭遇',side:'敌方',count:2},ids(),()=> '2026-01-01T00:00:00Z');
  assert.equal(base.battles.length,0); assert.equal(store.battles[0].id,battleId);
  const [a,b]=store.battles[0].actors; assert.notEqual(a.id,b.id); assert.equal(a.source.blockId,card.block.id);
  a.template.abilities.str=3; assert.notEqual(b.template.abilities.str,3); assert.notEqual(card.block.abilities.str,3);
  const changed=updateActorHp(store,battleId,a.id,2); assert.equal(changed.battles[0].actors[0].currentHp,2); assert.equal(changed.battles[0].actors[1].currentHp,b.maxHp); assert.equal(store.battles[0].actors[0].currentHp,a.maxHp);
  assert.equal(removeActor(changed,battleId,a.id).battles[0].actors.length,1);
});
test('reject invalid imports and hit points without changing existing data', () => {
  const base=emptyStore(); assert.throws(()=>addMonsters(base,card,{newBattleName:'',side:'敌方',count:1})); assert.throws(()=>addMonsters(base,card,{newBattleName:'测试',side:'敌方',count:0})); assert.throws(()=>addMonsters(base,card,{battleId:'missing',side:'敌方',count:1})); assert.deepEqual(base,emptyStore());
  const result=addMonsters(base,card,{newBattleName:'测试',side:'敌方',count:1},ids());const actor=result.store.battles[0].actors[0];assert.throws(()=>updateActorHp(result.store,result.battleId,actor.id,actor.maxHp+1));assert.equal(actor.currentHp,actor.maxHp);
});
test('restore saved battles and reject malformed storage without overwriting it', () => {
  const values = new Map(); const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}; const result=addMonsters(emptyStore(),card,{newBattleName:'测试',side:'友方',count:1},ids()); writeBattles(storage,result.store);assert.deepEqual(readBattles(storage),result.store);
  values.set(storageKey,'{"version":2,"battles":[]}');assert.throws(()=>readBattles(storage));assert.equal(values.get(storageKey),'{"version":2,"battles":[]}');
});
