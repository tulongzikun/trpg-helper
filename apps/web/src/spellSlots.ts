import type { CharacterDraft } from './characters';
// 2024 single-class progression; each entry contains level 1–9 slot counts.
const fullSlots:number[][]=[[],[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
export type SpellSlots={kind:'standard';slots:number[];recovery:'长休'}|{kind:'pact';count:number;slotLevel:number;arcanumLevels:number[];recovery:'短休或长休'};
export function spellSlots(d:CharacterDraft):SpellSlots|null {
 const c=d.details?.fighterCalculator;if(!c||!Number.isInteger(d.level)||d.level<1||d.level>20)return null;
 const cls=c.characterClass??'战士',level=d.level;
 if(cls==='邪术师')return {kind:'pact',count:level===1?1:level<11?2:level<17?3:4,slotLevel:Math.min(5,Math.ceil(level/2)),arcanumLevels:[11,13,15,17].filter(x=>level>=x).map((_,i)=>i+6),recovery:'短休或长休'};
 let casterLevel=0;
 if(['吟游诗人','牧师','德鲁伊','术士','法师'].includes(cls))casterLevel=level;
 else if(['圣武士','游侠'].includes(cls))casterLevel=Math.ceil(level/2);
 else if(level>=3&&((cls==='战士'&&c.subclass==='eldritch-knight')||(cls==='游荡者'&&c.subclass==='arcane-trickster')))casterLevel=Math.ceil(level/3);
 return casterLevel?{kind:'standard',slots:[...fullSlots[casterLevel]],recovery:'长休'}:null;
}
