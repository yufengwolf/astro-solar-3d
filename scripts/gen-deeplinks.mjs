/**
 * 生成「天体级直达外链」注册表与可复制清单。
 *
 * 跑的是生产配置本身：把 src/systems/*.js 的图片 import 换成占位符后由 Node 直接
 * import，读取每个 system 的 bodies（含 galaxy.js 里展开后的深空天体 / 邻近恒星），
 * 因此新增天体不需要手工维护链接表。
 *
 * 产物：
 *   src/data/deeplinks.js    运行时注册表（ESM，Vite 与 Node 都能直接 import）
 *   src/data/deeplinks.json  同一份数据的 JSON 版，供工具 / 审阅
 *   static/links.json        对外公开的机器可读清单（Vite publicDir → dist）
 *   static/links.html        可搜索、一键复制的外链工具页（同上）
 *
 * 清单分三层，缺一不可：
 *   pages[] 9 个 3D 页面本身（「介绍太阳系 / 银河系」这类整页外链）
 *   nodes[] 全部宇宙层级节点，数量由 NODES 动态展开（银河系、本星系群、
 *           仙女座、可观测宇宙，以及银河系页下钻的 AU 级恒星系统…）
 *   bodies[] 全部天体（数量由 src/systems/*.js 动态展开，打开即聚焦）
 * 以前只有 bodies，于是「银河系」这种页面级目标根本查不到链接。
 *
 * 用法：npm run gen:links（prebuild / predev 会自动跑）
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NODES, LEVELS, DETAILS, resolveCurrentId } from '../src/universe.js';
import { LG_GALAXIES } from '../src/data/galaxies.js';
import { TWO_MRS_GROUPS } from '../src/data/2mrs.js';
import { HCBG_MEMBERS } from '../src/data/deep/registry.js';
import { cosmicVec } from '../src/data/cosmic-structures.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const SRC = resolve(ROOT, 'src');
const TMP = resolve(SRC, '.gen-tmp');
const DATA = resolve(SRC, 'data');
const STATIC = resolve(ROOT, 'static');

/** system 配置文件 → 对外页面文件名 */
const PAGES = {
  'solar.js': 'solar.html',
  'earth-moon.js': 'earth-moon.html',
  'mars.js': 'mars.html',
  'jupiter.js': 'jupiter.html',
  'saturn.js': 'saturn.html',
  'uranus.js': 'uranus.html',
  'neptune.js': 'neptune.html',
  'pluto.js': 'pluto.html',
  'galaxy.js': 'galaxy.html',
};

/** 太阳系总览 4 档取景的建议档位（只作清单元数据，不参与深链跳转） */
const SOLAR_VIEW = {
  sun: 'inner', mercury: 'inner', venus: 'inner', earth: 'inner', mars: 'inner',
  encke: 'inner', tempelTuttle: 'inner',
  ceres: 'planets', jupiter: 'planets', saturn: 'planets', uranus: 'planets',
  neptune: 'planets', halley: 'planets', tempel1: 'planets', churyumov: 'planets',
  pluto: 'kuiper', haumea: 'kuiper', makemake: 'kuiper', eris: 'all',
};

// 与 check-scale.mjs 相同的 Node 加载桩：图片 import / 星空 import 换成占位符
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

const bodies = [];
const pages = [];
for (const [file, page] of Object.entries(PAGES)) {
  const sys = (await import(pathToFileURL(resolve(TMP, file)).href)).default;
  const pageKey = page.replace(/\.html$/, '');
  // 页面级直达：整页外链（介绍「太阳系」「银河系」时用），并给出对应的层级节点 ID
  pages.push({
    key: pageKey, file: page, name: sys.label, count: 0,
    url: page,
    goUrl: `go.html?page=${encodeURIComponent(pageKey)}`,
    nodeId: resolveCurrentId('', '/' + page),
  });

  const push = (b, extra = {}) => {
    bodies.push({
      id: b.id,
      name: b.name,
      page,
      pageKey,
      pageName: sys.label,
      tier: b.tier ?? null,
      view: sys.id === 'solar' ? (SOLAR_VIEW[b.id] ?? 'all') : null,
      ...extra,
    });
    pages[pages.length - 1].count++;
  };
  for (const b of sys.bodies) push(b);
  // 太阳不在 solar.bodies 里（main.js 单独建 sunMesh），但它是外链里最常用的一条
  if (sys.hasSun) push({ id: 'sun', name: '太阳' }, { synthetic: true });
}

