/**
 * 三维背景自检：空间是三维的，可见性由视锥决定，不由「当前比例尺」决定。
 *
 *  1) projectToNdc / pointWorldSize 的透视数学；
 *  2) 用 galaxy.js 的**真实三维坐标**验证：相机贴在心宿二 1 光年处，
 *     几百光年外的太阳、上千光年外的深空天体照样落在视锥里；
 *  3) backdropOptions 自动挑出的背景方位，真的把太阳放进画面（不是只在名单里）；
 *  4) 换个背景方位，入画天体集合随之变化；
 *  5) continuousZoom 是固定倍率的连续缩放，与周围有没有邻居无关，
 *     心宿二的 1 / 10 / 100 光年不再被跳过；
 *  6) main.js / i18n 接线，禁止旧「距离窗口 + 自动跳档」残留。
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const SRC = resolve(ROOT, 'src');
const TMP = resolve(SRC, '.check-backdrop-tmp');

const BD = await import('../src/backdrop.js');
const {
  projectToNdc, inView, pointWorldSize, backdropOptions, continuousZoom,
  DEFAULT_ZOOM_RATIO,
} = BD;
const LAD = await import('../src/zoom-ladder.js');
const { SUN_RADIUS_LY, UNITS_PER_LY, closeupDistanceLy } = LAD;

const UP = [0, 1, 0];
const FOV = 45;
const ASPECT = 16 / 9;
const sub = (a, b) => a.map((v, i) => v - b[i]);
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);

/** 与 main.js standDirection() 完全一致：站在背景群反方向，并略微抬高视线。 */
function standDirection(b) {
  let v = norm(b.map((x) => -x));
  v[1] += 0.16;
  return norm(v);
}

// ---- 1. 透视数学 ----
const cam = [0, 0, 0];
const ahead = [0, 0, -10];
assert.equal(projectToNdc(cam, ahead, UP, [0, 0, -10]).inFrame, true, '正前方必须入画');
assert.equal(projectToNdc(cam, ahead, UP, [0, 0, 10]).inFront, false, '相机背后必须不可见');
assert.equal(projectToNdc(cam, ahead, UP, [0, 0, 10]).inFrame, false);
assert.equal(projectToNdc(cam, ahead, UP, [100, 0, -10]).inFrame, false, '视野外必须不可见');
assert.equal(inView([0, 0, -10], cam, ahead, UP, FOV, ASPECT), true);
const tanHalf = Math.tan((FOV * Math.PI) / 360);
assert.ok(projectToNdc(cam, ahead, UP, [10 * tanHalf * ASPECT * 0.5, 0, -10]).x > 0,
  'NDC x 必须与横向偏移同号');
// 宽屏的水平视野比窄屏大：同一颗偏侧的星在 16:9 里入画、在 1:1 里出画
const side = [10 * tanHalf * 1.2, 0, -10];
assert.equal(projectToNdc(cam, ahead, UP, side, FOV, 16 / 9).inFrame, true);
assert.equal(projectToNdc(cam, ahead, UP, side, FOV, 1).inFrame, false);

// 屏幕空间点尺寸：D 差 100 倍，按 pointWorldSize 反算后占屏像素必须一致
for (const D of [0.001, 0.1, 1, 100, 550, 26000]) {
  const s = pointWorldSize(D, FOV, 900, 2);
  assert.ok(s > 0 && Number.isFinite(s));
  const px = (s / 2) / (D * tanHalf * ASPECT) * (900 * ASPECT / 2) * 2;
  assert.ok(Math.abs(px - 2) < 1e-9, `距离 ${D} 的点占屏像素应恒为 2，实际 ${px}`);
}
assert.ok(pointWorldSize(550, FOV, 900, 2) / pointWorldSize(5.5, FOV, 900, 2) > 99,
  '远处天体的世界尺寸必须按各自距离同比放大，不能统一按焦点距离缩放');
assert.equal(pointWorldSize(-1, FOV, 900, 2), 0);

