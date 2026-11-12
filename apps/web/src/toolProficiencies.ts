import type { CharacterDraft } from './characters';
import { getBackground } from './backgrounds.ts';
import { artisanTools, gamingSets, musicalInstruments, tools2024 } from './tools2024.ts';

const backgroundPools: Record<string, readonly string[]> = {
  '一种工匠工具（自选）': artisanTools,
  '一种游戏工具（自选）': gamingSets,
  '一种乐器（自选）': musicalInstruments,
};

export function toolProficiencies(draft: CharacterDraft) {
  const details = draft.details;
  const config = details?.fighterCalculator;
  const background = config ? getBackground(details?.background) : undefined;
  const choices = config?.toolChoices;
  const pool = backgroundPools[background?.tool ?? ''];
  const backgroundChoice = choices?.background ?? '';
  const fixed = new Set<string>();
  if (background && tools2024.some(tool => tool === background.tool)) fixed.add(background.tool);
  if (config?.characterClass === '武僧' && config.subclass === 'mercy' && draft.level >= 3) fixed.add('草药工具');
  const backgroundInvalid = !!pool && !!backgroundChoice && !pool.includes(backgroundChoice);
  if (pool && pool.includes(backgroundChoice)) fixed.add(backgroundChoice);
  if (config?.characterClass === '德鲁伊') fixed.add('草药工具');
  if (config?.characterClass === '游荡者') fixed.add('盗贼工具');
  if (config?.characterClass === '游荡者' && config.subclass === 'assassin' && draft.level >= 3) {
    fixed.add('易容工具'); fixed.add('制毒工具');
  }
  const subclassPool:readonly string[] = config?.characterClass === '战士' && config.subclass === 'battle-master' && draft.level >= 3 ? artisanTools : [];
  const subclassChoice = config?.subclassTool ?? '';
  const subclassInvalid = subclassPool.length > 0 && !!subclassChoice && (!subclassPool.includes(subclassChoice) || fixed.has(subclassChoice));
  if (subclassPool.includes(subclassChoice) && subclassChoice) fixed.add(subclassChoice);
  const classPool: readonly string[] = config?.characterClass === '吟游诗人' ? musicalInstruments : config?.characterClass === '武僧' ? [...artisanTools, ...musicalInstruments] : [];
  const classLimit = config?.characterClass === '吟游诗人' ? 3 : config?.characterClass === '武僧' ? 1 : 0;
  const rawClassTools = config?.classTools;
  const classSelected = Array.isArray(rawClassTools) ? rawClassTools : [];
  const classInvalid = classLimit > 0 && ((rawClassTools !== undefined && !Array.isArray(rawClassTools)) ||
    (classSelected.length !== 0 && classSelected.length !== classLimit) || new Set(classSelected).size !== classSelected.length ||
    classSelected.some(x => typeof x !== 'string' || !classPool.includes(x) || fixed.has(x)));
  for (const tool of classSelected) if (classLimit && classPool.includes(tool)) fixed.add(tool);
  const sources = (['background', 'human'] as const).flatMap(source => {
    const feat = source === 'background' ? background?.feat : config?.species === '人类' ? config.humanOriginFeat : undefined;
    const options = feat === '工匠' ? artisanTools : feat === '音乐家' ? musicalInstruments : undefined;
    if (!options) return [];
    return [{ source, feat, options, selected: choices?.feats?.[source] }];
  });
  let invalid = backgroundInvalid || classInvalid || subclassInvalid;
  const granted = new Set(fixed);
  const feats = sources.map(item => {
    const raw = item.selected;
    const selected = Array.isArray(raw) ? raw : [];
    const bad = (raw !== undefined && !Array.isArray(raw)) || (selected.length !== 0 && selected.length !== 3) ||
      new Set(selected).size !== selected.length || selected.some(x => typeof x !== 'string' || !item.options.includes(x) || granted.has(x));
    invalid ||= bad;
    for (const x of selected) if (typeof x === 'string' && item.options.includes(x) && !granted.has(x)) granted.add(x);
    return { ...item, selected, invalid: bad };
  });
  return { pool, backgroundChoice, backgroundInvalid, fixed, subclassPool, subclassChoice, subclassInvalid, classPool, classLimit, classSelected, classInvalid, feats, granted, invalid };
}
