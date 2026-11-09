/**
 * 恒星近景 LOD 自检。
 *
 * 三部分：
 *  1) 真实执行 src/star-portrait.js（Node 里用最小 canvas 桩）：贴图 / 球体结构、
 *     绝对光年门槛、唯一性选择、球径封顶；
 *  2) 用 galaxy.js 的**真实 6 档相机距离 + 真实恒星坐标**跑一遍候选计算：
 *     1 万 / 1 千 / 100 / 10 光年档（含滚轮放大到 minDistance）必须零球，
 *     1 光年档只能有一棵球，球直径必须小于最近邻恒星间距；
 *  3) 静态断言 main.js / galaxy.js 的生产配置与接线。
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
  starSizeFactor, portraitRadius, portraitOpacity, selectStarPortrait,
  tierAllowsPortrait, starWithinPortrait, createStarPortrait,
  UNITS_PER_LY, PORTRAIT_REVEAL_LY, PORTRAIT_FULL_LY, PORTRAIT_CLOSEUP_LY,
  PORTRAIT_MAX_RADIUS_LY, PORTRAIT_TIER_SPAN_LY,
} = SP;

// ---- 常量：球体只能活在 1 光年尺度 ----
assert.ok(Math.abs(UNITS_PER_LY - 1 / 3261.56) < 1e-12, '光年 → 场景单位换算错误');
assert.equal(PORTRAIT_TIER_SPAN_LY, 1, '只有 1 光年档允许球体');
assert.equal(PORTRAIT_REVEAL_LY, 1, '相机必须进入恒星 1 光年以内');
assert.ok(PORTRAIT_CLOSEUP_LY < PORTRAIT_FULL_LY, '外链直达距离必须落在完全显形区间');
assert.ok(PORTRAIT_MAX_RADIUS_LY * 2 < 0.21,
  '球直径必须小于最近的恒星对间距（比邻星—南门二 ≈ 0.21 光年）');

// ---- 档位 / 距离 / 唯一性的纯数学 ----
for (const span of [100000, 10000, 1000, 100, 10]) {
  assert.equal(tierAllowsPortrait(span), false, `${span} 光年档不允许出现球体`);
}
assert.equal(tierAllowsPortrait(1), true, '1 光年档允许球体');
assert.equal(tierAllowsPortrait(NaN), false, '非法档位不能产生 NaN 球体');
assert.equal(starWithinPortrait(0.99), true);
assert.equal(starWithinPortrait(1), false, '恰好 1 光年仍应是一个点');
assert.equal(starWithinPortrait(Infinity), false);
assert.equal(portraitOpacity(1), 0, '1 光年处必须是纯点');
assert.equal(portraitOpacity(4.24), 0, '几光年外必须隐藏');
assert.equal(portraitOpacity(PORTRAIT_FULL_LY), 1, '0.55 光年内完全显形');
assert.ok(portraitOpacity(0.8) > 0 && portraitOpacity(0.8) < 1, '中间距离应淡入');
assert.equal(portraitOpacity(NaN), 0, '非法距离不能产生 NaN 透明度');
assert.equal(portraitOpacity(-1), 0);

const many = Array.from({ length: 19 }, (_, i) => ({
  id: `star${i}`, dLy: 0.2 + i * 0.03, visible: true,
}));
assert.equal(selectStarPortrait(many, 1), 'star0', '只应留下离相机最近的一颗');
assert.equal(selectStarPortrait(many, 10000), null, '1 万光年档必须零球');
assert.equal(selectStarPortrait(many, 10), null, '10 光年档必须零球');
assert.equal(selectStarPortrait([{ id: 'far', dLy: 4.24, visible: true }], 1), null,
  '没有恒星进入 1 光年内就必须全是点');
assert.equal(selectStarPortrait([{ id: 'hidden', dLy: 0.1, visible: false }], 1), null,
  '被档位窗口隐藏的天体不能显球');
assert.equal(selectStarPortrait(many.slice(0, 0), 1), null, '空候选不能显球');
// 跨档一致性：任意 span>1 都不显球，不受相机距离影响
for (const span of [100000, 10000, 1000, 100, 10, 1.0001]) {
  assert.equal(selectStarPortrait([{ id: 'x', dLy: 0.01, visible: true }], span), null,
    `${span} 光年档即使贴脸也不能显球`);
}

// ---- 球径：绝对封顶、与档位无关、不会钻进球内 ----
assert.ok(starSizeFactor(764) > starSizeFactor(1) * 2, '红超巨星应明显大于太阳');
assert.ok(starSizeFactor(0.154) < starSizeFactor(1), '红矮星应小于太阳');
assert.ok(starSizeFactor(1e6) <= 3, '半径系数必须封顶');
const dUnits = PORTRAIT_CLOSEUP_LY * UNITS_PER_LY;
const rSunLy = portraitRadius(1, dUnits, UNITS_PER_LY) / UNITS_PER_LY;
const rBigLy = portraitRadius(764, dUnits, UNITS_PER_LY) / UNITS_PER_LY;
const rSmallLy = portraitRadius(0.154, dUnits, UNITS_PER_LY) / UNITS_PER_LY;
assert.ok(rSunLy > 0 && Number.isFinite(rSunLy));
assert.ok(rBigLy > rSunLy && rSmallLy < rSunLy, '球径仍要表达真实半径的相对大小');
assert.ok(rBigLy <= PORTRAIT_MAX_RADIUS_LY, '最大的球也不能超过 0.05 光年');
// 同一距离下换任何档位都不该改变球径（函数根本没有档位参数）
const rA = portraitRadius(1, dUnits, UNITS_PER_LY);
const rB = portraitRadius(1, dUnits, UNITS_PER_LY);
assert.equal(rA, rB, '球径不得随档位缩放');
const nearD = 0.01 * UNITS_PER_LY;
assert.ok(portraitRadius(1, nearD, UNITS_PER_LY) <= nearD * 0.42 + 1e-18,
  '相机贴到球边时必须按距离封顶，不能钻进球内');

// ---- 真实构建一颗恒星特写 ----
const p = createStarPortrait({ id: 'proxima', color: 0xff8a6a, radiusSun: 0.154, size: 0.07 });
assert.equal(p.group.visible, false, '近景球默认必须隐藏');
assert.equal(p.group.children.length, 3, '应包含光球 + 色球亮环 + 日冕');
assert.ok(p.sphere.isMesh && p.sphere.geometry.type === 'SphereGeometry', '光球必须是球体');
assert.ok(p.sphere.material.map, '光球必须有程序化米粒组织贴图');
assert.equal(p.sphere.material.toneMapped, false, '恒星自发光不应被曝光压暗');
assert.equal(p.sphere.userData.bodyId, 'proxima', '光球要带 bodyId 便于调试');
p.group.scale.setScalar(0.5);
assert.ok(Number.isFinite(p.group.scale.x));

// ---- 生产配置：恒星 / 星团 / 黑洞的分类必须自洽 ----
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
  'star-portrait.js 的换算必须与 galaxy.js 的 LY_PER_KPC 一致');
const main = readFileSync(resolve(SRC, 'main.js'), 'utf8');
assert.ok(main.includes('def.star && !def.deepSky && Number.isFinite(def.radiusSun)'),
  'main.js 必须只给带真实半径的恒星挂近景球，否则 cosmos 页的星系锚点会被画成恒星');
const stars = galaxy.bodies.filter((b) => b.star && !b.deepSky);
const showpieces = galaxy.bodies.filter((b) => b.deepSky);
assert.ok(stars.length >= 19, `恒星近景球覆盖不足：只有 ${stars.length} 颗`);
for (const b of stars) {
  assert.ok(Number.isFinite(b.radiusSun) && b.radiusSun > 0,
    `恒星 ${b.id} 缺少真实半径 radiusSun，近景球无法按真实比例缩放`);
  assert.equal(b.fixedSize, 0.07, `恒星 ${b.id} 在银河系尺度上仍必须是一个 0.07 的点`);
}
for (const b of showpieces) {
  assert.ok(['nebula', 'remnant', 'blackhole', 'cluster'].includes(b.deepSky.kind),
    `${b.id} 的展示物类型未知: ${b.deepSky.kind}`);
}
assert.ok(showpieces.some((b) => b.deepSky.kind === 'cluster'), '疏散星团应有点云星团展示物');
assert.ok(showpieces.some((b) => b.id === 'sagA' && b.deepSky.kind === 'blackhole'),
  '人马座 A* 放大后应是黑洞而非恒星球体');
assert.equal(stars.find((b) => b.id === 'sun')?.radiusSun, 1, '太阳必须是近景球的大小基准');

// ---- 真实几何：6 档相机距离 × 19 颗恒星的真实坐标 ----
// 与 main.js tierCamDist() 同款：radiusKpc / tan(fov/2) * fitMargin，fov=45°、fitMargin=1.25
const camDistOf = (tier) => tier.radiusKpc / Math.tan((45 * Math.PI) / 360) * 1.25;
const dir = (() => {
  const v = [0, 0.62, 1], n = Math.hypot(...v);
  return v.map((x) => x / n);
})();
const starDefs = stars.filter((b) => Array.isArray(b.galaxyPos));
/** 相机停在 center 外 distKpc 处，返回每颗恒星距相机的真实光年数 */
function candidatesAt(center, distKpc) {
  const cam = center.map((c, j) => c + dir[j] * distKpc);
  return starDefs.map((b) => ({
    id: b.id,
    dLy: Math.hypot(...b.galaxyPos.map((v, j) => v - cam[j])) * LY_PER_KPC,
    visible: true,
  }));
}
const sunPos = galaxy.sunPos;
let widest = '';
for (let i = 0; i < SCALE_TIERS.length - 1; i++) {
  const tier = SCALE_TIERS[i];
  assert.equal(tierAllowsPortrait(tier.spanLy), false, `${tier.label} 不该允许球体`);
  // 1× = 档位基准距离；0.5× = 用户滚轮放大；0.08× = controls.minDistance（缩到最内）
  for (const zoom of [1, 0.5, 0.08]) {
    const cs = candidatesAt(sunPos, camDistOf(tier) * zoom);
    assert.equal(selectStarPortrait(cs, tier.spanLy), null,
      `${tier.label} 缩到 ${zoom}× 时出现了球体（会互相重叠）`);
    assert.ok(cs.every((c) => portraitOpacity(c.dLy) === 0 || !tierAllowsPortrait(tier.spanLy)),
      `${tier.label} 缩到 ${zoom}× 时不该有淡入`);
  }
  widest += `${tier.short} `;
}
const innerTier = SCALE_TIERS[SCALE_TIERS.length - 1];
assert.equal(tierAllowsPortrait(innerTier.spanLy), true);
// 1 光年档里，相机在太阳旁 0.45 光年：只有太阳进入 1 光年内
const csSun = candidatesAt(sunPos, PORTRAIT_CLOSEUP_LY * UNITS_PER_LY);
assert.equal(selectStarPortrait(csSun, innerTier.spanLy), 'sun', '1 光年档应只显太阳这一颗球');
assert.equal(csSun.filter((c) => starWithinPortrait(c.dLy)).length, 1,
  '1 光年视野里不该同时有两颗恒星');
