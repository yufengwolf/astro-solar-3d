/**
 * 宇宙层级注册表自检。
 *
 * 纯 Node 运行，不加载 Three.js / DOM，因此可以在任何构建前快速跑一遍：
 * 保证新增星系时不会留下孤儿节点、坏链接、缺翻译或尺度倒挂。
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  NODES, ROOT_ID, LEVELS, DETAILS, byId, childrenOf, chainOf, tree,
  href, parentHref, childHref, resolveCurrentId, anchorPointSize,
} from '../src/universe.js';
import { PORTRAITS, hasPortrait } from '../src/portraits.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..', 'src');
const errors = [];
const fail = (msg) => errors.push(msg);
const CJK = /[\u4e00-\u9fff]/;
const EN_UNIT = /\b(ly|kpc)\b/;

// ---- 结构 ----
const ids = new Set();
for (const n of NODES) {
  if (ids.has(n.id)) fail(`节点 id 重复: ${n.id}`);
  ids.add(n.id);
  for (const k of ['zh', 'en', 'scaleZh', 'scaleEn', 'briefZh', 'briefEn', 'kind', 'detail', 'url', 'color']) {
    if (n[k] == null || n[k] === '') fail(`${n.id} 缺少字段 ${k}`);
  }
  if (typeof n.spanLy !== 'number' || !Number.isFinite(n.spanLy) || n.spanLy <= 0) {
    fail(`${n.id} 的 spanLy 非法: ${n.spanLy}`);
  }
  if (typeof n.dLy !== 'number' || !Number.isFinite(n.dLy) || n.dLy < 0) {
    fail(`${n.id} 的 dLy 非法: ${n.dLy}`);
  }
  if (!Array.isArray(n.pos) || n.pos.length !== 3 || n.pos.some((v) => !Number.isFinite(v))) {
    fail(`${n.id} 的 pos 必须是三个有限数`);
  }
  if (!LEVELS[n.kind]) fail(`${n.id} 的层级类型未登记: ${n.kind}`);
  if (!DETAILS[n.detail]) fail(`${n.id} 的细化程度未登记: ${n.detail}`);

  // 中文界面不出现 ly / kpc 这类看不懂的缩写；英文界面不残留中文
  for (const k of ['zh', 'scaleZh', 'briefZh']) {
    if (n[k] && EN_UNIT.test(n[k])) fail(`${n.id}.${k} 中文里混入了英文单位: ${n[k]}`);
  }
  for (const k of ['en', 'scaleEn', 'briefEn']) {
    if (n[k] && CJK.test(n[k])) fail(`${n.id}.${k} 英文里混入了中文: ${n[k]}`);
  }
  if (n.zh && n.en && n.zh === n.en) fail(`${n.id} 中英名相同，疑似漏翻译`);

  // 页面可达性
  const [file, qs] = n.url.split('?');
  if (!existsSync(resolve(src, file))) fail(`${n.id} 指向不存在的页面: ${file}`);
  if (file === 'cosmos.html') {
    const nodeId = new URLSearchParams(qs ?? '').get('node');
    if (!nodeId || nodeId !== n.id) fail(`${n.id} 的 cosmos 链接 node 参数不匹配: ${qs}`);
  } else if (n.detail === 'planned') {
    fail(`${n.id} 标记为待细化却指向专用页 ${file}`);
  }
  if (!href(n)) fail(`${n.id} 无法生成站内链接`);
}

const roots = NODES.filter((n) => !n.parent);
if (roots.length !== 1 || roots[0].id !== ROOT_ID) fail(`根节点必须唯一且为 ${ROOT_ID}，实际: ${roots.map((r) => r.id)}`);

for (const n of NODES) {
  if (!n.parent) continue;
  const p = byId(n.parent);
  if (!p) { fail(`${n.id} 的父节点不存在: ${n.parent}`); continue; }
  if (n.spanLy >= p.spanLy) fail(`${n.id} 的尺度不小于父层 ${p.id}: ${n.spanLy} >= ${p.spanLy}`);
  const chain = chainOf(n.id);
  if (chain.length > NODES.length) fail(`${n.id} 的父链存在环`);
  if (chain[chain.length - 1].id !== n.id || chain[0].id !== ROOT_ID) {
    fail(`${n.id} 的祖先链异常: ${chain.map((c) => c.id).join(' > ')}`);
  }
}

// ---- 树完整覆盖 ----
const seen = new Set();
const walk = (entry) => {
  if (seen.has(entry.node.id)) fail(`节点在树里出现多次: ${entry.node.id}`);
  seen.add(entry.node.id);
  for (const c of entry.children) walk(c);
};
for (const r of tree()) walk(r);
if (seen.size !== NODES.length) fail(`树覆盖 ${seen.size} 个节点，注册表有 ${NODES.length} 个`);

// ---- 主链与上下级链接 ----
const mainChain = chainOf('earth-moon').map((n) => n.id).join(' > ');
const expectChain = 'universe > laniakea > virgo > localgroup > milkyway > solar > earth-moon';
if (mainChain !== expectChain) fail(`主链异常: ${mainChain}`);

for (const id of ['solar', 'milkyway', 'localgroup', 'virgo', 'laniakea', 'universe', 'andromeda']) {
  const up = parentHref(id);
  const down = childHref(id);
  if (id !== ROOT_ID && !up) fail(`${id} 缺少上一级链接`);
  if (id === ROOT_ID && up) fail(`根节点不应有上一级链接`);
  if (childrenOf(id).length && !down) fail(`${id} 有子节点却缺少下一级链接`);
}
if (parentHref('solar') !== 'galaxy.html') fail(`太阳系的上一级应指向银河系，实际: ${parentHref('solar')}`);
if (childHref('milkyway') !== 'solar.html') fail(`银河系的下一级应指向太阳系，实际: ${childHref('milkyway')}`);

// ---- 视觉尺度：成员一律是「点」，且相对大小符合真实直径 ----
// 防回归：曾经每个成员被画成 900 点的白色绒球、尺寸还被兜底成统一的
// 0.07，结果仙女座和三角座长得一模一样，也完全看不出宇宙的空旷。
for (const n of NODES) {
  const p = byId(n.parent);
  if (!p) continue;
  const v = anchorPointSize(n, p.spanLy);
  if (!(v.size > 0.02 && v.size < 0.16)) {
    fail(`${n.id} 在父级里的示意点尺寸越界（必须始终是点）: ${v.size}`);
  }
  if (v.fixedSize !== v.size) fail(`${n.id} 的 fixedSize 与 size 不一致`);
}
// applyScale() 会重写 def.size，只有 def.fixedSize 能保住这个点尺寸。
// 曾有回归：删掉 fixedSize 后每个星系被兜成 6.4 单位的大白球，被 bloom 放大成
// 几百像素的圆盘。systems/cosmos.js 依赖图片资源无法在 Node 里直接 import，
// 故用源码断言守住这条接线。
const cosmosSrc = readFileSync(resolve(src, 'systems', 'cosmos.js'), 'utf8');
if (!/fixedSize:\s*v\.fixedSize\b/.test(cosmosSrc)) {
  fail('systems/cosmos.js 必须把 anchorPointSize().fixedSize 写进锚点，否则 applyScale 会把星系画成大球');
}
// 背景点云同样守住「只画结构、不画天体团块 / 通用旋涡盘」的原则
const fieldSrc = readFileSync(resolve(src, 'cosmos-field.js'), 'utf8');
if (/perNode|isDisc|clump\(a,\s*9\d\d/.test(fieldSrc)) {
  fail('cosmos-field.js 又在给成员画大团块或通用旋涡盘');
}
const lgSpan = byId('localgroup').spanLy;
const sizeOrder = ['andromeda', 'milkyway', 'triangulum', 'lmc', 'smc'];
for (let i = 1; i < sizeOrder.length; i++) {
  const bigger = anchorPointSize(byId(sizeOrder[i - 1]), lgSpan).size;
  const smaller = anchorPointSize(byId(sizeOrder[i]), lgSpan).size;
  if (!(bigger > smaller)) {
    fail(`本星系群成员的点尺寸顺序错误：${sizeOrder[i - 1]} 应大于 ${sizeOrder[i]}`);
  }
}

// ---- 星系形态：上级页是点，星系自己的页面必须各有各的样子 ----
// 防回归：曾经把「远景别画大」误解成「所有星系都不画」，四个星系
// 共用一个点、完全没有形态；也曾经每个成员共用一张通用旋涡盘。
for (const n of NODES) {
  const isCosmosGalaxy = n.kind === 'galaxy' && n.url.startsWith('cosmos.html');
  if (isCosmosGalaxy && !hasPortrait(n.id)) fail(`${n.id} 是星系页却没有形态配置`);
  if (isCosmosGalaxy && n.detail !== 'portrait') fail(`${n.id} 应标记 detail=portrait`);
}
const signatures = new Set();
for (const [id, p] of Object.entries(PORTRAITS)) {
  if (!byId(id)) fail(`形态表里的 ${id} 不在注册表里`);
  for (const k of ['radius', 'inclination', 'arms', 'diskInner', 'armColor', 'hiiColor', 'morphZh', 'morphEn']) {
    if (p[k] == null) fail(`${id} 的形态参数缺 ${k}`);
  }
  if (EN_UNIT.test(p.morphZh ?? '')) fail(`${id}.morphZh 混入英文单位`);
  if (CJK.test(p.morphEn ?? '')) fail(`${id}.morphEn 混入中文`);
  // 「长得一样」的核心判据：倾角、臂数、主色三者不能全相同
  signatures.add([p.inclination, p.arms, p.diskInner].join('|'));
}
if (signatures.size !== Object.keys(PORTRAITS).length) {
  fail('有星系共用同一套形态参数（倾角 / 臂数 / 盘色完全一样）');
}
const mainSrc = readFileSync(resolve(src, 'main.js'), 'utf8');
if (!/buildGalaxyPortrait\(/.test(mainSrc) || !/portrait\.diskPointLayers/.test(mainSrc)) {
  fail('main.js 没有接入星系肖像或没做档位点云尺寸钳制');
}
if (!/portrait:\s*portrait\s*\?\s*node\.id\s*:\s*null/.test(cosmosSrc)) {
  fail('systems/cosmos.js 没有把肖像传给 galaxy 配置');
}
const fieldSrcShape = readFileSync(resolve(src, 'cosmos-field.js'), 'utf8');
if (!/shape\s*===\s*'flow'/.test(fieldSrcShape) || !/shape\s*===\s*'cluster'/.test(fieldSrcShape)) {
  fail('cosmos-field.js 缺少按层级类型区分的结构形状');
}

// ---- URL 反查 ----
const cases = [
  ['?node=localgroup', '/cosmos.html', 'localgroup'],
  ['?node=andromeda', '/cosmos.html', 'andromeda'],
  ['', '/cosmos.html', ROOT_ID],
  ['', '/solar.html', 'solar'],
  ['', '/galaxy.html', 'milkyway'],
  ['', '/pluto.html', 'pluto'],
  ['', '/index.html', null],
];
for (const [search, pathname, want] of cases) {
  const got = resolveCurrentId(search, pathname);
  if (got !== want) fail(`URL 反查 ${pathname}${search} 应为 ${want}，实际 ${got}`);
}

// ---- 汇总 ----
if (errors.length) {
  console.error(`宇宙层级校验失败（${errors.length} 项）：`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
const depth = Math.max(...NODES.map((n) => chainOf(n.id).length));
console.log(`宇宙层级校验通过：${NODES.length} 个节点，最大深度 ${depth} 层，${roots.length} 个根。`);
console.log(`主链：${mainChain}`);
console.log(`太阳系上浮 → ${parentHref('solar')}；银河系下钻 → ${childHref('milkyway')}；根层级 → ${href(ROOT_ID)}`);
