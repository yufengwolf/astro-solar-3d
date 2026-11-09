/**
 * 恒星真实尺度 / 内容驱动缩放阶梯自检。
 *
 *  1) 真实执行 src/star-portrait.js（Node 里用最小 canvas 桩）：贴图、球体结构；
 *  2) 单位换算与角尺寸显隐：R☉ → 光年 → 场景单位，球径就是真实半径，
 *     「大尺度只能是点」「一帧最多一颗球」由物理尺度自动成立；
 *  3) 用 galaxy.js 的**真实 6 档相机距离 + 真实恒星坐标**验证前 5 档零球；
 *  4) 用真实恒星三维坐标生成内容阶梯：太阳在 1/10/100 光年有多档变化，
 *     心宿二 / 参宿四在这段一个停靠点都没有，直接跳到有邻居的尺度；
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
  portraitOpacity, selectStarPortrait, zoomStops, nextZoomStop,
  createStarPortrait,
} = SP;

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
const stars = galaxy.bodies.filter((b) => b.star && !b.deepSky);
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

// ---- 6. 内容驱动阶梯：太阳逐档有变化，心宿二跳过空白档 ----
function neighborsOf(id) {
  const me = galaxy.bodies.find((b) => b.id === id);
  assert.ok(me?.galaxyPos, `缺少 ${id} 的坐标`);
  return galaxy.bodies
    .filter((b) => b.id !== id && Array.isArray(b.galaxyPos))
    .map((b) => Math.hypot(...b.galaxyPos.map((v, i) => v - me.galaxyPos[i])) * LY_PER_KPC)
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);
}
function ladderOf(id) {
  const def = galaxy.bodies.find((b) => b.id === id);
  const close = closeupDistanceLy(def.radiusSun);
  const fade = revealDistanceLy(def.radiusSun) * 1.2;
  const stops = zoomStops(close, neighborsOf(id), { waypoints: [fade] });
  assert.ok(Math.abs(stops[0] - close) < close * 1e-9, `${id} 的第一个停靠点必须是真实特写`);
  assert.ok(Math.abs(stops[1] - fade) < fade * 1e-9, `${id} 的第二个停靠点应是「球淡成一个点」`);
  for (let i = 1; i < stops.length; i++) {
    assert.ok(stops[i] > stops[i - 1], `${id} 的停靠点必须严格升序`);
  }
  return {
    def, close, stops,
    band: stops.filter((s) => s >= 1 && s <= 100),
    firstNeighbor: stops.find((s) => s > 100),
  };
}
const sunLadder = ladderOf('sun');
const antaresLadder = ladderOf('antares');
const betelLadder = ladderOf('betelgeuse');
const proxLadder = ladderOf('proxima');
assert.ok(sunLadder.band.length >= 3,
  `太阳在 1/10/100 光年应有多个有内容的尺度，实际 ${sunLadder.band.length}`);
assert.equal(antaresLadder.band.length, 0,
  '心宿二在 1/10/100 光年没有任何邻居，这三个空档必须被跳过');
assert.equal(betelLadder.band.length, 0,
  '参宿四在 1/10/100 光年同样必须跳过');
assert.ok(antaresLadder.firstNeighbor > 100 && antaresLadder.firstNeighbor < 5000,
  '心宿二缩小时应直接回到几百~几千光年，看到其它天体');
assert.ok(betelLadder.firstNeighbor > 100 && betelLadder.firstNeighbor < 5000);
assert.ok(proxLadder.stops.find((s) => s >= 0.1 && s < 1),
  '比邻星与南门二只隔 0.21 光年，应有一个 <1 光年的停靠点');
// 跳档方向：特写 → 球淡成点 → 第一个有邻居的尺度；往内逐级返回
assert.equal(nextZoomStop(antaresLadder.stops, antaresLadder.close, 1), antaresLadder.stops[1]);
assert.equal(nextZoomStop(antaresLadder.stops, antaresLadder.stops[1], 1),
  antaresLadder.firstNeighbor, '心宿二往外第二格必须直接跳到有邻居的尺度');
assert.equal(nextZoomStop(antaresLadder.stops, antaresLadder.stops[1], -1), antaresLadder.close);
assert.equal(nextZoomStop(antaresLadder.stops, antaresLadder.stops.at(-1), 1), null);
assert.equal(nextZoomStop(sunLadder.stops, sunLadder.stops[1], 1), sunLadder.stops[2]);
for (const s of antaresLadder.stops) {
  assert.ok(!(s >= 1 && s <= 100), '心宿二不该停在空白档');
}

// ---- 7. main.js 接线 ----
for (const needle of [
  "from './star-portrait.js'", 'createStarPortrait(def)', 'updateStarPortraits(dtSec)',
  'setStarCloseup(def, obj)', 'beginFocusLadder(def, obj)', 'zoomStops(',
  'nextZoomStop(focusStops', 'flyFocusTo(stop)', 'applyFocusAnchorScale(',
  'waypoints: [revealDistanceLy(def.radiusSun) * 1.2]',
  'effectiveSpanLy(dCamLy, camera.fov)', 'starRadiusUnits(def.radiusSun)',
  'closeupDistanceLy(def.radiusSun)', 'updateTierVisibility(currentTier, span)',
  'spanOverride != null && focusId', 'visibleBodies:', 'focusStops: focusStops',
]) {
  assert.ok(main.includes(needle), `main.js 缺少真实尺度接线: ${needle}`);
}
for (const banned of [
  'PORTRAIT_CLOSEUP_LY', 'PORTRAIT_MAX_RADIUS_LY', 'tierFactorOf', 'starSizeFactor',
  'tierCamDist(currentTier) * 0.45', 'portraitOpacity(c.dLy)',
  'selectStarPortrait(_portraitCandidates, TIERS[currentTier].spanLy)',
]) {
  assert.ok(!main.includes(banned), `main.js 仍残留旧的示意尺度判定: ${banned}`);
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
  + `太阳 1~100 ly 有 ${sunLadder.band.length} 档内容，心宿二/参宿四 0 档`
  + `（首个有邻居的尺度 ${antaresLadder.firstNeighbor.toFixed(0)} / ${betelLadder.firstNeighbor.toFixed(0)} ly）。`);
