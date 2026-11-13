/**
 * 恒星真实尺度 / 内容驱动缩放阶梯自检。
 *
 *  1) 真实执行 src/star-portrait.js（Node 里用最小 canvas 桩）：贴图、球体结构；
 *  2) 单位换算与角尺寸显隐：R☉ → 光年 → 场景单位，球径就是真实半径，
 *     「大尺度只能是点」「一帧最多一颗球」由物理尺度自动成立；
 *  3) 用 galaxy.js 的**真实 6 档相机距离 + 真实恒星坐标**验证前 5 档零球；
 *  4) 固定倍率的连续缩放：太阳 / 心宿二 / 参宿四在 1/10/100 光年都能停，
 *     缩放不被「周围有没有邻居」影响（三维背景由 check-backdrop 验证）；
 *  5) 静态断言生产配置与 main.js 接线，禁止旧示意球 API 残留。
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const SRC = resolve(ROOT, 'src');
const TMP = resolve(SRC, '.check-stars-tmp');

// ---- 最小 canvas 桩：让程序化贴图在 Node 里也能真实跑一遍 ----
globalThis.document = {
  createElement: (tag) => {
    if (tag !== 'canvas') return { style: {} };
    return {
      width: 0, height: 0,
      getContext: () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        putImageData: () => {},
        createRadialGradient: () => ({ addColorStop() {} }),
        fillRect: () => {},
        fillStyle: null,
      }),
    };
  },
};

const SP = await import('../src/star-portrait.js');
const {
  LY_M, SUN_RADIUS_M, SUN_RADIUS_LY, UNITS_PER_LY,
  CLOSEUP_FACTOR, REVEAL_FACTOR, FULL_FACTOR, MAX_PORTRAIT_SPAN_LY,
  starRadiusLy, starRadiusUnits, closeupDistanceLy, revealDistanceLy,
  portraitRadius, effectiveSpanLy, tierAllowsPortrait, starWithinPortrait,
  portraitOpacity, selectStarPortrait,
  createStarPortrait,
} = SP;
const { continuousZoom, DEFAULT_ZOOM_RATIO } = await import('../src/backdrop.js');

// ---- 1. 单位换算：球径必须是真实物理半径 ----
assert.ok(Math.abs(UNITS_PER_LY - 1 / 3261.56) < 1e-12, '光年 → 场景单位换算错误');
assert.ok(Math.abs(SUN_RADIUS_LY * LY_M - SUN_RADIUS_M) < 1, '1 太阳半径的米/光年换算不一致');
assert.ok(SUN_RADIUS_LY > 7.3e-8 && SUN_RADIUS_LY < 7.4e-8, 'R☉ 应约 7.35e-8 光年');
const rSunLy = starRadiusLy(1);
const rBigLy = starRadiusLy(764);
const rSmallLy = starRadiusLy(0.154);
assert.ok(Math.abs(rSunLy - SUN_RADIUS_LY) < 1e-18);
assert.ok(rBigLy > rSunLy * 700 && rSmallLy < rSunLy * 0.2,
  '球径必须线性表达真实半径，不做对数压缩 / 示意封顶');
assert.ok(Math.abs(starRadiusUnits(1) - rSunLy * UNITS_PER_LY) < 1e-24);
assert.equal(starRadiusUnits(764), portraitRadius(764, Infinity, UNITS_PER_LY),
  '球径不得随相机距离或档位缩放（除防钻进球内的保险）');
assert.ok(Math.abs(closeupDistanceLy(1) - CLOSEUP_FACTOR * rSunLy) < 1e-20);
assert.ok(Math.abs(revealDistanceLy(1) - REVEAL_FACTOR * rSunLy) < 1e-20);
assert.ok(closeupDistanceLy(1) < revealDistanceLy(1));
// 「只有小于 1 光年的尺度上才可能存在球体」——由真实半径自动成立
assert.ok(REVEAL_FACTOR * rBigLy < MAX_PORTRAIT_SPAN_LY,
  '最大的恒星（764 R☉）显形距离也必须远小于 1 光年');
// 球直径远小于最近恒星对间距，物理上不可能两颗球互相穿插
assert.ok(REVEAL_FACTOR * rBigLy * 2 < 0.21,
  '显形范围必须小于最近的恒星对间距 0.21 光年');
assert.ok(effectiveSpanLy(closeupDistanceLy(764), 45) < MAX_PORTRAIT_SPAN_LY,
  '特写视野跨度必须小于 1 光年');

// ---- 2. 角尺寸驱动显隐 ----
assert.equal(tierAllowsPortrait(1e5), false);
assert.equal(tierAllowsPortrait(1.01), false);
assert.equal(tierAllowsPortrait(1), true);
assert.equal(tierAllowsPortrait(NaN), false);
assert.equal(starWithinPortrait(REVEAL_FACTOR * rSunLy * 1.01, rSunLy), false);
assert.equal(starWithinPortrait(REVEAL_FACTOR * rSunLy, rSunLy), true);
assert.equal(starWithinPortrait(4.24, rSunLy), false, '几光年外必须是点');
assert.equal(portraitOpacity(4.24, rSunLy), 0);
assert.equal(portraitOpacity(REVEAL_FACTOR * rSunLy, rSunLy), 0);
assert.equal(portraitOpacity(FULL_FACTOR * rSunLy, rSunLy), 1);
assert.equal(portraitOpacity(closeupDistanceLy(1), rSunLy), 1, '特写距离必须完全显形');
assert.ok(portraitOpacity(30 * rSunLy, rSunLy) > 0 && portraitOpacity(30 * rSunLy, rSunLy) < 1);
assert.equal(portraitOpacity(NaN, rSunLy), 0);
assert.equal(portraitOpacity(-1, rSunLy), 0);
assert.equal(portraitOpacity(1, 0), 0);
// 唯一性：真实半径下角尺寸最大的那一颗胜出
const many = Array.from({ length: 19 }, (_, i) => ({
  id: `star${i}`, dLy: (9 + i) * rSunLy, radiusLy: rSunLy, visible: true,
}));
assert.equal(selectStarPortrait(many, 1e-6), 'star0');
assert.equal(selectStarPortrait(many, 1e5), null, '大视野必须零球');
assert.equal(selectStarPortrait([{ id: 'x', dLy: 9 * rSunLy, radiusLy: rSunLy, visible: true }], 1.0001), null);
assert.equal(selectStarPortrait([{ id: 'hidden', dLy: 9 * rSunLy, radiusLy: rSunLy, visible: false }], 1e-6), null);
assert.equal(selectStarPortrait([], 1e-6), null);
assert.equal(selectStarPortrait([{ id: 'far', dLy: 4.24, radiusLy: rSunLy, visible: true }], 1e-6), null);

// ---- 3. 真实构建一颗恒星特写 ----
const p = createStarPortrait({ id: 'proxima', color: 0xff8a6a, radiusSun: 0.154, size: 0.07 });
assert.equal(p.group.visible, false, '近景球默认必须隐藏');
assert.equal(p.group.children.length, 3, '应包含光球 + 色球亮环 + 日冕');
assert.ok(p.sphere.isMesh && p.sphere.geometry.type === 'SphereGeometry');
assert.ok(p.sphere.material.map, '光球必须有程序化米粒组织贴图');
assert.equal(p.sphere.material.toneMapped, false);
assert.equal(p.sphere.userData.bodyId, 'proxima');
p.group.scale.setScalar(starRadiusUnits(0.154));
assert.ok(Number.isFinite(p.group.scale.x) && p.group.scale.x > 0);

// ---- 4. 生产配置：恒星 / 星团 / 黑洞的分类必须自洽 ----
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
const galaxyMod = await import(pathToFileURL(resolve(TMP, 'galaxy.js')).href);
const { LY_PER_KPC, SCALE_TIERS } = galaxyMod;
const galaxy = galaxyMod.default;
rmSync(TMP, { recursive: true, force: true });

assert.ok(Math.abs(UNITS_PER_LY - 1 / LY_PER_KPC) < 1e-12,
  'zoom-ladder.js 的换算必须与 galaxy.js 的 LY_PER_KPC 一致');
const main = readFileSync(resolve(SRC, 'main.js'), 'utf8');
assert.ok(main.includes('def.star && !def.deepSky && Number.isFinite(def.radiusSun)'),
  'main.js 必须只给带真实半径的恒星挂近景球，否则 cosmos 页的星系锚点会被画成恒星');
// pointOnly = 只有坐标与名字的点天体（脉冲星 / 白矮星 / 聚星成员等）。
// 它们刻意不带 radiusSun，绝不能混进「真实半径近景球」的校验集合。
const stars = galaxy.bodies.filter((b) => b.star && !b.deepSky && !b.pointOnly);
const pointBodies = galaxy.bodies.filter((b) => b.pointOnly);
const showpieces = galaxy.bodies.filter((b) => b.deepSky);
assert.ok(stars.length >= 19, `恒星近景球覆盖不足：只有 ${stars.length} 颗`);
for (const b of stars) {
  assert.ok(Number.isFinite(b.radiusSun) && b.radiusSun > 0, `恒星 ${b.id} 缺少真实半径`);
  assert.equal(b.fixedSize, 0.07, `恒星 ${b.id} 在银河系尺度上仍必须是一个 0.07 的点`);
}
for (const b of showpieces) {
  assert.ok(['nebula', 'remnant', 'blackhole', 'cluster'].includes(b.deepSky.kind),
    `${b.id} 的展示物类型未知`);
}
assert.ok(showpieces.some((b) => b.deepSky.kind === 'cluster'));
assert.ok(showpieces.some((b) => b.id === 'sagA' && b.deepSky.kind === 'blackhole'));
assert.equal(stars.find((b) => b.id === 'sun')?.radiusSun, 1);

// ---- 4b. 点天体：值不值钱只看坐标准不准，与半径大小无关 ----
const { POINT_STARS } = await import('../src/data/star-points.js');
// POINT_STARS 里带真实半径的恒星（pointKind='star' 且有 radiusKm）现在会挂
// 9R 近景球，标记 pointOnly=false，不再属于「纯点天体」。断言对象改为
// 「POINT_STARS 全量展开」+「纯点子集仍然够多」，与 galaxy.js 的现行设计一致。
const allPointStars = galaxy.bodies.filter((b) => b.pointKind);
assert.equal(allPointStars.length, POINT_STARS.length, '生产配置必须完整展开 POINT_STARS');
assert.ok(pointBodies.length >= 40, `点天体覆盖不足：只有 ${pointBodies.length} 个`);
assert.ok(allPointStars.length > pointBodies.length,
  '带真实半径的恒星应升级为近景球，不能全都退化成纯点');
const ids = new Set(galaxy.bodies.map((b) => b.id));
assert.equal(ids.size, galaxy.bodies.length, '天体 id 不得重复');
for (const b of pointBodies) {
  assert.equal(b.pointOnly, true, `${b.id} 必须标记为点天体`);
  assert.equal(b.radiusSun, undefined, `${b.id} 不得带 radiusSun（否则会被拖进 9R 特写）`);
  assert.equal(b.deepSky, undefined, `${b.id} 不得带 deepSky 展示物`);
  assert.equal(b.fixedSize, 0.07, `${b.id} 在银河系尺度上必须仍是一个 0.07 的点`);
  assert.ok(Number.isFinite(b.dLy) && b.dLy > 0, `${b.id} 缺少真实距离`);
  assert.ok(Array.isArray(b.galaxyPos) && b.galaxyPos.every(Number.isFinite),
    `${b.id} 的银道坐标换算结果无效`);
  assert.ok(b.tier >= 0 && b.tier < SCALE_TIERS.length, `${b.id} 档位越界`);
  assert.ok(b.nameEn && b.info?.['坐标来源'], `${b.id} 缺少英文名或坐标来源`);
  assert.ok(!b.info?.['银道坐标']?.includes('NaN'), `${b.id} 银道坐标含 NaN`);
}
// 10 km 脉冲星、白矮星、聚星成员都必须真的在表里
for (const must of ['crab_pulsar', 'vela_pulsar', 'sgr_1806_20', 'sirius_b',
  'procyon_b', 'alphacen_a', 'capella_aa', 'castor_a1', 'epsilon_lyrae_a1']) {
  assert.ok(ids.has(must), `缺少应收录的点天体 ${must}`);
}
assert.equal(pointBodies.find((b) => b.id === 'crab_pulsar')?.info?.['半径'], '约 10 km',
  '10 km 脉冲星的半径必须如实展示，且不得参与任何几何计算');
// 交互已改为「点击只做定位、不按距离自动切档」（setPointFocus 已移除），
// 这条断言随当前设计更新，防止旧自动切档逻辑回流。
assert.ok(!main.includes('function setPointFocus'), 'main.js 又退回了按距离自动切档的旧逻辑');
assert.ok(main.includes('def.pointOnly'), 'main.js 缺少点天体分支');
assert.ok(main.includes('def.pointOnly'), 'main.js 缺少点天体分支');
assert.ok(main.includes('POINT_MIN_LY'), 'main.js 缺少点天体的连续缩放下限');

// ---- 5. 真实几何：6 档相机距离 × 真实恒星坐标，前 5 档必须零球 ----
const camDistOf = (tier) => tier.radiusKpc / Math.tan((45 * Math.PI) / 360) * 1.25; // kpc
const dir = (() => { const v = [0, 0.62, 1], n = Math.hypot(...v); return v.map((x) => x / n); })();
const starDefs = stars.filter((b) => Array.isArray(b.galaxyPos));
function candidatesAt(center, distKpc) {
  const cam = center.map((c, j) => c + dir[j] * distKpc);
  return starDefs.map((b) => ({
    id: b.id,
    dLy: Math.hypot(...b.galaxyPos.map((v, j) => v - cam[j])) * LY_PER_KPC,
    radiusLy: starRadiusLy(b.radiusSun),
    visible: true,
  }));
}
let widest = '';
for (let i = 0; i < SCALE_TIERS.length - 1; i++) {
  const tier = SCALE_TIERS[i];
  for (const zoom of [1, 0.5, 0.08]) {
    const distKpc = camDistOf(tier) * zoom;
    const span = effectiveSpanLy(distKpc * LY_PER_KPC, 45);
    assert.equal(selectStarPortrait(candidatesAt(galaxy.sunPos, distKpc), span), null,
      `${tier.label} 缩到 ${zoom}× 时出现了球体（会互相重叠）`);
  }
  widest += `${tier.short} `;
}

// ---- 6. 连续缩放：固定倍率、与内容无关，1 / 10 / 100 光年都能停 ----
function neighborsOf(id) {
  const me = galaxy.bodies.find((b) => b.id === id);
  assert.ok(me?.galaxyPos, `缺少 ${id} 的坐标`);
  return galaxy.bodies
    .filter((b) => b.id !== id && Array.isArray(b.galaxyPos))
    .map((b) => Math.hypot(...b.galaxyPos.map((v, i) => v - me.galaxyPos[i])) * LY_PER_KPC)
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);
}
assert.equal(neighborsOf('antares').filter((d) => d < 100).length, 0,
  '心宿二 100 光年内确实没有邻居 —— 背景靠三维视锥里更远的天体，不靠邻居');
assert.ok(neighborsOf('sun').some((d) => d > 1 && d < 10), '太阳附近有近邻');

function zoomWalk(radiusSun) {
  const minLy = closeupDistanceLy(radiusSun) * 0.45;
  const seq = [];
  let d = minLy;
  for (let i = 0; i < 60; i++) {
    const next = continuousZoom(d, 100, { minLy, maxLy: 1e5 });
    assert.ok(next >= d, '往外缩必须单调');
    if (next > d) assert.ok(
      next >= 1e5 * 0.999 || Math.abs(next / d - DEFAULT_ZOOM_RATIO) < 1e-9,
      '每格都是同一个固定倍率，不许按邻居距离跳档（最外一格允许钳到全景）');
    d = next;
    seq.push(d);
  }
  assert.ok(seq.at(-1) >= 1e5 * 0.99, '应能连续缩回 10 万光年全景');
  return seq;
}
let sunBands = 0;
for (const id of ['sun', 'antares', 'betelgeuse', 'proxima']) {
  const def = galaxy.bodies.find((b) => b.id === id);
  const seq = zoomWalk(def.radiusSun);
  for (const target of [1, 10, 100]) {
    assert.ok(seq.some((v) => v >= target && v <= target * DEFAULT_ZOOM_RATIO),
      `${id} 在 ${target} 光年这一档必须能停留，不许被跳过`);
    if (id === 'sun') sunBands++;
  }
  // 球显隐只由 d/R 决定，与「这一档有没有邻居」无关
  const r = starRadiusLy(def.radiusSun);
  assert.equal(selectStarPortrait(
    [{ id, dLy: closeupDistanceLy(def.radiusSun), radiusLy: r, visible: true }], 1e-6), id);
  assert.equal(selectStarPortrait(
    [{ id, dLy: revealDistanceLy(def.radiusSun) * 1.01, radiusLy: r, visible: true }], 1e-6),
  null, '缩过 60R 后球必须淡成一个点');
}
assert.equal(sunBands, 3);
assert.equal(continuousZoom(7.3, 100, { minLy: 1e-9, maxLy: 1e5, neighbors: [4.24, 550] }),
  continuousZoom(7.3, 100, { minLy: 1e-9, maxLy: 1e5 }), '缩放不得被天体内容影响');

// ---- 7. main.js 接线 ----
for (const needle of [
  "from './star-portrait.js'", "from './backdrop.js'",
  'createStarPortrait(def)', 'updateStarPortraits(dtSec)',
  'setStarCloseup(def, obj)', 'buildBackdrops(def, obj)',
  'continuousZoom(dLy, e.deltaY', 'updateBackdropVisibility()',
  'applyFocusAnchorScale()', 'pointWorldSize(D, camera.fov, H, 1)',
  'effectiveSpanLy(dCamLy, camera.fov)', 'starRadiusUnits(def.radiusSun)',
  'closeupDistanceLy(def.radiusSun)', 'visibleBodies:', 'closeup: closeup',
  'distantVisible:', 'backdropDir:', 'zoomMode:',
]) {
  assert.ok(main.includes(needle), `main.js 缺少真实尺度 / 三维背景接线: ${needle}`);
}
for (const banned of [
  'PORTRAIT_CLOSEUP_LY', 'PORTRAIT_MAX_RADIUS_LY', 'tierFactorOf', 'starSizeFactor',
  'tierCamDist(currentTier) * 0.45', 'portraitOpacity(c.dLy)',
  'selectStarPortrait(_portraitCandidates, TIERS[currentTier].spanLy)',
  'zoomStops(', 'nextZoomStop(', 'focusStops', 'distanceTo(origin)',
]) {
  assert.ok(!main.includes(banned), `main.js 仍残留旧的示意尺度 / 自动跳档判定: ${banned}`);
}
const updateAt = main.indexOf('controls.update();');
const portraitAt = main.indexOf('updateStarPortraits(dtSec);', updateAt + 1);
assert.ok(updateAt > 0 && portraitAt > updateAt && portraitAt - updateAt < 140,
  '近景 LOD 必须紧跟在 controls.update() 之后执行');
const portraitSrc = readFileSync(resolve(SRC, 'star-portrait.js'), 'utf8');
assert.ok(portraitSrc.includes("export * from './zoom-ladder.js'"),
  '尺度数学必须集中在 zoom-ladder.js');

console.log(`恒星真实尺度校验通过：${stars.length} 颗恒星球 / ${showpieces.length} 个非恒星展示物；`
  + `R☉=${SUN_RADIUS_LY.toExponential(3)} ly，特写 ${CLOSEUP_FACTOR}R；`
  + `「${widest.trim()}」各档（含缩到 minDistance）零球；`
  + `连续缩放每格 ×${DEFAULT_ZOOM_RATIO}，太阳 / 心宿二 / 参宿四 / 比邻星`
  + ` 1~100 ly 均可停留（背景内容由 check:backdrop 验证）。`);
