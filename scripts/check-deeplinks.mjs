/**
 * 天体直达外链自检。
 *
 * 跑的是生产配置：与 gen-deeplinks.mjs 相同的方式在 Node 里 import 各 system，
 * 逐条比对 src/data/deeplinks.json，防止「新增天体忘了重新生成清单」或
 * 「URL 契约被改坏 / overview 旧名回潮」。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import DATA from '../src/data/deeplinks.js';
import { resolveBody, bodyHref } from '../src/deeplinks.js';
import { ENTRIES } from '../vite.base.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const SRC = resolve(ROOT, 'src');
const TMP = resolve(SRC, '.check-links-tmp');
const errors = [];
const fail = (m) => errors.push(m);

function toNodeModule(code) {
  return code
    .replace(/^import\s+\w+\s+from\s+'\/?images\/[^']+';\s*$/gm, (m) =>
      `const ${m.match(/import\s+(\w+)/)[1]} = '${m.match(/images\/[^']+/)[0]}';`)
    .replace(/^import\s+\{\s*starfield\s*\}\s+from\s+'\.\/shared\.js';\s*$/gm,
      "const starfield = ['1','2','3','4','5','6'];");
}
globalThis.document = {
  createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }),
  createElement: () => ({ addEventListener() {}, removeEventListener() {}, style: {}, getContext: () => null }),
};

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
for (const f of readdirSync(resolve(SRC, 'systems'))) {
  if (f.endsWith('.js') && f !== 'shared.js' && f !== 'cosmos.js') {
    writeFileSync(resolve(TMP, f), toNodeModule(readFileSync(resolve(SRC, 'systems', f), 'utf8')));
  }
}

// ---- 清单必须逐条对应真实 system 配置 ----
const live = new Map();   // "page:id" → { name, tier }
const listed = new Set();
for (const b of DATA.bodies) {
  const k = `${b.page}:${b.id}`;
  if (listed.has(k)) fail(`清单里重复条目: ${k}`);
  listed.add(k);
}
const pages = new Map(DATA.pages.map((p) => [p.file, p.key]));
for (const [file, key] of pages) {
  const tmpFile = `${key}.js`;
  if (!existsSync(resolve(TMP, tmpFile))) { fail(`页面 ${file} 找不到 system 配置 ${tmpFile}`); continue; }
  const sys = (await import(pathToFileURL(resolve(TMP, tmpFile)).href)).default;
  for (const b of sys.bodies) live.set(`${file}:${b.id}`, { name: b.name, tier: b.tier ?? null });
  if (sys.hasSun) live.set(`${file}:sun`, { name: '太阳', tier: null });
}
for (const b of DATA.bodies) {
  const k = `${b.page}:${b.id}`;
  const real = live.get(k);
  if (!real) { fail(`清单条目在 system 配置里已不存在: ${k}`); continue; }
  if (real.name !== b.name) fail(`${k} 中文名不一致：清单 ${b.name} / 配置 ${real.name}`);
  if (real.tier != null && b.tier !== real.tier) fail(`${k} 比例尺档位不一致：清单 ${b.tier} / 配置 ${real.tier}`);
}
for (const k of live.keys()) {
  if (!DATA.bodies.some((b) => `${b.page}:${b.id}` === k)) fail(`system 配置里有天体没进清单（请跑 npm run gen:links）: ${k}`);
}

// ---- ID / 链接契约 ----
const keys = new Set();
const shorts = new Set();
for (const b of DATA.bodies) {
  if (keys.has(b.key)) fail(`key 重复: ${b.key}`);
  keys.add(b.key);
  if (b.short) {
    if (shorts.has(b.short)) fail(`裸 ID 重复却都标成 short: ${b.short}`);
    shorts.add(b.short);
  }
  if (!pages.has(b.page)) fail(`${b.key} 的页面 ${b.page} 不在 pages 里`);
  if (!existsSync(resolve(SRC, b.page))) fail(`${b.key} 的页面文件不存在: src/${b.page}`);
  if (!b.url.startsWith(`${b.page}?body=`)) fail(`${b.key} 的规范链接格式错误: ${b.url}`);
  if (!b.goUrl.startsWith('go.html?body=')) fail(`${b.key} 的万能链接格式错误: ${b.goUrl}`);
  if (/\b(ly|kpc)\b/.test(b.name)) fail(`${b.key} 中文名混入英文单位: ${b.name}`);
}
for (const p of DATA.pages) {
  if (!Object.values(ENTRIES).includes(p.file)) fail(`页面 ${p.file} 不在 Vite 入口表 ENTRIES 里`);
  const n = DATA.bodies.filter((b) => b.page === p.file).length;
  if (p.count !== n) fail(`页面 ${p.file} 的 count=${p.count}，实际 ${n}`);
}

// ---- 解析函数行为 ----
const cases = [
  ['earth', 'solar.html', 'earth'],
  ['solar:earth', 'solar.html', 'earth'],
  ['地球', 'solar.html', 'earth'],
  ['europa', 'jupiter.html', 'europa'],
  ['jupiter:jupiter', 'jupiter.html', 'jupiter'],
  ['jupiter', 'solar.html', 'jupiter'],
  ['galaxy:sun', 'galaxy.html', 'sun'],
  ['proxima', 'galaxy.html', 'proxima'],
  ['not-a-body', null, null],
];
for (const [spec, page, id] of cases) {
  const got = resolveBody(spec);
  if ((got?.page ?? null) !== page || (got?.id ?? null) !== id) {
    fail(`resolveBody('${spec}') 应为 ${page}/${id}，实际 ${got?.page}/${got?.id}`);
  }
}
const href = bodyHref('europa', { embed: true, lang: 'en' });
if (href !== 'jupiter.html?body=europa&embed=1&lang=en') fail(`bodyHref 参数透传错误: ${href}`);
if (bodyHref('jupiter:jupiter')) {
  const u = new URL(bodyHref('jupiter:jupiter'), 'http://x/');
  if (u.searchParams.get('body') !== 'jupiter:jupiter') fail('跨页同名没用 页面:ID 消歧');
}

// ---- 生成器产物与旧名残留 ----
for (const f of ['solar.html', 'go.html']) {
  if (!existsSync(resolve(SRC, f))) fail(`缺少页面 src/${f}`);
}
if (!existsSync(resolve(ROOT, 'static/links.html'))) {
  fail('缺少 static/links.html（跑 npm run gen:links 生成）');
}
if (existsSync(resolve(ROOT, 'src/data/deeplinks.json'))) {
  const a = readFileSync(resolve(ROOT, 'src/data/deeplinks.json'), 'utf8');
  const b = resolve(ROOT, 'static/links.json');
  if (!existsSync(b) || readFileSync(b, 'utf8') !== a) fail('static/links.json 与注册表不同步（跑 npm run gen:links）');
}
const legacy = [];
// readme 里会说明「旧名已废弃」，属于正常文档；只扫代码与配置
for (const f of ['src/universe.js', 'src/main.js', 'src/index.html', 'src/i18n.js', 'src/nav.js', 'src/systems/galaxy.js', 'vite.base.js']) {
  const s = readFileSync(resolve(ROOT, f), 'utf8');
  // 只拦真正的页面引用；docs/screenshots/overview.png 这类历史截图文件名不算
  if (/overview\.html|\/overview(?=[`?)\s"']|$)/.test(s)) legacy.push(f);
}
if (legacy.length) fail(`仍引用旧的 overview 页面: ${legacy.join(', ')}`);

rmSync(TMP, { recursive: true, force: true });

if (errors.length) {
  console.error(`天体直达外链校验失败，共 ${errors.length} 项：`);
  for (const e of errors) console.error('  [!] ' + e);
  process.exit(1);
}
console.log(`天体直达外链校验通过：${DATA.bodies.length} 个天体 / ${DATA.pages.length} 个页面，key / 裸 ID 唯一，URL 契约与真实配置一致。`);
