import type { CharacterDraft } from '../characters';
import { WizardSorcererFeatureEditor, WizardSorcererFeatureSheet } from '../WizardSorcererFeatureViews';
// 法师 + 术士（职业基础特性与 8 个子职业）聚合视图；由 wizard-sorcerer 组维护。
// 戏法/准备/法术书/精通/招牌法术、法术位与子职法术表已由 CharacterDetails 全局挂载的组件提供，此处不重复。
export function WizardSorcererEditorGroup({ draft, onChange }: { draft: CharacterDraft; onChange: (draft: CharacterDraft) => void }) {
  return <WizardSorcererFeatureEditor draft={draft} onChange={onChange} />;
}
export function WizardSorcererSheetGroup({ draft }: { draft: CharacterDraft }) {
  return <WizardSorcererFeatureSheet draft={draft} />;
}