// ---- 2. 连续缩放：固定倍率、与内容无关、不跳档 ----
assert.ok(DEFAULT_ZOOM_RATIO > 1);
const minLy = closeupDistanceLy(680) * 0.45;
const maxLy = 1e5;
let d = minLy;
const seq = [];
for (let i = 0; i < 60; i++) {
  const next = continuousZoom(d, 100, { minLy, maxLy });
  assert.ok(next >= d, '往外缩只能单调变大');
  if (next > d) assert.ok(
    next >= maxLy * 0.999 || Math.abs(next / d - DEFAULT_ZOOM_RATIO) < 1e-9,
    '每一格都必须是同一个固定倍率，不允许按邻居距离跳档（最外一格允许钳到全景）');
  d = next;
  seq.push(d);
}
assert.ok(seq.at(-1) >= maxLy * 0.99, '连续缩放应能一路走到 10 万光年全景');
// 心宿二周围几百光年内没有邻居，但 1 / 10 / 100 光年这三段都必须「能停」，
// 而不是被 zoomStops 合并掉。
for (const target of [1, 10, 100]) {
  assert.ok(seq.some((v) => v >= target && v <= target * DEFAULT_ZOOM_RATIO),
    `${target} 光年这一档应能停留（连续缩放序列里存在该量级）`);
}
// 「内容无关」：函数只认距离与滚轮量，喂进邻居列表也不改变结果
assert.equal(continuousZoom(7.3, 100, { minLy, maxLy, neighbors: [4.24, 550, 1600] }),
  continuousZoom(7.3, 100, { minLy, maxLy }), '缩放不得被天体内容影响');
assert.equal(continuousZoom(maxLy, 100, { minLy, maxLy }), maxLy, '最外要钳住');
assert.equal(continuousZoom(minLy, -100, { minLy, maxLy }), minLy, '最内要钳住');
assert.ok(continuousZoom(10, -50, { minLy, maxLy }) < 10, '往内滚是放大');

// ---- 3. 真实银河系三维坐标 ----
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
const { LY_PER_KPC } = galaxyMod;
const galaxy = galaxyMod.default;
rmSync(TMP, { recursive: true, force: true });
assert.ok(Math.abs(UNITS_PER_LY - 1 / LY_PER_KPC) < 1e-12);

const bodies = galaxy.bodies.filter((b) => Array.isArray(b.galaxyPos)).map((b) => ({
  id: b.id,
  pos: b.galaxyPos,
  weight: (b.id === 'sun' || b.id === 'sagA') ? 2.4 : (b.deepSky ? 1.6 : 1),
}));
const byId = new Map(bodies.map((b) => [b.id, b]));
assert.ok(byId.has('sun') && byId.has('antares') && byId.has('betelgeuse'),
  '银河系坐标表必须包含太阳 / 心宿二 / 参宿四');
const focus = byId.get('antares').pos;
const dSun = Math.hypot(...sub(byId.get('sun').pos, focus)) * LY_PER_KPC;
assert.ok(dSun > 100, `心宿二到太阳必须远大于 1 光年，实际 ${dSun.toFixed(0)} ly`);

/** 给定视线方向与相机距离，返回所有真实入画天体（用与运行时相同的 NDC 数学）。 */
function inFrameIds(b, dLy) {
  const stand = standDirection(b);
  const camPos = add(focus, stand, dLy / LY_PER_KPC);
  return bodies
    .filter((o) => inView(o.pos, camPos, focus, UP, FOV, ASPECT))
    .map((o) => o.id);
}

// 背景方位：默认方向必须真的把太阳放进 1 光年尺度的画面
const options = backdropOptions(focus, bodies, { fovDeg: FOV, aspect: ASPECT, limit: 6, coreId: 'sun' });
assert.ok(options.length >= 2, '应给出多个可轮换的背景方位');
assert.equal(options[0].core, true, '默认方位应优先包含太阳这个方向锚');
const first = inFrameIds(options[0].dir, 1);
assert.ok(first.includes('sun'),
  `心宿二 1 光年尺度的背景里必须看得见 ${dSun.toFixed(0)} 光年外的太阳；实际入画 ${first.length} 个`);
assert.ok(options[0].ids.includes('sun'), '候选方向的入画名单也要含太阳');
assert.ok(first.length >= 4, `背景不该孤单，1 光年尺度至少入画 4 个天体，实际 ${first.length}`);

