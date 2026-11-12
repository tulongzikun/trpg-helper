export type SpellCopyMode='new'|'backup';
/** Costs for copying a levelled wizard spell, in hours and gold pieces. */
export function spellCopyCost(level:number,mode:SpellCopyMode){
 if(!Number.isInteger(level)||level<1||level>9||!['new','backup'].includes(mode))return null;
 return mode==='new'?{hours:level*2,gold:level*50}:{hours:level,gold:level*10};
}
