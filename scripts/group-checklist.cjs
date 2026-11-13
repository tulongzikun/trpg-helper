// Split checklist items into the 7 execution groups and write .cache/state/groups/T*.json
// Usage: node scripts/group-checklist.cjs
const fs = require('node:fs');
const path = require('node:path');

const state = JSON.parse(fs.readFileSync('.cache/state/checklist.json', 'utf8'));
const groups = {
  T1: { name: 'barbarian-ranger', classes: ['野蛮人', '游侠'], file: 'apps/web/src/groups/BarbarianRangerViews.tsx' },
  T2: { name: 'cleric-rogue', classes: ['牧师', '游荡者'], file: 'apps/web/src/groups/ClericRogueViews.tsx' },
  T3: { name: 'druid-paladin', classes: ['德鲁伊', '圣武士'], file: 'apps/web/src/groups/DruidPaladinViews.tsx' },
  T4: { name: 'fighter-warlock', classes: ['战士', '邪术师'], file: 'apps/web/src/groups/FighterWarlockViews.tsx' },
  T5: { name: 'monk-bard', classes: ['武僧', '吟游诗人'], file: 'apps/web/src/groups/MonkBardViews.tsx' },
  T6: { name: 'wizard-sorcerer', classes: ['法师', '术士'], file: 'apps/web/src/groups/WizardSorcererViews.tsx' },
  T7: { name: 'species-origin', classes: null, file: 'apps/web/src/groups/SpeciesOriginViews.tsx' },
};

const outDir = path.join('.cache', 'state', 'groups');
fs.mkdirSync(outDir, { recursive: true });

const kinds = {};
for (const section of state.sections) kinds[section.kind] = (kinds[section.kind] || 0) + 1;
console.log('section kinds:', kinds);

const summary = [];
for (const [id, g] of Object.entries(groups)) {
  const items = [];
  for (const section of state.sections) {
    const isClassGroup = section.kind === 'class' || section.kind === 'subclass';
    const inGroup = g.classes ? isClassGroup && g.classes.includes(section.class || section.name) : !isClassGroup;
    if (!inGroup) continue;
    for (const item of section.items) {
      items.push({
        line: item.line,
        status: item.status,
        checked: item.checked,
        level: item.level,
        name: item.name,
        note: item.note,
        sectionKind: section.kind,
        sectionClass: section.class || '',
        sectionName: section.name,
        en: section.en || '',
        url: section.url || '',
      });
    }
  }
  const counts = items.reduce((acc, it) => ((acc[it.status] = (acc[it.status] || 0) + 1), acc), {});
  const payload = { group: id, name: g.name, viewFile: g.file, counts, total: items.length, items };
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(payload, null, 1) + '\n', 'utf8');
  summary.push({ group: id, name: g.name, total: items.length, counts });
}
console.log(JSON.stringify(summary, null, 1));
console.log('total items:', summary.reduce((n, s) => n + s.total, 0));