// 「1 光年尺度也能看到 100 光年以外」：真实距离逐一核对
const distant = first
  .map((id) => ({ id, dLy: Math.hypot(...sub(byId.get(id).pos, focus)) * LY_PER_KPC }))
  .filter((o) => o.dLy > 100)
  .sort((a, b) => a.dLy - b.dLy);
assert.ok(distant.length >= 3,
  `至少 3 个百光年外的天体要留在 1 光年视野里，实际 ${distant.length}`);
assert.ok(distant.some((o) => o.dLy > 500), '还应看到更远的深空天体 / 恒星');

// 同一方位下，从 9R 特写缩到 1、10、100 光年，远处天体始终在背景里：
// 这正是「不必靠自动跳档找内容」的物理依据。
for (const dLy of [closeupDistanceLy(680), 1e-4, 1, 10, 100]) {
  const ids = inFrameIds(options[0].dir, dLy);
  assert.ok(ids.includes('sun'), `相机距离 ${dLy} ly 时太阳仍应在视锥内`);
}

// 换个背景方位 = 换一批背景天体；旋转视角（改用另一方向）也改变入画集合
const second = inFrameIds(options[1].dir, 1);
const a = new Set(first), b = new Set(second);
assert.ok([...a].some((id) => !b.has(id)) || [...b].some((id) => !a.has(id)),
  '换背景方位后入画天体集合必须发生变化');
assert.ok(second.length >= 2, '第二个方位也不能是空背景');

// 相机背后的方位：把视线掉头，太阳应该出画（证明是视锥判定，不是「一律显示」）
const opposite = options[0].dir.map((x) => -x);
assert.ok(!inFrameIds(opposite, 1).includes('sun'),
  '背对太阳时它应出画，证明可见性来自三维视锥而非全局放行');

// ---- 4. 生产接线 ----
const main = readFileSync(resolve(SRC, 'main.js'), 'utf8');
const i18n = readFileSync(resolve(SRC, 'i18n.js'), 'utf8');
for (const needle of [
  "from './backdrop.js'", 'projectToNdc', 'pointWorldSize', 'backdropOptions(',
  'continuousZoom(dLy, e.deltaY', 'DEFAULT_ZOOM_RATIO',
  'updateBackdropVisibility()', 'applyFocusAnchorScale()', 'cycleBackdrop()',
  'setContinuousZoomRange()', 'controls.enableZoom = false',
  'distantVisible:', 'backdropDir:', 'zoomMode:', 'sb-backdrop',
  'backdropNote', 'backdropAnchor', 'backdropBtn',
]) {
  assert.ok(main.includes(needle), `main.js 缺少三维背景接线: ${needle}`);
}
for (const banned of [
  'zoomStops(', 'nextZoomStop(', 'focusStops', 'distanceTo(origin) / UNITS_PER_LY',
  '按「有内容的尺度」阶梯跳', '跳过空白尺度',
]) {
  assert.ok(!main.includes(banned), `main.js 仍残留旧的自动跳档/距离窗口: ${banned}`);
}
assert.ok(!readFileSync(resolve(SRC, 'zoom-ladder.js'), 'utf8').includes('export function zoomStops'),
  'zoom-ladder.js 不该再导出内容阶梯');
for (const needle of ['backdropNote', 'backdropAnchor', 'backdropBtn', 'focusScaleHint']) {
  assert.equal((i18n.match(new RegExp(needle, 'g')) ?? []).length, 2,
    `${needle} 必须中英双语各一份`);
}
assert.ok(readFileSync(resolve(SRC, 'style.css'), 'utf8').includes('.sb-backdrop'),
  '缺少背景方位按钮样式');

console.log(`三维背景校验通过：心宿二 1 光年视野里 ${first.length} 个天体入画，`
  + `其中 ${distant.length} 个在 100 光年外（太阳 ${dSun.toFixed(0)} ly）；`
  + `提供 ${options.length} 个可轮换背景方位；连续缩放每格 ×${DEFAULT_ZOOM_RATIO}，`
  + `1 / 10 / 100 光年均可停留。`);
