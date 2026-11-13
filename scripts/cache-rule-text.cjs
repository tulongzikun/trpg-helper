// Cache rule-page text for LOCAL VERIFICATION ONLY.
// Output goes to .cache/rules/ (gitignored). Third-party rule text must never be
// committed or redistributed; this file only stores source URLs and derived notes.
const fs = require('node:fs/promises');
const path = require('node:path');
const cheerio = require('cheerio');

const classIndex = require('../apps/web/src/data/imported-class-index.json');
const subclassIndex = require('../apps/web/src/data/imported-subclass-index.json');
const outDir = '.cache/rules';
const textDir = path.join(outDir, 'text');
const CONCURRENCY = 5;

function toText(html) {
  const $ = cheerio.load(html);
  $('script,style,link,meta').remove();
  const lines = [];
  const blocks = $('h1,h2,h3,h4,h5,p,li,tr').toArray();
  for (const el of blocks) {
    const tag = el.tagName.toLowerCase();
    const $el = $(el);
    // skip blocks nested inside an already-emitted block (avoid duplicates)
    if ($el.parents('li,p,tr,td,th').length > 0) continue;
    const clone = $el.clone();
    clone.find('ul,ol,table,div,blockquote').remove();
    let text = clone.text().replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
    if (!text) continue;
    if (tag === 'h1') lines.push(`# ${text}`);
    else if (tag === 'h2') lines.push(`## ${text}`);
    else if (tag === 'h3') lines.push(`### ${text}`);
    else if (tag === 'h4' || tag === 'h5') lines.push(`#### ${text}`);
    else if (tag === 'li') lines.push(`- ${text}`);
    else if (tag === 'tr') {
      const cells = $el.find('td,th').toArray().map((c) => $(c).text().replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (cells.length) lines.push(cells.join(' | '));
    } else lines.push(text);
  }
  // collapse repeated blank lines
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

async function fetchOne(entry) {
  const res = await fetch(entry.url, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function main() {
  await fs.mkdir(textDir, { recursive: true });
  const jobs = [];
  for (const [name, info] of Object.entries(classIndex)) {
    jobs.push({ key: name, kind: 'class', cls: name, name, url: info.url, features: info.features });
  }
  const classOf = Object.fromEntries(Object.keys(classIndex).map((c) => [c, c]));
  for (const [key, info] of Object.entries(subclassIndex)) {
    const [cls, slug] = key.split(':');
    jobs.push({ key: `${cls}_${slug}`, kind: 'subclass', cls, name: key, url: info.url, features: info.features });
  }
  void classOf;
  const index = [];
  const failures = [];
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const file = path.join(textDir, `${job.key}.txt`);
      try {
        const html = await fetchOne(job);
        const text = toText(html);
        await fs.writeFile(file, text, 'utf8');
        index.push({ path: `${job.kind === 'class' ? '职业' : '子职业'}/${job.name}`, key: job.key, kind: job.kind, class: job.cls, url: job.url, file, chars: text.length, features: job.features });
      } catch (e) {
        failures.push(`${job.name}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  index.sort((a, b) => a.key.localeCompare(b.key, 'zh'));
  await fs.writeFile(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.log(`cached ${index.length}/${jobs.length} pages -> ${outDir}`);
  if (failures.length) console.log('FAILURES:\n' + failures.join('\n'));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
