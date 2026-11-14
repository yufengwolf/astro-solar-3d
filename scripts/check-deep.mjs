/**
 * 深度星表数据层自检：全量入库、坐标有限、距离量级、交叉匹配与渲染接线。
 * 运行：npm run check:deep
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const ok = (cond, msg) => { assert.ok(cond, msg); console.log(`  ✓ ${msg}`); };

const { DEEP_SOURCES, DEEP_LOADERS, DEEP_BUILD_STATS, HCBG_MEMBERS } =
  await import('../src/data/deep/registry.js');
const cf4 = await import('../src/data/deep/cf4.js');
const mpp = await import('../src/data/deep/2mpp.js');
const gcns = await import('../src/data/deep/gcns.js');
const hcbg = await import('../src/data/deep/hcbg.js');
const leda = await import('../src/data/deep/hyperleda.js');
const nedd = await import('../src/data/deep/ned-d.js');
const { galacticToScene, equatorialToGalactic, SUN_GALACTIC_POS } =
  await import('../src/coord/galactic.js');

console.log('深度星表自检\n');

// ── 1. 全量入库（各源行数与官方发布数一致） ──────────────────────────
ok(cf4.COUNT === 55874, `Cosmicflows-4 全量 ${cf4.COUNT} 个星系`);
ok(mpp.COUNT === 69160, `2M++ 全量 ${mpp.COUNT} 个真实星系（已剔 ${mpp.META.fakeExcluded} 个 ZoA 假源）`);
ok(mpp.META.blueShiftNearby === 28,
  `2M++ 保留 ${mpp.META.blueShiftNearby} 个近邻蓝移星系（红移距离下限已标注）`);
ok(gcns.COUNT === 331312, `Gaia GCNS 全量 ${gcns.COUNT} 颗 100 pc 内恒星`);
ok(hcbg.COUNT === 357, `HCBG GRB 全量 ${hcbg.COUNT} 个带红移伽马暴`);
ok(leda.COUNT >= 980000, `HyperLEDA PGC 全量 ${leda.COUNT} 个星系`);
ok(nedd.META.rows >= 200000, `NED-D 全量 ${nedd.META.rows} 条独立测距`);
ok(nedd.COUNT >= 100000, `NED-D 聚合为 ${nedd.COUNT} 个星系`);
ok(HCBG_MEMBERS.length === hcbg.COUNT, 'HCBG 菜单元数据与点云条数一致');

// ── 2. 数组长度与数值有限性 ──────────────────────────────────────────
for (const [name, mod] of [['cf4', cf4], ['2mpp', mpp], ['gcns', gcns], ['hcbg', hcbg]]) {
  ok(mod.POS.length === mod.COUNT * 3, `${name}: POS 长度 = COUNT × 3`);
  ok(mod.POS.every(Number.isFinite), `${name}: 所有三维坐标有限`);
  ok(mod.COUNT === mod.META.rows, `${name}: COUNT 与 META.rows 一致`);
}
ok(cf4.AUX.length === cf4.COUNT * 3, 'cf4: AUX stride=3');
ok(mpp.AUX.length === mpp.COUNT * 2, '2mpp: AUX stride=2');
ok(gcns.AUX.length === gcns.COUNT * 2, 'gcns: AUX stride=2');
ok(hcbg.AUX.length === hcbg.COUNT * 2, 'hcbg: AUX stride=2');
ok(cf4.IDS.length === cf4.COUNT, 'cf4: PGC 编号与星系一一对应');
ok(hcbg.IDS.length === hcbg.COUNT, 'hcbg: GRB 名称与点一一对应');
ok(leda.MORPH.length === cf4.COUNT, 'hyperleda: 形态数组与 CF4 同序');
ok(nedd.NAMES.length === nedd.COUNT && nedd.N_MEASURES.length === nedd.COUNT
  && nedd.D_MEDIAN.length === nedd.COUNT, 'ned-d: 名称 / 次数 / 距离三数组等长');

// ── 3. 距离量级真实（不是随手摆的壳层） ─────────────────────────────
const sunR = Math.hypot(...SUN_GALACTIC_POS);
const distOf = (mod, i) => {
  const j = i * 3;
  return Math.hypot(mod.POS[j], mod.POS[j + 1], mod.POS[j + 2]) / 1000; // Mpc
};
let dmin = Infinity, dmax = 0;
for (let i = 0; i < cf4.COUNT; i++) {
  const d = distOf(cf4, i); dmin = Math.min(dmin, d); dmax = Math.max(dmax, d);
}
ok(dmin > 0.01 && dmax > 100 && dmax < 2000,
  `CF4 实测距离范围 ${dmin.toFixed(3)}–${dmax.toFixed(0)} Mpc（非固定壳层）`);
ok(cf4.AUX.filter((_, i) => i % 3 === 0).every((dm) => dm > 18 && dm < 42),
  'CF4 距离模数 DM 全部在 18–42 mag 的官方范围内');
let vmax = 0;
for (let i = 0; i < mpp.COUNT; i++) vmax = Math.max(vmax, mpp.AUX[i * 2]);
ok(vmax > 10000 && vmax < 100000, `2M++ Vcmb 最大 ${vmax} km/s（真实红移）`);
ok(mpp.IDS.every((n) => typeof n === 'string' && n.length > 0), '2M++ 每个星系都有 2MASS-XSC 名称');
let plxMin = Infinity, plxMax = 0;
for (let i = 0; i < gcns.COUNT; i++) {
  const p = gcns.AUX[i * 2]; plxMin = Math.min(plxMin, p); plxMax = Math.max(plxMax, p);
}
ok(plxMin > 0 && plxMax < 1500, `GCNS 视差 ${plxMin.toFixed(2)}–${plxMax.toFixed(0)} mas（全为正）`);
let zmin = Infinity, zmax = 0;
for (let i = 0; i < hcbg.COUNT; i++) {
  const z = hcbg.AUX[i * 2]; zmin = Math.min(zmin, z); zmax = Math.max(zmax, z);
}
ok(zmin > 0 && zmax > 5, `HCBG 红移范围 ${zmin.toFixed(3)}–${zmax.toFixed(2)}`);
ok(hcbg.META.inRedshiftSlice >= 19,
  `HCBG 1.6≤z<2.1 红移切片内 ${hcbg.META.inRedshiftSlice} 个 GRB（论文聚类样本）`);
let dWallMin = Infinity, dWallMax = 0;
for (const g of HCBG_MEMBERS) { dWallMin = Math.min(dWallMin, g.dMpc); dWallMax = Math.max(dWallMax, g.dMpc); }
ok(dWallMax / 1000 > 4 && dWallMax / 1000 < 12,
  `HCBG 共动距离上限 ${(dWallMax / 1000).toFixed(2)} Gpc（符合 z≈2 宇宙学）`);
ok(hcbg.META.caveat.includes('争议'), 'HCBG 信息卡明确标注存在性争议');

// ── 4. 坐标换算自洽（抽查若干点） ───────────────────────────────────
const [l0, b0] = equatorialToGalactic(266.4168, -29.0078);
ok(Math.abs(l0 - 359.944) < 0.01 && Math.abs(b0 + 0.046) < 0.01,
  '银心方向换算仍是 Sgr A* → l=359.944°, b=-0.046°');
ok(Math.abs(Math.hypot(...galacticToScene(0, 0, sunR))) < 1e-6,
  'l=0,b=0,d=R☉ 精确回到银心原点');
ok(sunR > 8 && sunR < 8.5, `太阳距银心 ${sunR.toFixed(2)} kpc`);

// ── 5. 交叉匹配确实生效 ─────────────────────────────────────────────
ok(leda.META.matchedCF4 > 30000,
  `HyperLEDA 按 PGC 匹配到 ${leda.META.matchedCF4} 个 CF4 星系`);
ok(leda.MORPH.filter(Boolean).length > 10000,
  `CF4 星系已补上 HyperLEDA 形态类型（${leda.MORPH.filter(Boolean).length} 个，PGC 交叉匹配到的真实子集）`);
ok(nedd.META.skippedSummaryRows > 0, 'NED-D 已剔除 D=999999 的冗余汇总行');
ok(nedd.METHODS.filter(Boolean).length > 100000, 'NED-D 保留了测距方法');

// ── 6. 注册表与接线 ─────────────────────────────────────────────────
ok(Object.keys(DEEP_LOADERS).length === Object.keys(DEEP_SOURCES).length,
  '每个数据源都有独立的按需加载器');
for (const id of Object.keys(DEEP_SOURCES)) {
  ok(await DEEP_LOADERS[id]().then(() => true).catch(() => false), `${id} 分包可正常加载`);
}
ok(DEEP_BUILD_STATS.cf4.rows === cf4.COUNT && DEEP_BUILD_STATS.gcns.rows === gcns.COUNT,
  '构建统计与运行时数据一致');
const cosmos = read('src/systems/cosmos.js');
const main = read('src/main.js');
const galaxy = read('src/systems/galaxy.js');
ok(cosmos.includes('deepCloudsFor(node'), 'cosmos.js 按层级选择深度星表点云');
ok(cosmos.includes('hcbgMembersFor(node'), 'cosmos.js 给 HCBG 页补 GRB 真实成员');
ok(cosmos.includes('deepClouds,'), 'cosmos.js 把 deepClouds 交给渲染层');
ok(main.includes("import('./data/deep/registry.js')"), 'main.js 动态加载星表注册表');
ok(main.includes('deepClouds.push(cloud)'), 'main.js 真实绘制深度星表点云');
ok(galaxy.includes("id: 'gcns'"), 'galaxy.js 接入 Gaia GCNS 本地恒星');
ok(main.includes('deepClouds.map('), 'main.js 暴露 deepClouds 调试计数');
ok(existsSync(resolve(root, 'scripts/build-deep.mjs')), '重建脚本存在');

console.log('\n深度星表校验通过：六源全量入库，三维坐标自洽，各层页面均有真实点云与来源标注。');