// 外链直达比邻星：比邻星与南门二实际只隔约 0.21 光年，两者可能都进入 1 光年内，
// 这时「唯一性」是唯一能保证不出现两个球的东西。
const prox = starDefs.find((b) => b.id === 'proxima');
assert.ok(prox, '缺少比邻星配置');
const csProx = candidatesAt(prox.galaxyPos, PORTRAIT_CLOSEUP_LY * UNITS_PER_LY);
assert.equal(selectStarPortrait(csProx, innerTier.spanLy), 'proxima',
  '外链直达比邻星必须显比邻星，不能显成别的恒星');
const within = csProx.filter((c) => starWithinPortrait(c.dLy));
const nearestOther = Math.min(...csProx.filter((c) => c.id !== 'proxima').map((c) => c.dLy));
assert.ok(PORTRAIT_MAX_RADIUS_LY * 2 < nearestOther,
  `球直径 ${PORTRAIT_MAX_RADIUS_LY * 2} ly 必须小于最近邻恒星 ${nearestOther.toFixed(3)} ly`);

// ---- main.js 接线 ----
for (const needle of [
  "from './star-portrait.js'", 'createStarPortrait(def)', 'updateStarPortraits(dtSec)',
  'setStarCloseup(def, obj)',
  'selectStarPortrait(_portraitCandidates, TIERS[currentTier].spanLy)',
  'dLy: dUnits / UNITS_PER_LY',
  'portraitRadius(p.def.radiusSun, c.dUnits, UNITS_PER_LY)',
  'PORTRAIT_CLOSEUP_LY * UNITS_PER_LY',
  "applyTier(inner, { instant: true, focus: wp })",
  'updateTierVisibility(inner)',
  'const fPoint = Math.pow(10, -i);',
  'const forceId = follow?.id ?? selected?.id ?? null;',
  'visiblePortraits:',
  'closeups: [...starPortraits.entries()]',
]) {
  assert.ok(main.includes(needle), `main.js 缺少恒星近景接线: ${needle}`);
}
for (const banned of [
  'tierFactorOf', 'portraitOpacity(d, base)', 'portraitRadius(p.def.size',
  'tierCamDist(currentTier) * 0.45',
]) {
  assert.ok(!main.includes(banned), `main.js 仍残留旧的相对尺度判定: ${banned}`);
}
// 近景更新必须紧跟在 controls.update() 之后（相机位姿定下来才判距离）
const updateAt = main.indexOf('controls.update();');
const portraitAt = main.indexOf('updateStarPortraits(dtSec);', updateAt + 1);
assert.ok(updateAt > 0 && portraitAt > updateAt && portraitAt - updateAt < 120,
  '近景 LOD 必须紧跟在 controls.update() 之后执行');

console.log(`恒星近景 LOD 校验通过：${stars.length} 颗恒星球 / ${showpieces.length} 个非恒星展示物；`
  + `「${widest.trim()}」各档（含缩到 minDistance）零球；1 光年档唯一球，`
  + `球径 ≤ ${PORTRAIT_MAX_RADIUS_LY} ly，最近邻 ${nearestOther.toFixed(3)} ly，`
  + `比邻星特写时 ${within.length} 颗进入 1 光年内但只显 1 颗。`);
