import type { CharacterDraft } from './characters';
import { spellSlots } from './spellSlots.ts';
import { alwaysPreparedSpells } from './preparedSpells.ts';
export type PreparedClassSpell={name:string;level:number;source?:'吟游诗人'|'牧师'|'德鲁伊'|'法师'};
export type ClassSpellSelection={cantrips:string[];prepared:PreparedClassSpell[];book?:PreparedClassSpell[];lore?:PreparedClassSpell[];arcanum?:Record<string,string>;signature?:string[];mastery?:Record<string,string>};
export type SupportedSpellClass='牧师'|'德鲁伊'|'吟游诗人'|'圣武士'|'游侠'|'术士'|'邪术师'|'法师'|'战士'|'游荡者';
const preparedCounts=[0,4,5,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22];
const halfCounts=[0,2,3,4,5,6,6,7,7,9,9,10,10,11,11,12,12,14,14,15,15];
const warlockCounts=[0,2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15];
const wizardCounts=[0,4,5,6,7,9,10,11,12,14,15,16,16,17,18,19,21,22,23,24,25];
const thirdCounts=[0,0,0,3,4,4,4,5,6,6,7,8,8,9,10,10,11,11,11,12,13];
const supported=['牧师','德鲁伊','吟游诗人','圣武士','游侠','术士','邪术师','法师'];
export function spellNameKey(name:string){return (name.split(/[A-Za-z]/,1)[0].trim()||name.trim().toLowerCase()).replace(/次等复原术/g,'次级复原术').replace(/诚实之域/g,'真实之域');}
export function spellIdentity(name:string){const english=name.match(/[A-Za-z].*$/)?.[0];return english?english.toLowerCase().replace(/[^a-z0-9]/g,''):spellNameKey(name);}
export function classSpellState(draft:CharacterDraft){
 const c=draft.details?.fighterCalculator,cls=c?.characterClass;
 const third=!!c&&draft.level>=3&&((cls==='战士'&&c.subclass==='eldritch-knight')||(cls==='游荡者'&&c.subclass==='arcane-trickster'));
 if(!c||!cls||(!supported.includes(cls)&&!third))return null;
 const spellClass=cls as SupportedSpellClass;
 const baseCantrips=cls==='牧师'||cls==='法师'?3:cls==='术士'?4:(cls==='圣武士'||cls==='游侠')?0:2;
 const cantripLimit=third?2+(draft.level>=10?1:0):baseCantrips+(baseCantrips&&draft.level>=4?1:0)+(baseCantrips&&draft.level>=10?1:0)+((cls==='牧师'&&c.classOrder==='thaumaturge')||(cls==='德鲁伊'&&c.classOrder==='magician')?1:0);
 const preparedLimit=(third?thirdCounts:cls==='圣武士'||cls==='游侠'?halfCounts:cls==='邪术师'?warlockCounts:cls==='法师'?wizardCounts:cls==='术士'?[...preparedCounts.slice(0,1),2,4,6,...preparedCounts.slice(4)]:preparedCounts)[draft.level]??0;const slots=spellSlots(draft);const maxLevel=slots?.kind==='standard'?slots.slots.length:slots?.kind==='pact'?slots.slotLevel:0;
 const raw=c.classSpellChoices?.[spellClass];const cantrips=Array.isArray(raw?.cantrips)?raw.cantrips:[];const prepared=Array.isArray(raw?.prepared)?raw.prepared:[];
 const book=Array.isArray(raw?.book)?raw.book:[];
 const signatureActive=cls==='法师'&&draft.level>=20;
 const signature=signatureActive&&Array.isArray(raw?.signature)?raw.signature:[];
 const masteryActive=cls==='法师'&&draft.level>=18;
 const mastery=masteryActive&&raw?.mastery&&typeof raw.mastery==='object'&&!Array.isArray(raw.mastery)?raw.mastery:{};
 const invalidMastery=masteryActive&&((raw?.mastery!==undefined&&(!raw.mastery||typeof raw.mastery!=='object'||Array.isArray(raw.mastery)))||['1','2'].some(level=>mastery[level]!==undefined&&(typeof mastery[level]!=='string'||!book.some(b=>b?.level===Number(level)&&b.name===mastery[level]))));
 const arcanumLevels=slots?.kind==='pact'?slots.arcanumLevels:[];
 const arcanum=raw?.arcanum&&typeof raw.arcanum==='object'&&!Array.isArray(raw.arcanum)?raw.arcanum:{};
 const invalidArcanum=cls==='邪术师'&&((raw?.arcanum!==undefined&&(!raw.arcanum||typeof raw.arcanum!=='object'||Array.isArray(raw.arcanum)))||arcanumLevels.some(level=>arcanum[String(level)]!==undefined&&(typeof arcanum[String(level)]!=='string'||!arcanum[String(level)].trim())));
 const loreActive=cls==='吟游诗人'&&c.subclass==='lore'&&draft.level>=6;
 const lore=loreActive&&Array.isArray(raw?.lore)?raw.lore:[];
 const always=new Set(alwaysPreparedSpells(draft).map(s=>spellNameKey(s.name)));
 for(const spell of lore)if(spell&&typeof spell.name==='string')always.add(spellNameKey(spell.name));
 for(const name of signature)if(typeof name==='string')always.add(spellNameKey(name));
 for(const name of Object.values(mastery))if(typeof name==='string')always.add(spellNameKey(name));
 const loreIdentities=new Set(lore.filter(x=>x&&typeof x.name==='string').map(x=>spellIdentity(x.name)));
 const duplicatePrepared=prepared.some(x=>x&&typeof x.name==='string'&&(always.has(spellNameKey(x.name))||loreIdentities.has(spellIdentity(x.name))));
 const invalidBook=cls==='法师'&&((raw?.book!==undefined&&!Array.isArray(raw.book))||new Set(book.map(x=>x?.name)).size!==book.length||book.some(x=>!x||typeof x.name!=='string'||!x.name.trim()||!Number.isInteger(x.level)||x.level<1||x.level>maxLevel)||prepared.some(x=>x&&!book.some(b=>b&&b.name===x.name&&b.level===x.level)));
 const invalidSignature=signatureActive&&((raw?.signature!==undefined&&!Array.isArray(raw.signature))||signature.length>2||new Set(signature).size!==signature.length||signature.some(name=>typeof name!=='string'||!book.some(b=>b?.level===3&&b.name===name)));
 const invalidLore=loreActive&&((raw?.lore!==undefined&&!Array.isArray(raw.lore))||lore.length>2||new Set(lore.map(x=>typeof x?.name==='string'?spellIdentity(x.name):undefined)).size!==lore.length||lore.some(x=>!x||typeof x.name!=='string'||!x.name.trim()||!Number.isInteger(x.level)||x.level<0||x.level>maxLevel||!['牧师','德鲁伊','法师'].includes(x.source??''))||lore.some(x=>x&&typeof x.name==='string'&&x.level===0&&cantrips.some(n=>typeof n==='string'&&spellIdentity(n)===spellIdentity(x.name))));
 const invalidSource=cls==='吟游诗人'&&prepared.some(x=>x?.source&&!(draft.level>=10?['吟游诗人','牧师','德鲁伊','法师']:['吟游诗人']).includes(x.source));
 const fixedMageHand=third&&cls==='游荡者';
 const invalid=(raw!==undefined&&(!raw||!Array.isArray(raw.cantrips)||!Array.isArray(raw.prepared)))||cantrips.length>cantripLimit||new Set(cantrips).size!==cantrips.length||cantrips.some(x=>typeof x!=='string'||!x.trim()||(fixedMageHand&&(spellIdentity(x)==='magehand'||spellNameKey(x)==='法师之手'))) ||prepared.length>preparedLimit||new Set(prepared.map(x=>typeof x?.name==='string'?spellIdentity(x.name):undefined)).size!==prepared.length||prepared.some(x=>!x||typeof x.name!=='string'||!x.name.trim()||!Number.isInteger(x.level)||x.level<1||x.level>maxLevel)||duplicatePrepared||invalidBook||invalidLore||invalidSource||invalidArcanum||invalidSignature||invalidMastery;
 return {cls:spellClass,third,fixedMageHand,cantripLimit,preparedLimit,maxLevel,cantrips,prepared,book,lore,loreActive,always,arcanum,arcanumLevels,signature,signatureActive,mastery,masteryActive,invalidMastery,invalidSignature,invalidArcanum,duplicatePrepared,invalidBook,invalidLore,invalidSource,invalid};
}
