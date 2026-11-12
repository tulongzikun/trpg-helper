import type { CharacterDraft } from './characters';
import { primalKnowledgeChecks } from './primalKnowledge';
export function PrimalKnowledgeSheet({draft}:{draft:CharacterDraft}){
 const checks=primalKnowledgeChecks(draft);if(!checks.length)return null;
 return <div><h3>原初学识：狂暴时的检定</h3><p className="character-help">狂暴时，可对下列技能使用力量进行属性检定；这些力量检定具有优势。是否处于狂暴、重甲限制与持续时间需自行确认。</p><p className="sheet-text">{checks.map(x=>`${x.name} ${x.modifier>=0?'+':''}${x.modifier}`).join(' · ')}</p></div>;
}
