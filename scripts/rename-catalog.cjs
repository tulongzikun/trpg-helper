const fs = require('fs');
const file = 'apps/web/src/featureCatalog.ts';
let s = fs.readFileSync(file, 'utf8');
const before = s.length;
const pairs = [
  ['高等猎人猎物', '高阶猎杀技艺'],
  ['高等猎人防御', '高阶防守战术'],
  ['猎人猎物', '猎杀技艺'],
  ['猎人知识', '猎人学识'],
  ['武器掌握', '武器精通'],
  ['危险感知', '危机感应'],
  ['灵巧探索者', '熟练探险家'],
  ['漫游', '越野'],
  ['狂乱', '狂怒'],
  ['盲目狂怒', '无我狂暴'],
  ['反击', '报偿'],
  ['恐怖威仪', '威慑之姿'],
  ['神圣职司', '圣职'],
  ['稳固瞄准', '稳定瞄准'],
  ['生命信徒', '生命门徒'],
  ['保护生命', '维持生命'],
  ['受福医者', '神祝医者'],
  ['至上治疗', '极效治疗'],
  ['攀高', '梁上君子'],
  ['至高潜行', '极效潜行'],
  ['盗贼反射', '窃盗本能'],
  ['战术转移', '战术转进'],
];
for (const [from, to] of pairs) {
  const n = s.split(from).length - 1;
  if (n > 0) { s = s.split(from).join(to); console.log(`${from} -> ${to}: ${n}`); }
  else console.log(`${from} -> ${to}: 0 (skip)`);
}
fs.writeFileSync(file, s);
console.log('bytes', before, '->', s.length);
