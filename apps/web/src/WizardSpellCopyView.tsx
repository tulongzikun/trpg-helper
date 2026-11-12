import { useState } from 'react';
import { spellCopyCost, type SpellCopyMode } from './wizardSpellCopy';
export function WizardSpellCopy({maxLevel}:{maxLevel:number}){
 const [level,setLevel]=useState(1);const [mode,setMode]=useState<SpellCopyMode>('new');
 const eligible=level<=maxLevel;const cost=spellCopyCost(level,mode);
 return <details><summary>法术书抄录时间和费用</summary><p className="character-help">从找到的法术抄录，或将自己法术书中的法术复制到另一本书；此处只计算单个法术，不自动扣除财物或记录时间。</p><label>抄录方式<select value={mode} onChange={e=>setMode(e.target.value as SpellCopyMode)}><option value="new">抄录找到的新法术</option><option value="backup">复制自己法术书中的法术</option></select></label><label>法术环阶<select value={level} onChange={e=>setLevel(Number(e.target.value))}>{Array.from({length:9},(_,i)=><option value={i+1} key={i}>{i+1} 环</option>)}</select></label>{cost&&<p className="sheet-text">所需：{cost.hours} 小时、{cost.gold} 金币。</p>}{mode==='new'&&!eligible&&<p className="battle-error">该环阶高于当前可准备的法师法术环阶，不能按通常规则抄录。</p>}{mode==='backup'&&<p className="character-help">此方式要求法术已在自己的法术书中；法术书遗失后，也可用此方式抄录仍准备着的法术。</p>}</details>;
}
