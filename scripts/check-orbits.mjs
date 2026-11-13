/**
 * 恒星系统「真实层级 + 真实互绕」自检。
 *
 * 跑的是生产代码与生产数据：
 *   1. 递归校验每个系统的层级树：每对六根数、质量、来源、开普勒自洽、
 *      层级间距比、成员数（三合 / 四合 / 六合）；
 *   2. 用 orbit-tree.js 展开成 system.bodies，检查 ID 唯一、parent 链、
 *      每对质心分解 / ω 反相 / 共相位、按深度统一的显示压缩；
 *   3. 用 pairStateAt() 在多个时刻验证 m1·r1 + m2·r2 = 0、近远星距、
 *      开普勒第二定律；再用 Three.js 真矩阵核对 orbitalOffset() 与渲染
 *      变换链严格一致（保证子层轨道面不被父层带着转）；
 *   4. 检查注册表 / cosmos 委托 / 渲染层 / 下钻入口 / i18n / 样式；
 *   5. 检查深链清单已包含全部系统节点；
 *   6. 逐个系统跑生产工厂，并验证 ?scale=real 关掉压缩。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import {
  STELLAR_SYSTEMS, SYSTEM_BY_NODE, SYSTEM_BY_BODY,
  systemSpanLy, systemColor, nodeMass, countStars, walkPairs,
  AU_IN_LY, DAYS_PER_YEAR,
} from '../src/data/stellar-orbits.js';
import {
  expandSystem, pairStateAt, barycentricSplit, solveKepler,
  meanAnomalyAt, normalizeAngle, periodText, julianYearFromDate,
  orbitalOffset, orbitPoint,
} from '../src/orbit-tree.js';
import { NODES, byId, parentHref } from '../src/universe.js';
import DATA from '../src/data/deeplinks.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const CJK = /[\u4e00-\u9fff]/;
const TAU = 2 * Math.PI;
const NOW = 2026.87;   // 固定时刻，让自检结果可复现

// ---------------------------------------------------------------- 1. 数据层：递归校验层级树
assert.ok(STELLAR_SYSTEMS.length >= 11, `系统数量不足: ${STELLAR_SYSTEMS.length}`);
const keys = new Set();
const nodeIds = new Set();
let totalPairs = 0;
let totalStars = 0;
for (const s of STELLAR_SYSTEMS) {
  assert.ok(!keys.has(s.key), `系统 key 重复: ${s.key}`);
  keys.add(s.key);
  assert.ok(!nodeIds.has(s.nodeId), `节点 id 重复: ${s.nodeId}`);
  nodeIds.add(s.nodeId);
  for (const k of ['zh', 'en', 'briefZh', 'briefEn', 'sourceZh', 'sourceEn']) {
    const min = k.startsWith('brief') || k.startsWith('source') ? 10 : 2;
    assert.ok(typeof s[k] === 'string' && s[k].length > min, `${s.key} 缺少 ${k}`);
  }
  assert.ok(!CJK.test(s.en), `${s.key} 英文名混入中文`);
  assert.ok(!CJK.test(s.briefEn), `${s.key} 英文简介混入中文`);
  assert.ok(!CJK.test(s.sourceEn), `${s.key} 英文来源混入中文`);
  assert.ok(s.distanceLy > 0 && Number.isFinite(s.distanceLy), `${s.key} 距离异常`);
  assert.ok(s.levelRatio > 0 && s.levelRatio < 1, `${s.key} levelRatio 越界`);
  assert.ok(Number.isFinite(systemColor(s)), `${s.key} 主色异常`);
  assert.ok(systemSpanLy(s) > 0 && systemSpanLy(s) < 1e5, `${s.key} spanLy 异常`);
  assert.ok(s.bodies?.length > 0, `${s.key} 没有银河系下钻入口`);
  assert.equal(SYSTEM_BY_NODE.get(s.nodeId), s, `${s.key} 节点索引缺失`);
  for (const id of s.bodies) {
    assert.equal(SYSTEM_BY_BODY.get(id), s, `${s.key} 下钻映射缺 ${id}`);
  }

  // 成员数必须与宣称的「几合星」一致
  assert.equal(countStars(s.tree), s.multiplicity,
    `${s.key} 宣称 ${s.multiplicity} 合星，树里实际 ${countStars(s.tree)} 颗`);

  let pairCount = 0;
  walkPairs(s.tree, (p, depth, path) => {
    pairCount++;
    totalPairs++;
    const tag = `${s.key}:${path.join('.') || 'root'}`;
    for (const k of ['aAu', 'e', 'periodDays', 'inc', 'node', 'argPeri', 'epochYear']) {
      assert.ok(Number.isFinite(p[k]), `${tag}.${k} 不是有限数`);
    }
    assert.ok(p.aAu > 0 && p.periodDays > 0, `${tag} 半长轴/周期必须为正`);
    assert.ok(p.e >= 0 && p.e < 0.95, `${tag} 偏心率越界: ${p.e}`);
    assert.ok(['published', 'derived', 'schematic'].includes(p.quality), `${tag} quality 未登记`);
    assert.ok(typeof p.zh === 'string' && typeof p.en === 'string' && p.zh && p.en, `${tag} 缺层级名`);
    assert.ok(!CJK.test(p.en), `${tag} 英文层级名混入中文`);
    assert.ok(p.sourceZh?.length > 20 && p.sourceEn?.length > 20, `${tag} 缺来源`);
    assert.ok(!CJK.test(p.sourceEn), `${tag} 英文来源混入中文`);

    const m1 = nodeMass(p.a), m2 = nodeMass(p.b);
    assert.ok(m1 > 0 && m2 > 0, `${tag} 成员质量必须为正`);
    const pYears = p.periodDays / DAYS_PER_YEAR;
    const massFromKepler = (p.aAu ** 3) / (pYears * pYears);
    const ratio = massFromKepler / (m1 + m2);
    assert.ok(ratio > 0.6 && ratio < 1.7,
      `${tag} 开普勒第三定律不自洽：a³/P²=${massFromKepler.toFixed(3)} M☉，总质量 ${(m1 + m2).toFixed(3)} M☉`);

    // 层级系统成立的前提：外层轨道远大于内层轨道
    for (const child of [p.a, p.b]) {
      if (child.kind === 'pair') {
        const sep = p.aAu / child.aAu;
        assert.ok(sep >= 3,
          `${tag} 与子层间距比仅 ${sep.toFixed(2)}，层级二体近似不成立`);
      }
    }
  });

  // 叶子（恒星）字段
  const leaves = [];
  const collect = (n) => {
    if (n.kind === 'pair') { collect(n.a); collect(n.b); }
    else leaves.push(n);
  };
  collect(s.tree);
  totalStars += leaves.length;
  for (const l of leaves) {
    assert.ok(l.mass > 0 && l.radius > 0, `${s.key}/${l.zh} 质量/半径异常`);
    assert.ok(Number.isFinite(l.color), `${s.key}/${l.zh} 颜色异常`);
    for (const k of ['zh', 'en', 'spectral', 'typeZh', 'typeEn']) {
      assert.ok(typeof l[k] === 'string' && l[k].length > 0, `${s.key}/${l.zh} 缺 ${k}`);
    }
    assert.ok(!CJK.test(l.en), `${s.key}/${l.zh} 英文名混入中文`);
    assert.ok(!CJK.test(l.typeEn), `${s.key}/${l.zh} 英文类型混入中文`);
    if (l.noteEn) assert.ok(!CJK.test(l.noteEn), `${s.key}/${l.zh} 英文备注混入中文`);
  }
  assert.equal(s.tree.kind, 'pair', `${s.key} 根节点必须是 pair`);
  assert.equal(pairCount >= 1, true, `${s.key} 没有任何轨道层`);
}
const multi = STELLAR_SYSTEMS.filter((s) => s.multiplicity > 2);
assert.ok(multi.length >= 6, `多层级系统太少: ${multi.length}`);
assert.ok(STELLAR_SYSTEMS.some((s) => s.multiplicity === 6), '缺六合星系统');
assert.ok(STELLAR_SYSTEMS.some((s) => s.multiplicity === 4), '缺四合星系统');
console.log(`[1/6] 数据层：${STELLAR_SYSTEMS.length} 个系统 / ${totalPairs} 个轨道层 / ${totalStars} 颗恒星，成员数、六根数、开普勒自洽、层级间距比通过`);

// ---------------------------------------------------------------- 2. 展开层：递归 bodies
for (const s of STELLAR_SYSTEMS) {
  const tree = expandSystem(s, { nowYear: NOW, lang: 'zh-CN' });
  const pairCount = tree.pairs.length;
  const extras = s.extras?.length ?? 0;
  assert.equal(tree.bodies.length, pairCount + s.multiplicity + extras,
    `${s.key} bodies 数应为 ${pairCount} 质心 + ${s.multiplicity} 恒星 + ${extras} 额外天体`);
  assert.equal(tree.starCount, s.multiplicity, `${s.key} starCount 不符`);
  const ids = new Set(tree.bodies.map((b) => b.id));
  assert.equal(ids.size, tree.bodies.length, `${s.key} 天体 ID 重复`);
  const byBodyId = new Map(tree.bodies.map((b) => [b.id, b]));

  const cm = tree.bodies.find((b) => b.id === tree.cmId);
  assert.ok(cm?.barycenter, `${s.key} 根质心缺失`);
  assert.equal(cm.orbit, undefined, `${s.key} 根质心不应带轨道`);
  assert.ok(!cm.parent, `${s.key} 根质心不应有 parent`);

  for (const b of tree.bodies) {
    if (b.id === tree.cmId) continue;
    assert.ok(b.parent && byBodyId.has(b.parent), `${s.key}/${b.id} parent 链断裂`);
    assert.equal(b.inertialParent, true,
      `${s.key}/${b.id} 必须走惯性子框架，否则轨道面会继承父层 Ω/i/ω`);
    assert.ok(!('radiusSun' in b),
      `${s.key}/${b.id} 不能带 radiusSun，否则会误触发银河系页 9R 特写`);
  }

  // 每一对：质心分解、共轨道要素、ω 反相
  for (const p of tree.pairs) {
    const a = byBodyId.get(p.a), b = byBodyId.get(p.b);
    const c = byBodyId.get(p.cm);
    assert.ok(a?.orbit && b?.orbit && c, `${s.key}/${p.key} 成员或质心缺失`);
    assert.equal(a.parent, p.cm, `${s.key}/${p.key} 主成员未挂到本层质心`);
    assert.equal(b.parent, p.cm, `${s.key}/${p.key} 伴成员未挂到本层质心`);
    for (const k of ['e', 'periodDays', 'M0', 'node', 'inc', 'displayScale']) {
      assert.equal(a.orbit[k], b.orbit[k], `${s.key}/${p.key} ${k} 必须一致`);
    }
    assert.ok(Math.abs(((a.orbit.argPeri - b.orbit.argPeri) % 360 + 360) % 360 - 180) < 1e-9,
      `${s.key}/${p.key} 近星点角必须相差 180°`);
    const split = barycentricSplit(p.aRel, p.m1, p.m2);
    assert.ok(Math.abs(a.orbit.aAU - split.a1) < 1e-12, `${s.key}/${p.key} a1 ≠ a·m2/M`);
    assert.ok(Math.abs(b.orbit.aAU - split.a2) < 1e-12, `${s.key}/${p.key} a2 ≠ a·m1/M`);
    assert.ok(Math.abs(a.orbit.aAU + b.orbit.aAU - p.aRel) < 1e-12,
      `${s.key}/${p.key} 两条轨道之和应为相对半长轴`);
    assert.equal(p.displayScale, a.orbit.displayScale, `${s.key}/${p.key} 显示系数不一致`);
  }

  // 同一深度的所有层画成同样大小（显示半长轴 = 物理 a × 该层系数），
  // 层内两条轨道共享系数，因此质量比 / 偏心率 / 近远星距仍然真实。
  const byDepth = new Map();
  for (const p of tree.pairs) {
    const shownAU = p.displayScale * p.aRel;
    if (!byDepth.has(p.depth)) byDepth.set(p.depth, shownAU);
    assert.ok(Math.abs(shownAU - byDepth.get(p.depth)) < 1e-9,
      `${s.key} 深度 ${p.depth} 的显示尺度不统一`);
  }
  if (tree.levels.length > 1) assert.ok(tree.maxCompression > 1, `${s.key} 多层系统应有压缩`);
  assert.ok(tree.timeScale > 0 && tree.timeScaleMax >= 200, `${s.key} 时间倍率异常`);
  assert.deepEqual([...tree.levels].map((l) => l.periodDays),
    [...tree.levels].map((l) => l.periodDays).sort((a, b) => a - b),
    `${s.key} 时间档未按周期排序`);

  // 严格线性模式：所有显示系数必须为 1
  const real = expandSystem(s, { nowYear: NOW, lang: 'zh-CN', compress: false });
  for (const b of real.bodies) {
    if (b.orbit) assert.equal(b.orbit.displayScale, 1, `${s.key} real 模式仍有压缩`);
  }

  // 英文信息卡不得残留中文（光谱型是国际记号，允许原样）
  const enTree = expandSystem(s, { nowYear: NOW, lang: 'en' });
  for (const body of enTree.bodies) {
    for (const [k, v] of Object.entries(body.info ?? {})) {
      if (k === '光谱型') continue;
      assert.ok(!CJK.test(String(v)), `${s.key}/${body.id} 英文信息卡 ${k} 混入中文: ${v}`);
    }
  }
  // 信息卡必须写清所属层级与压缩，避免把压缩后的图误认成真实比例
  for (const b of tree.bodies) {
    assert.ok(b.info?.['所属层级'] != null, `${s.key}/${b.id} 缺所属层级`);
    assert.ok(b.info?.['层级压缩'] != null, `${s.key}/${b.id} 缺层级压缩说明`);
  }
}
console.log('[2/6] 展开层：ID 唯一 / parent 链 / 惯性标记 / 逐对质心分解 / ω 反相 / 按深度压缩 / 严格线性开关 / 英文信息卡通过');

// ---------------------------------------------------------------- 3. 物理层：逐对 + Three 矩阵一致性
for (const s of STELLAR_SYSTEMS) {
  const tree = expandSystem(s, { nowYear: NOW, lang: 'zh-CN' });
  for (const p of tree.pairs) {
    const el = { aRel: p.aRel, e: p.e, periodDays: p.periodDays, M0: p.M0, m1: p.m1, m2: p.m2 };
    for (let i = 0; i < 64; i++) {
      const t = (i / 64) * p.periodDays;
      const st = pairStateAt(el, t);
      assert.ok(st.ok, `${s.key}/${p.key} t=${t.toFixed(1)}d 质心漂移 ${st.barycentre}`);
      assert.ok(st.separation >= p.aRel * (1 - p.e) - 1e-9 &&
        st.separation <= p.aRel * (1 + p.e) + 1e-9,
        `${s.key}/${p.key} 两成员间距越出椭圆范围`);
    }
    const tNear = (normalizeAngle(-p.M0) / TAU) * p.periodDays;
    const near = pairStateAt(el, tNear);
    const far = pairStateAt(el, tNear + p.periodDays / 2);
    assert.ok(Math.abs(near.separation - p.aRel * (1 - p.e)) < p.aRel * 0.001,
      `${s.key}/${p.key} 近星距不等于 a(1−e)`);
    assert.ok(Math.abs(far.separation - p.aRel * (1 + p.e)) < p.aRel * 0.001,
      `${s.key}/${p.key} 远星距不等于 a(1+e)`);
    if (p.e > 0.05) {
      const fast = 1 / (1 - p.e * Math.cos(solveKepler(0, p.e)));
      const slow = 1 / (1 - p.e * Math.cos(solveKepler(Math.PI, p.e)));
      assert.ok(fast > slow * 1.1, `${s.key}/${p.key} 近星点速度未快于远星点`);
    }
    assert.ok(p.M0 >= 0 && p.M0 < TAU, `${s.key}/${p.key} M0 未归一`);
  }
}

// orbitalOffset() 必须与 createBody 的 Three 变换链 Ry(Ω)·Rx(i)·Ry(ω) 完全一致，
// 否则自检验证的层级几何与浏览器里真实画出来的不是一回事。
{
  const DEG = Math.PI / 180;
  for (const orbit of [
    { node: 0, inc: 0, argPeri: 0 },
    { node: 45.4, inc: 136.336, argPeri: 149.161 },
    { node: 205.073, inc: 79.243, argPeri: 231.519 },
    { node: 132.66, inc: 83.66, argPeri: 130.02 },
  ]) {
    const group = new THREE.Group();
    const plane = new THREE.Group();
    group.rotation.y = orbit.node * DEG;
    plane.rotation.x = orbit.inc * DEG;
    plane.rotation.y = orbit.argPeri * DEG;
    group.add(plane);
    const mesh = new THREE.Object3D();
    plane.add(mesh);
    const p = orbitPoint(3.7, 0.42, solveKepler(1.1, 0.42));
    mesh.position.set(p.x, 0, p.z);
    group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    mesh.getWorldPosition(v);
    const want = orbitalOffset(orbit, p);
    assert.ok(Math.hypot(v.x - want.x, v.y - want.y, v.z - want.z) < 1e-9,
      `orbitalOffset 与 Three 变换链不一致: ${JSON.stringify(orbit)}`);
  }
}
assert.ok(Math.abs(solveKepler(0, 0.6) - 0) < 1e-9, '开普勒方程 M=0 解错');
assert.ok(Math.abs(solveKepler(Math.PI, 0.6) - Math.PI) < 1e-9, '开普勒方程 M=π 解错');
assert.ok(julianYearFromDate(new Date('2000-01-01T12:00:00Z')) > 1999.99);
assert.match(periodText(41.08, 'en'), /days/);
assert.match(periodText(5000, 'zh-CN'), /年/);
console.log(`[3/6] 物理层：${totalPairs} 对 × 64 时刻质心守恒 / 近远星距 / 开普勒第二定律 + Three 变换链一致性通过`);

// ---------------------------------------------------------------- 4. 注册表 + 深链
for (const s of STELLAR_SYSTEMS) {
  const node = byId(s.nodeId);
  assert.ok(node, `${s.nodeId} 未注册到宇宙层级树`);
  assert.equal(node.parent, 'milkyway', `${s.nodeId} 应挂在银河系下`);
  assert.equal(node.kind, 'system');
  assert.equal(node.detail, 'full');
  assert.equal(node.url, `cosmos.html?node=${s.nodeId}`, `${s.nodeId} url 不对`);
  assert.equal(node.dLy, s.distanceLy);
  assert.ok(Math.abs(node.spanLy - systemSpanLy(s)) < 1e-15);
  assert.ok(parentHref(s.nodeId)?.startsWith('galaxy.html'), `${s.nodeId} 上浮应回银河系页`);
  const link = DATA.nodes.find((n) => n.id === s.nodeId);
  assert.ok(link, `深链清单缺节点 ${s.nodeId}`);
  assert.equal(link.url, node.url);
}
assert.ok(NODES.length >= 39, `层级节点数异常: ${NODES.length}`);
const galaxyIds = new Set(DATA.bodies.filter((b) => b.page === 'galaxy.html').map((b) => b.id));
for (const id of SYSTEM_BY_BODY.keys()) {
  assert.ok(galaxyIds.has(id), `下钻入口 ${id} 不在银河系页天体里，按钮永远不出现`);
}
console.log(`[4/6] 注册表：${STELLAR_SYSTEMS.length} 个系统节点已挂到银河系、深链清单同步（共 ${NODES.length} 节点），${SYSTEM_BY_BODY.size} 个下钻入口全部命中`);

// ---------------------------------------------------------------- 5. 渲染层接线
const bodies = read('src/bodies.js');
assert.ok(bodies.includes('plane.rotation.y = def.orbit.argPeri * DEG'),
  'bodies.js 缺少 ω 近星点角支持，互绕无法精确反相');
const scale = read('src/scale.js');
assert.ok(scale.includes('def.orbit.displayScale ?? 1') && scale.includes('displayAU(def)'),
  'scale.js 未接每层显示系数');
const main = read('src/main.js');
for (const needle of [
  'system.barycentric', 'system.starfield', 'timeScaleMax',
  'clockPaused', 'orbitPositions', 'orbitClock',
  'inertialChildren', 'node.childFrame', 'childFrame.updateMatrixWorld(true)',
  'orbitClockMultiplicity', 'orbitClockLevel', 'orbitClockScaleTitle',
  'isEnglishLang', 'periodTextOf',
  'universeHref(def.stellarSystem ?? def.id)',
  'universeHref(e.def.stellarSystem ?? e.def.id)',
  "if (b.barycenter) return 'barycenter';",
  "if (b.bodyKind === 'blackhole') return 'blackhole';",
]) {
  assert.ok(main.includes(needle), `main.js 缺少接线: ${needle}`);
}
const cosmos = read('src/systems/cosmos.js');
assert.ok(cosmos.includes('isStellarSystemNode(nodeId)') &&
  cosmos.includes('makeStellarSystem(nodeId, { background: starfield })'),
  'cosmos.js 未委托到恒星系统工厂');
const galaxy = read('src/systems/galaxy.js');
assert.ok(galaxy.includes('withStellarDrilldown') &&
  galaxy.includes('SYSTEM_BY_BODY') &&
  galaxy.includes('s.multiplicity > 2'),
  'galaxy.js 未挂按成员数标注的下钻入口');
const universe = read('src/universe.js');
assert.ok(universe.includes('systemColor') && universe.includes('s.tree.aAu'),
  'universe.js 仍引用重构后已移除的旧顶层字段');
const i18n = read('src/i18n.js');
for (const needle of [
  "'轨道数据': 'Orbit data'", "'双星成员': 'Binary members'", 'orbitClockPeriod',
  'orbitClockMultiplicity', 'orbitClockLevelTitle', "'层级压缩': 'Inter-level compression'",
  "'所属层级': 'Hierarchy level'", "'成员质量': 'Component masses'",
]) {
  assert.ok(i18n.includes(needle), `i18n.js 缺少 ${needle}`);
}
const css = read('src/style.css');
for (const needle of ['.orbit-clock', '.bn-item.type-barycenter', '.oc-multi', '.oc-level.active', '.oc-scale']) {
  assert.ok(css.includes(needle), `style.css 缺少 ${needle}`);
}
console.log('[5/6] 渲染层：惯性子框架、显示压缩、层级时间档、比例开关、下钻、i18n、样式全部接好');

// ---------------------------------------------------------------- 6. 生产工厂逐系统启动
globalThis.location = { pathname: '/cosmos.html', search: '?node=sys_sirius' };
const { makeStellarSystem } = await import('../src/stellar-system.js');
for (const s of STELLAR_SYSTEMS) {
  globalThis.location = { pathname: '/cosmos.html', search: `?node=${s.nodeId}` };
  const sys = makeStellarSystem(s.nodeId, { background: null });
  assert.equal(sys.hasSun, false);
  assert.equal(sys.barycentric, true);
  assert.equal(sys.starfield, true);
  assert.equal(sys.scale.distancePower, 1, '轨道距离必须严格线性，否则质量比看不出来');
  assert.equal(sys.scale.minPerihelionUnits, 0, '不得为了好看压缩真实偏心率');
  assert.equal(sys.bodies.length, sys.orbitPairs.length + s.multiplicity + (s.extras?.length ?? 0));
  assert.equal(sys.orbitPairs.length >= 1, true);
  assert.equal(sys.orbitClock.multiplicity, s.multiplicity);
  assert.equal(sys.orbitClock.starCount, s.multiplicity);
  assert.equal(sys.orbitClock.levels.length >= 1, true);
  if (s.multiplicity > 2) {
    assert.ok(sys.orbitClock.levelCount >= 2, `${s.key} 多层级系统应有多个时间档`);
    assert.equal(sys.orbitClock.compressed, true, `${s.key} 默认应启用跨层压缩`);
    assert.ok(sys.orbitClock.maxCompression > 1);
  }
}
// ?scale=real 必须真的关掉压缩
globalThis.location = { pathname: '/cosmos.html', search: '?node=sys_castor&scale=real' };
const realSys = makeStellarSystem('sys_castor', { background: null });
assert.equal(realSys.orbitClock.realScale, true);
assert.equal(realSys.orbitClock.compressed, false);
for (const b of realSys.bodies) {
  if (b.orbit) assert.equal(b.orbit.displayScale, 1, '?scale=real 仍有压缩');
}
console.log('[6/6] 生产工厂：逐个系统可直接产出可渲染配置，?scale=real 关掉全部压缩');

console.log(`\n恒星系统自检通过：${STELLAR_SYSTEMS.length} 系统 / ${totalPairs} 层 / ${totalStars} 颗星，真实层级 + 逐层质心互绕 + 惯性框架 + 跨层压缩全部成立。`);
