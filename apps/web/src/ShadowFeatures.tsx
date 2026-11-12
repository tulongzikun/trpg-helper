import type { CharacterDraft } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules';
export function ShadowFeatures({draft}:{draft:CharacterDraft}){
 const c=draft.details?.fighterCalculator;if(!c||draft.level<3)return null;
 if(c.characterClass==='武僧'&&c.subclass==='shadow'){
  const attack=abilityModifier(draft.abilities.wis)+proficiencyBonus(draft.level);
  return <><h3>暗影武者戏法</h3><p className="character-help">次级幻影（感知施法；法术攻击 {attack>=0?'+':''}{attack}，豁免 DC {8+attack}）。你可以看穿由暗影技艺施展的黑暗术。</p></>;
 }
 if(c.characterClass==='游侠'&&c.subclass==='gloom-stalker')return <><h3>阴影视野</h3><p className="character-help">完全身处黑暗时，依靠黑暗视觉观察你的生物无法看见你。</p></>;
 return null;
}
