import type { CharacterDraft } from './characters';
import { changeClassResource, classResources } from './classResources.ts';
import { clericRogueConfig, type ClericRogueFields } from './clericRogueRules.ts';

// 牧师 / 游荡者（T2 组）可写入草稿的动作；新增字段在 characters.ts 合并前以断言方式读写。
export function patchClericRogueConfig(draft: CharacterDraft, patch: ClericRogueFields): CharacterDraft {
 const details = draft.details, c = details?.fighterCalculator;
 if (!details || !c) return draft;
 return { ...draft, details: { ...details, fighterCalculator: { ...c, ...patch } as typeof c } };
}
export function setDivineOrder(draft: CharacterDraft, order: 'protector' | 'thaumaturge' | ''): CharacterDraft {
 const details = draft.details, c = details?.fighterCalculator;
 if (!details || !c) return draft;
 return { ...draft, details: { ...details, fighterCalculator: { ...c, classOrder: order } } };
}
export function setBlessedStrike(draft: CharacterDraft, choice: 'divine' | 'potent' | ''): CharacterDraft {
 return patchClericRogueConfig(draft, { clericBlessedStrike: choice });
}
export function setRogueWeaponMastery(draft: CharacterDraft, index: number, value: string): CharacterDraft {
 if (index !== 0 && index !== 1) return draft;
 const next = [clericRogueConfig(draft)?.weaponMasteryChoices?.[0] ?? '', clericRogueConfig(draft)?.weaponMasteryChoices?.[1] ?? ''];
 next[index] = value;
 return patchClericRogueConfig(draft, { weaponMasteryChoices: next });
}

function remaining(draft: CharacterDraft, id: string) {
 return classResources(draft).find(x => x.id === id)?.remaining ?? 0;
}
function spend(draft: CharacterDraft, id: string, count: number) {
 if (count < 1 || remaining(draft, id) < count) return draft;
 return changeClassResource(draft, id, count);
}

export function useClericChannel(draft: CharacterDraft, times = 1) {
 if (!clericRogueConfig(draft) || clericRogueConfig(draft)?.characterClass !== '牧师') return draft;
 return spend(draft, 'cleric-channel', times);
}
export const useLifePreserve = (draft: CharacterDraft) => useClericChannel(draft);
export const useRadianceOfDawn = (draft: CharacterDraft) => useClericChannel(draft);
export const useInvokeDuplicity = (draft: CharacterDraft) => useClericChannel(draft);
export const useGuidedStrike = (draft: CharacterDraft) => useClericChannel(draft);
export const useWarGodBlessing = (draft: CharacterDraft) => useClericChannel(draft);

export function spendSoulknifePsi(draft: CharacterDraft, count = 1) {
 if (clericRogueConfig(draft)?.subclass !== 'soulknife') return draft;
 return spend(draft, 'soulknife-psi', count);
}
export function resetSoulknifeFeature(draft: CharacterDraft, feature: 'veil' | 'rend-mind'): CharacterDraft {
 const c = clericRogueConfig(draft);
 if (c?.characterClass !== '游荡者' || c?.subclass !== 'soulknife') return draft;
 const id = feature === 'veil' ? 'soulknife-veil' : 'soulknife-rend-mind';
 const cost = feature === 'veil' ? 1 : 3;
 const resource = classResources(draft).find(x => x.id === id);
 if (!resource || resource.remaining > 0 || remaining(draft, 'soulknife-psi') < cost) return draft;
 const next = changeClassResource(draft, 'soulknife-psi', cost);
 return changeClassResource(next, id, -1);
}
