const fs = require('fs');
const tokens = ['武器掌握','危险感知','灵巧探索者','漫游','狂乱','盲目狂怒','反击','恐怖威仪','猎人知识','猎人猎物','高等猎人猎物','高等猎人防御','神圣职司','稳固瞄准','生命信徒','保护生命','受福医者','至上治疗','攀高','至高潜行','盗贼反射','战术转移'];
const file = 'apps/web/src/featureCatalog.ts';
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
for (const t of tokens) {
  const hits = [];
  lines.forEach((l, i) => { if (l.includes("'" + t + "'") || l.includes('"' + t + '"')) hits.push((i + 1) + ': ' + l.trim().slice(0, 160)); });
  console.log('## ' + t + ' -> ' + hits.length);
  hits.slice(0, 6).forEach((h) => console.log('   ' + h));
}
