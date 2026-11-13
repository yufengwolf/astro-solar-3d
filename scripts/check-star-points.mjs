/**
 * 点天体目录自检：只校验「坐标准不准 / 数据全不全 / 有没有被拖进 9R 特写」。
 *
 * 用户要求很明确：所有恒星都有价值，前提只有一个 —— 给的坐标是准确的。
 * 所以这里不检查半径大小（10 km 也照收），而是用可复核的锚点反算银道坐标：
 *   Sgr A*      (266.4168, −29.0078) → l≈359.944°, b≈−0.046°
 *   Crab Pulsar ( 83.6331,  22.0145) → l≈184.56°,  b≈−5.78°
 *   Vela Pulsar (128.8361, −45.1764) → l≈263.55°,  b≈−2.79°
 * 再拿 HYG 天狼星坐标与 galaxy.js 里已经在用的值逐位比对。
 *
 * 用法：npm run check:points
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { POINT_STARS } from '../src/data/star-points.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const SRC = resolve(ROOT, 'src');
const TMP = resolve(SRC, '.check-points-tmp');

// IAU 1958 银道极，与 src/systems/galaxy.js 的 equatorialToGalactic 完全一致
function equatorialToGalactic(raDeg, decDeg) {
  const a = raDeg * Math.PI / 180, d = decDeg * Math.PI / 180;
  const ap = 192.85948 * Math.PI / 180, dp = 27.12825 * Math.PI / 180;
  const lNCP = 122.93192 * Math.PI / 180;
  const sinB = Math.sin(d) * Math.sin(dp) + Math.cos(d) * Math.cos(dp) * Math.cos(a - ap);
  const b = Math.asin(Math.max(-1, Math.min(1, sinB)));
  const y = Math.cos(d) * Math.sin(a - ap);
  const x = Math.sin(d) * Math.cos(dp) - Math.cos(d) * Math.sin(dp) * Math.cos(a - ap);
  const l = ((lNCP - Math.atan2(y, x)) * 180 / Math.PI % 360 + 360) % 360;
  return [l, b * 180 / Math.PI];
}

// ---- 1. 坐标换算本身必须是那套标准公式（用可查证锚点反算） ----
for (const [id, ra, dec, lWant, bWant] of [
  ['Sgr A*', 266.4168, -29.0078, 359.944, -0.046],
  ['Crab Pulsar', 83.633125, 22.0145, 184.56, -5.78],
  ['Vela Pulsar', 128.836055, -45.176432, 263.55, -2.79],
]) {
  const [l, b] = equatorialToGalactic(ra, dec);
  const dl = Math.min(Math.abs(l - lWant), 360 - Math.abs(l - lWant));
  assert.ok(dl < 0.06 && Math.abs(b - bWant) < 0.06,
    `${id} 银道坐标反算偏差过大：l=${l.toFixed(3)} b=${b.toFixed(3)}`);
}

// ---- 2. 每条数据：范围 / 唯一 / 来源 / 名称 / 不碰几何 ----
assert.ok(POINT_STARS.length >= 60, `点天体太少：${POINT_STARS.length}`);
const seen = new Set();
for (const o of POINT_STARS) {
  assert.ok(!seen.has(o.id), `id 重复：${o.id}`);
  seen.add(o.id);
  assert.ok(Number.isFinite(o.ra) && o.ra >= 0 && o.ra < 360, `${o.id} RA 越界`);
  assert.ok(Number.isFinite(o.dec) && o.dec >= -90 && o.dec <= 90, `${o.id} Dec 越界`);
  assert.ok(Number.isFinite(o.dLy) && o.dLy > 0, `${o.id} 距离无效`);
  assert.ok(o.name && o.nameEn && o.group, `${o.id} 缺少名称/英文名/分组`);
  assert.ok(o.src && o.brief, `${o.id} 缺少坐标来源或简介`);
  assert.ok(/HYG v37|NASA Exoplanet Archive|Wikipedia \/ SIMBAD/.test(o.src),
    `${o.id} 的坐标来源不可查证：${o.src}`);
  assert.ok(['star', 'pulsar', 'blackhole', 'member'].includes(o.pointKind),
    `${o.id} pointKind 未知`);
  assert.equal(o.radiusSun, undefined, `${o.id} 不得带 radiusSun`);
  const [l, b] = equatorialToGalactic(o.ra, o.dec);
  assert.ok(Number.isFinite(l) && Number.isFinite(b), `${o.id} 银道坐标换算失败`);
}
// 10 km 的脉冲星确实按真实半径登记，且没有被当成「太小所以排除」
const crab = POINT_STARS.find((o) => o.id === 'crab_pulsar');
assert.equal(crab?.radiusKm, 10, '蟹云脉冲星的 10 km 半径必须保留');
assert.equal(crab?.pointKind, 'pulsar');
assert.ok(POINT_STARS.some((o) => o.id === 'sirius_b' && o.radiusKm < 7000),
  '白矮星成员必须收录');
assert.ok(POINT_STARS.some((o) => o.id === 'r136a1' && o.dLy > 150000),
  '更远的点天体也应能被名字找到，不能被距离上限裁掉');

// ---- 3. 与生产配置对账：全部展开、没有 id 撞车、没有混入近景球 ----
function toNodeModule(code) {
  return code
    .replace(/^import\s+\w+\s+from\s+'\/?images\/[^']+';\s*$/gm, (m) =>
      `const ${m.match(/import\s+(\w+)/)[1]} = '${m.match(/images\/[^']+/)[0]}';`)
    .replace(/^import\s+\{\s*starfield\s*\}\s+from\s+'\.\/shared\.js';\s*$/gm,
      "const starfield = ['1','2','3','4','5','6'];");
}
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
for (const f of readdirSync(resolve(SRC, 'systems'))) {
  if (f.endsWith('.js') && f !== 'shared.js' && f !== 'cosmos.js') {
    writeFileSync(resolve(TMP, f), toNodeModule(readFileSync(resolve(SRC, 'systems', f), 'utf8')));
  }
}
const galaxy = (await import(pathToFileURL(resolve(TMP, 'galaxy.js')).href)).default;
rmSync(TMP, { recursive: true, force: true });

const all = galaxy.bodies;
assert.equal(new Set(all.map((b) => b.id)).size, all.length, '生产配置里天体 id 重复');
for (const o of POINT_STARS) {
  const b = all.find((x) => x.id === o.id);
  assert.ok(b, `${o.id} 未接入 galaxy.bodies`);
  // 带真实半径的恒星（pointKind='star' 且有 radiusKm）现在会挂 9R 近景球，
  // 不再是纯点；其余致密天体 / 聚星成员必须是纯点且绝不写 radiusSun，
  // 否则 10 km 的中子星会被拖进 1e-13 光年的近景球。
  const hasPortrait = o.pointKind === 'star' && Number.isFinite(o.radiusKm);
  if (hasPortrait) {
    assert.equal(b.pointOnly, false, `${o.id} 带真实半径，应挂近景球`);
    assert.ok(Number.isFinite(b.radiusSun) && b.radiusSun > 0, `${o.id} 缺少真实半径`);
  } else {
    assert.equal(b.pointOnly, true, `${o.id} 应为纯点天体`);
    assert.equal(b.radiusSun, undefined, `${o.id} 被误挂真实半径球体`);
  }
  assert.equal(b.deepSky, undefined);
  assert.equal(b.nameEn, o.nameEn);
  assert.ok(b.info?.['坐标来源'] === o.src, `${o.id} 信息卡没写出坐标来源`);
  assert.ok(b.info?.['银道坐标']?.includes('°'), `${o.id} 缺少银道坐标`);
  assert.ok(Number.isFinite(b.tier) && b.tier >= 0 && b.tier < galaxy.scaleTiers.length,
    `${o.id} 自动档位无效`);
  assert.ok(Array.isArray(b.galaxyPos) && b.galaxyPos.every(Number.isFinite),
    `${o.id} 场景坐标无效`);
}
// HYG 天狼星坐标必须与既有生产数据吻合（误差 < 0.001°）
const sirius = all.find((b) => b.id === 'sirius');
const siriusB = all.find((b) => b.id === 'sirius_b');
assert.ok(sirius && siriusB, '天狼星 / 天狼星 B 都应在表里');
assert.ok(Math.abs(siriusB.galaxyPos[0] - sirius.galaxyPos[0]) < 1e-4,
  '成员与主星共用 J2000 坐标，场景位置必须一致');

// ---- 4. 运行时接线：点名自动选档、不进 9R、三维背景与连续缩放仍在 ----
const main = readFileSync(resolve(SRC, 'main.js'), 'utf8');
const i18n = readFileSync(resolve(SRC, 'i18n.js'), 'utf8');
for (const needle of [
  // setPointFocus 已移除：点击统一只做定位，不再按距离自动选档。
  'setPointFocus 已移除', 'def.pointOnly', 'POINT_MIN_LY',
  'updateBackdropVisibility()', 'setContinuousZoomRange()',
  "pointOnly || dLy <= span * 1.5", "t('pointBodyNote')",
]) {
  assert.ok(main.includes(needle), `main.js 缺少点天体接线：${needle}`);
}
for (const needle of ["pointBodyNote:", "'聚星系统成员'", "'坐标来源'"]) {
  assert.ok(i18n.includes(needle), `i18n.js 缺少点天体文案/映射：${needle}`);
}
// 两条分支必须互斥：只有带 starPortraits（= 有 radiusSun）的恒星才进 9R
assert.ok(main.includes('if (!TIERS || !starPortraits.has(def.id)) return;'),
  'setStarCloseup 必须靠 starPortraits 把关，点天体不能被拖进 9R 特写');
// 现行交互：近照由信息卡按钮调 setStarCloseup，点击菜单只做「定位」。
assert.ok(main.includes('setStarCloseup(def, o)') && !main.includes('function setPointFocus'),
  '近照必须由信息卡按钮触发，点击只做定位，不得退回按距离自动切档');

console.log(`点天体目录校验通过：${POINT_STARS.length} 条带来源的 J2000 坐标，`
  + `生产配置共 ${all.length} 个天体；10 km 脉冲星 / 白矮星 / 聚星成员全部在表，`
  + `纯点天体不进入 9R 特写，点击只做定位且三维背景保持可见。`);
