const {test}=require('node:test');const assert=require('node:assert/strict');
const {newAutomaticDraft,pointBuyCost}=require('../apps/web/src/characters.ts');
const {deriveCharacter,automaticError}=require('../apps/web/src/automaticRules.ts');
function draft(c,s,level=1){return {...newAutomaticDraft(),characterClass:c,species:s,level,abilities:{str:10,dex:14,con:14,int:10,wis:12,cha:10}}}
test('new drafts use 27 point buy',()=>{let d=newAutomaticDraft();assert.equal(pointBuyCost(d.details.baseAbilities),27);assert.equal(d.details.abilityMethod,'point-buy')});
test('fixed hit points include dwarven toughness',()=>{let d=deriveCharacter(draft('战士','矮人',3));assert.equal(d.maxHp,31)});
test('armor dexterity cap, shield training and strength affect statistics',()=>{let d=draft('战士','人类');d.details={...d.details,armor:'锁子甲',shield:true};d=deriveCharacter(d);assert.equal(d.armorClass,18);assert.equal(d.speedFt,20)});
test('species and unarmored class bonuses are calculated',()=>{let d=deriveCharacter(draft('野蛮人','歌利亚',5));assert.equal(d.armorClass,14);assert.equal(d.speedFt,45);let e=draft('武僧','精灵',2);e.details.elfLineage='木精灵';e=deriveCharacter(e);assert.equal(e.armorClass,13);assert.equal(e.speedFt,45)});
test('missing or unsupported selections block automatic publication',()=>{let d=draft('战士','精灵');assert.ok(automaticError(d));d.details.elfLineage='木精灵';assert.equal(automaticError(d),null);d.species='自定义';assert.ok(automaticError(d))});