// 跨页同名（jupiter / mars / earth / sun ...）：裸 ID 归太阳系总览，
// 其余页面必须用 `页面:ID` 形式消歧。
const counts = new Map();
for (const b of bodies) counts.set(b.id, (counts.get(b.id) ?? 0) + 1);
for (const b of bodies) {
  b.key = `${b.pageKey}:${b.id}`;
  b.short = counts.get(b.id) === 1 || b.page === 'solar.html' ? b.id : null;
  const token = encodeURIComponent(b.short ?? b.key);
  b.url = `${b.page}?body=${token}`;
  b.goUrl = `go.html?body=${token}`;
  delete b.pageKey;
}

// 宇宙层级节点：注册表里每一个节点都必须有一条稳定外链。
// 银河系 / 太阳系 / 各卫星系统映射到专用 3D 页，其余走 cosmos.html?node=。
const nodes = NODES.map((n) => {
  const file = n.url.split('?')[0];
  return {
    id: n.id,
    name: n.zh,
    en: n.en,
    kind: n.kind,
    kindName: LEVELS[n.kind]?.[0] ?? n.kind,
    detail: n.detail,
    detailName: DETAILS[n.detail]?.[0] ?? n.detail,
    page: file,
    url: n.url,
    goUrl: `go.html?node=${encodeURIComponent(n.id)}`,
    scale: n.scaleZh,
    spanLy: n.spanLy,
    parent: n.parent ?? null,
    // 有天体级清单的页面（3D 页）可以直接一并给出该页的天体数，便于工具页提示
    bodies: bodies.filter((b) => b.page === file).length,
  };
});

const payload = {
  version: 2,
  note: '由 scripts/gen-deeplinks.mjs 生成，勿手工编辑。body 参数为全局唯一短名或 页面:ID；node 参数为宇宙层级节点 ID；page 参数为 3D 页面键名。动态成员用 node+body 组合，详见 members[]。',
  pages,
  nodes,
  bodies,
};

// ── 动态成员：每个都能被一条 URL 直达 ──────────────────────────────────
// 这三层（pages/nodes/bodies）会被 main.js 静态 import，不能塞进几千条
// 星表成员——否则 9 个入口的 bundle 全部膨胀。members[] 只写进公开清单
// static/links.{json,html}：go.html 的 node+body 组合无需查表，裸 ID 入口
// 才按需 fetch links.json。cosmos.js 的兜底保证每条 URL 真的能聚焦。
const nodeById = new Map(NODES.map((n) => [n.id, n]));
const nodeIds = new Set(nodeById.keys());
const memberHosts = NODES
  .filter((n) => ['supercluster', 'cluster', 'group'].includes(n.kind)
    && !['localgroup', 'hcbg', 'universe'].includes(n.id))
  .map((n) => ({ id: n.id, name: n.zh, c: cosmicVec(n.id) }))
  .filter((h) => h.c);

const members = [];
const memberIds = new Set();
const addMember = (m) => {
  if (memberIds.has(m.id) || nodeIds.has(m.id)) return;
  memberIds.add(m.id);
  m.url = `cosmos.html?node=${encodeURIComponent(m.node)}&body=${encodeURIComponent(m.id)}`;
  m.goUrl = `go.html?node=${encodeURIComponent(m.node)}&body=${encodeURIComponent(m.id)}`;
  // go.html 可只记一个 ID：lg- 走规则，2mrs-/grb- 按需查 links.json
  m.shortGoUrl = `go.html?body=${encodeURIComponent(m.id)}`;
  members.push(m);
};

