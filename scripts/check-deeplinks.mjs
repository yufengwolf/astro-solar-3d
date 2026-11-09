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
import { NODES, resolveCurrentId } from '../src/universe.js';
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

// ---- 页面级 / 宇宙层级节点级外链 ----
// 曾经的缺口：清单只有 bodies，于是「银河系」这种整页 / 层级目标查不到链接。
if (DATA.version !== 2) fail(`清单版本应为 2（含 pages/nodes/bodies 三层），实际 ${DATA.version}`);
if (!Array.isArray(DATA.nodes)) fail('清单缺少 nodes[]（宇宙层级节点直达）');
const nodeById = new Map((DATA.nodes ?? []).map((n) => [n.id, n]));
if ((DATA.nodes ?? []).length !== NODES.length) {
  fail(`层级节点数量不符：清单 ${DATA.nodes?.length ?? 0} / 注册表 ${NODES.length}`);
}
for (const p of DATA.pages) {
  if (p.url !== p.file) fail(`页面 ${p.key} 的整页链接错误: ${p.url}`);
  if (p.goUrl !== `go.html?page=${encodeURIComponent(p.key)}`) fail(`页面 ${p.key} 的万能链接错误: ${p.goUrl}`);
  const realNode = resolveCurrentId('', '/' + p.file);
  if (p.nodeId !== realNode) fail(`页面 ${p.key} 的层级节点应为 ${realNode}，实际 ${p.nodeId}`);
}
for (const n of NODES) {
  const e = nodeById.get(n.id);
  if (!e) { fail(`注册表节点 ${n.id} 没进外链清单（跑 npm run gen:links）`); continue; }
  if (e.url !== n.url) fail(`节点 ${n.id} 的链接应为 ${n.url}，实际 ${e.url}`);
  if (e.page !== n.url.split('?')[0]) fail(`节点 ${n.id} 的 page 字段错误: ${e.page}`);
  if (e.goUrl !== `go.html?node=${encodeURIComponent(n.id)}`) fail(`节点 ${n.id} 的万能链接错误: ${e.goUrl}`);
  if (e.name !== n.zh || e.en !== n.en) fail(`节点 ${n.id} 的中英名与注册表不一致`);
  if (e.parent !== (n.parent ?? null)) fail(`节点 ${n.id} 的 parent 不一致`);
  if (!existsSync(resolve(SRC, e.page))) fail(`节点 ${n.id} 指向的页面不存在: src/${e.page}`);
}
const mw = nodeById.get('milkyway');
if (!mw || mw.url !== 'galaxy.html') fail('银河系节点没有直达 galaxy.html');
if (!DATA.pages.some((p) => p.key === 'galaxy' && p.url === 'galaxy.html')) fail('银河系页面级外链缺失');
if (!nodeById.has('universe') || !nodeById.has('andromeda')) fail('可观测宇宙 / 仙女座星系缺少外链');

const goSrc = readFileSync(resolve(SRC, 'entries/go.js'), 'utf8');
for (const needle of ["p.get('node')", "p.get('page')", 'href(node)', 'allPages()']) {
  if (!goSrc.includes(needle)) fail(`go.js 未支持 node/page 跳转，缺少: ${needle}`);
}
const tpl = readFileSync(resolve(here, 'links-template.html'), 'utf8');
for (const needle of ['DATA.nodes', 'DATA.pages', '3D 页面直达', '宇宙层级节点直达']) {
  if (!tpl.includes(needle)) fail(`links-template.html 缺少三层清单渲染: ${needle}`);
}
if (existsSync(resolve(ROOT, 'static/links.html'))) {
  const built = readFileSync(resolve(ROOT, 'static/links.html'), 'utf8');
  if (!built.includes('3D 页面直达') || !built.includes('宇宙层级节点直达')) {
    fail('static/links.html 未包含页面级 / 层级节点级清单（跑 npm run gen:links）');
  }
  if (!built.includes('"id":"milkyway"')) fail('static/links.html 里找不到银河系节点数据');
}

// ---- 真实执行生成的 links.html 脚本，确认三层清单都渲染得出来 ----
// 用最小 DOM 桩在 Node 里跑一遍工具页脚本，能抓到「数据有、页面却没渲染」这类回归。
{
  const built = readFileSync(resolve(ROOT, 'static/links.html'), 'utf8');
  const code = built.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!code) fail('static/links.html 里找不到工具页脚本');
  else {
    const prevDoc = globalThis.document, prevLoc = globalThis.location;
    let rows = 0, sections = 0;
    const mk = (tag) => ({
      tagName: tag, children: [], dataset: {}, style: {}, value: '', textContent: '', _html: '',
      classList: { add() {}, remove() {}, toggle() {} },
      set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
      appendChild(c) { this.children.push(c); return c; },
      querySelector(s) { return s === 'tbody' ? (this._tb ??= mk('tbody')) : mk('div'); },
      querySelectorAll() { return []; },
      addEventListener() {},
    });
    const list = mk('div');
    const ids = { base: mk('span'), page: mk('select'), list, count: mk('span'), q: mk('input') };
    const append = list.appendChild.bind(list);
    list.appendChild = (c) => { if (c.tagName === 'section') sections++; return append(c); };
    globalThis.document = {
      getElementById: (id) => ids[id] ?? mk('div'),
      createElement: (tag) => { if (tag === 'tr') rows++; return mk(tag); },
      addEventListener() {}, querySelectorAll() { return []; }, body: mk('body'),
    };
    globalThis.location = { href: 'https://example.test/links.html', search: '' };
    try {
      await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
      const want = DATA.pages.length + DATA.nodes.length + DATA.bodies.length;
      const wantSections = 2 + DATA.pages.filter((p) => DATA.bodies.some((b) => b.page === p.file)).length;
      if (rows !== want) fail(`links.html 渲染出 ${rows} 行，应为 ${want}（页面+节点+天体）`);
      if (sections !== wantSections) fail(`links.html 渲染出 ${sections} 个分组，应为 ${wantSections}`);
    } catch (e) {
      fail(`links.html 脚本执行失败: ${e.message}`);
    } finally {
      globalThis.document = prevDoc;
      if (prevLoc === undefined) delete globalThis.location;
      else globalThis.location = prevLoc;
    }
  }
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
console.log(`外链校验通过：${DATA.bodies.length} 个天体 / ${DATA.pages.length} 个 3D 页面 / ${DATA.nodes.length} 个层级节点，`
  + 'key / 裸 ID 唯一，页面级与节点级链接与注册表一致。');