// 本星系群矮星系（90 个真实坐标成员，扣掉 5 个已有独立 3D 页的主星系）。
// 统一 lg- 前缀：fornax / hercules / antlia 同时是上层星系团节点 ID，
// 裸 ID 会发生真实冲突（实测 go.html?body=fornax 落到天炉座星系团页）。
// 这里只看 major 标记，不能用 nodeIds.has()——那会把这 3 个矮星系漏掉。
for (const g of LG_GALAXIES) {
  if (g.major) continue;
  addMember({
    id: `lg-${g.id}`, nativeId: g.id, name: g.zh, en: g.en,
    kind: 'lg', kindName: '本星系群成员', node: 'localgroup',
    nodeName: nodeById.get('localgroup')?.zh ?? '本星系群',
    source: 'galaxies.js 实测坐标',
  });
}

// 2MRS 星系群（Lambert et al. 2020，3022 个）。规范落地页取三维距离最近
// 的超星系团 / 星系团 / 星系群节点；真实坐标由 cosmicVec 派生，不是示意摆放。
for (const g of TWO_MRS_GROUPS) {
  let host = null, best = Infinity;
  for (const h of memberHosts) {
    const d = Math.hypot(g.pos[0] - h.c[0], g.pos[1] - h.c[1], g.pos[2] - h.c[2]);
    if (d < best) { best = d; host = h; }
  }
  if (!host) continue;
  const alias = g.alias ? ` · ${g.alias}` : '';
  const rich = g.m200 >= 50;
  addMember({
    id: `2mrs-${g.id}`, nativeId: String(g.id),
    name: `${rich ? '2MRS 星系团' : '2MRS 星系群'} ${g.id}${alias}`,
    en: `${rich ? '2MRS cluster' : '2MRS group'} ${g.id}${alias}`,
    kind: '2mrs', kindName: rich ? '2MRS 星系团' : '2MRS 星系群',
    node: host.id, nodeName: host.name,
    source: '2MRS · Lambert et al. 2020',
  });
}

// HCBG 高红移 GRB（Horváth et al. 2015，357 个），统一落在长城页。
for (const g of HCBG_MEMBERS) {
  addMember({
    id: `grb-${g.id}`, nativeId: String(g.id),
    name: `伽马射线暴 ${g.id}`, en: `GRB ${g.id}`,
    kind: 'grb', kindName: '高红移伽马射线暴', node: 'hcbg',
    nodeName: nodeById.get('hcbg')?.zh ?? '武仙－北冕座长城',
    source: 'HCBG · Horváth et al. 2015',
  });
}

const json = JSON.stringify(payload, null, 2) + '\n';
const publicPayload = { ...payload, members };

mkdirSync(DATA, { recursive: true });
mkdirSync(STATIC, { recursive: true });
writeFileSync(resolve(DATA, 'deeplinks.js'), `// 自动生成，勿手工编辑。来源：scripts/gen-deeplinks.mjs\nexport default ${json};\n`, 'utf8');
writeFileSync(resolve(DATA, 'deeplinks.json'), json, 'utf8');
writeFileSync(resolve(STATIC, 'links.json'), JSON.stringify(publicPayload, null, 2) + '\n', 'utf8');
writeFileSync(
  resolve(STATIC, 'links.html'),
  readFileSync(resolve(here, 'links-template.html'), 'utf8')
    .replace('/*__LINKS_DATA__*/', JSON.stringify(publicPayload)),
  'utf8',
);

rmSync(TMP, { recursive: true, force: true });
const byKind = { lg: 0, '2mrs': 0, grb: 0 };
for (const m of members) byKind[m.kind]++;
console.log(`深链清单已生成：${bodies.length} 个天体 / ${pages.length} 个 3D 页面 / ${nodes.length} 个层级节点 / `
  + `${members.length} 个动态成员（LG ${byKind.lg} · 2MRS ${byKind['2mrs']} · GRB ${byKind.grb}）`
  + ' → src/data/deeplinks.json、static/links.{json,html}');
