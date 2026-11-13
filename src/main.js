import * as THREE from 'three';
import * as dat from 'dat.gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createBody, solveKepler, orbitPoint, setCurrentExaggeration } from './bodies.js';
import { applyScale, frameRadius, setBodyExaggeration } from './scale.js';
import { createCometParts, updateComet, updateCometViewport, cometGlobals } from './comet.js';
import { buildCosmosField } from './cosmos-field.js';
import { buildGalaxyPortrait } from './galaxy-portrait.js';
import {
  createStarPortrait, portraitRadius, portraitOpacity, selectStarPortrait,
  UNITS_PER_LY, starRadiusLy, starRadiusUnits,
  closeupDistanceLy, revealDistanceLy, effectiveSpanLy,
} from './star-portrait.js';
import {
  projectToNdc, pointWorldSize, backdropOptions, continuousZoom,
  DEFAULT_ZOOM_RATIO,
} from './backdrop.js';
import {
  resolveCurrentId, parentHref, childHref,
  href as universeHref, isEnglish as isEnglishLang,
} from './universe.js';
import { CATALOGS } from './data/catalogs.js';
import { OPENNGC_META } from './data/openngc.js';
import { SUN_GALACTIC_POS } from './coord/galactic.js';
import { periodText as periodTextOf } from './orbit-tree.js';
import { mountUniverseNav } from './nav.js';
import { resolveBody, bodyHref, carryParams, currentPageFile } from './deeplinks.js';
import { orbitAngle, coRotate } from './follow.js';
import {
  t, distText, tierLabel, tierShort, spanText, systemName, groupName,
  viewName, infoKey, infoValue, bodyName, shortName,
} from './i18n.js';

const DEG = Math.PI / 180;

// ---------- 银河系恒星点云（定性示意）----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randn(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
let _discTex = null;
function discTexture() {
  if (_discTex) return _discTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _discTex = new THREE.CanvasTexture(c);
  return _discTex;
}

// 恒星光晕：加法混合的柔光精灵，让点云里的锚点恒星（太阳/SagA*）读起来像"发光星"
function makeStarHalo(color, size) {
  const mat = new THREE.SpriteMaterial({
    map: discTexture(),
    color,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  return s;
}

// ---------- 深空天体「放大展示物」 ----------
// 银河系尺度上它们只是一个点；从左侧菜单聚焦后，才在原地放大显示出"长什么样"。
// 全部用 canvas / 几何体程序生成，不依赖外部图片，离线与静态部署都能用：
//   星云 / 超新星遗迹 → 程序绘制的彩色星云图片（billboard 精灵）
//   球状星团          → 密集点云球
//   恒星级黑洞        → 暗球 + 倾斜的发光吸积环
function makeNebulaTexture(def) {
  const ds = def.deepSky;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rng = mulberry32(ds.seed ?? 7);
  const pal = ds.palette ?? ['255,120,160', '120,160,255', '255,200,140'];
  g.clearRect(0, 0, 256, 256);
  // 注意：这里绝对不能用 'lighter'。之前 52 团云气用 lighter 逐像素相加，
  // 中心 RGB 与 alpha 都累加到饱和，再配 bloom 直接烧成一个纯白球，
  // 星云该有的粉/蓝/金层次全没了。普通 source-over 叠加只会让颜色互相覆盖、
  // 趋向中间色，天然保持"这是一张彩色照片"的观感。
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 64; i++) {
    const x = 128 + randn(rng) * 46;
    const y = 128 + randn(rng) * 40;
    const r = 16 + rng() * 56;
    const col = pal[Math.floor(rng() * pal.length)];
    const a = 0.10 + rng() * 0.18;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${col},${a})`);
    grd.addColorStop(0.55, `rgba(${col},${a * 0.42})`);
    grd.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // 暗尘带：挖掉几条斜向的云气，制造 M42 / 三叶星云那种明暗纤维结构，
  // 免得整张图只是一团均匀渐变。
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const x = 128 + randn(rng) * 58;
    const y = 128 + randn(rng) * 52;
    const r = 14 + rng() * 34;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(0,0,0,${0.35 + rng() * 0.4})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  // 中心亮核（恒星形成区 / 遗迹脉冲星）：小而暖，不做成整块死白
  const core = g.createRadialGradient(128, 128, 0, 128, 128, 30);
  core.addColorStop(0, 'rgba(255,246,225,0.42)');
  core.addColorStop(0.4, 'rgba(255,232,198,0.16)');
  core.addColorStop(1, 'rgba(255,225,190,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, 256, 256);
  // 前景恒星：少量锐利亮点，避免整张图糊成一片雾
  for (let i = 0; i < 90; i++) {
    const x = rng() * 256, y = rng() * 256;
    const s = 0.4 + rng() * 1.1;
    g.fillStyle = `rgba(255,252,242,${0.25 + rng() * 0.55})`;
    g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
  }
  // 圆形羽化遮罩：Sprite 贴图是正方形，若边缘 alpha 不为 0 会看到明显的方形硬边。
  // 用 destination-in 把四角擦干净，让星云自然融进黑色背景。
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(128, 128, 40, 128, 128, 128);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.7, 'rgba(0,0,0,0.96)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'source-over';
  return new THREE.CanvasTexture(c);
}

function makeClusterShowcase(def) {
  const rng = mulberry32(def.deepSky.seed ?? 11);
  const n = 1200;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // 立方根分布 → 中心密、边缘疏，像真实球状星团
    const r = Math.cbrt(rng()) * 0.42;
    const u = rng() * 2 - 1;
    const phi = rng() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = r * s * Math.cos(phi);
    pos[i * 3 + 1] = r * u;
    pos[i * 3 + 2] = r * s * Math.sin(phi);
    const t = rng();
    col[i * 3] = 1.0;
    col[i * 3 + 1] = 0.82 + t * 0.18;
    col[i * 3 + 2] = 0.6 + t * 0.35;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.035,
    map: discTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  const grp = new THREE.Group();
  grp.add(pts);
  grp.add(makeStarHalo(0xffdc9a, 0.5));  // 中心 unresolved 的柔光核
  return grp;
}

function makeBlackHoleShowcase(def) {
  const grp = new THREE.Group();
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0x05060c }),
  );
  grp.add(ball);
  // 吸积盘：用顶点色做「内缘炽白 → 外缘熄灭」的连续径向渐变。
  // 外缘颜色归零，在加法混合下等于完全透明，所以不会出现分层同心环那种
  // 一圈圈硬边（看起来像靶子 / 塑料甜甜圈）。再叠一点角度方向的亮度差，
  // 模拟朝向观察者运动一侧的多普勒增亮。
  const diskLayer = (inner, outer, hot, opacity) => {
    const geo = new THREE.RingGeometry(inner, outer, 128, 1);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const a = new THREE.Color(hot);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const t = THREE.MathUtils.clamp((Math.hypot(x, y) - inner) / (outer - inner), 0, 1);
      const k = Math.pow(1 - t, 1.5);
      const beam = 0.74 + 0.26 * Math.cos(Math.atan2(y, x) + Math.PI / 2);
      col[i * 3] = a.r * k * beam;
      col[i * 3 + 1] = a.g * k * beam;
      col[i * 3 + 2] = a.b * k * beam;
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.DoubleSide, transparent: true,
      opacity, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
  };
  const disk = new THREE.Group();
  disk.add(diskLayer(0.19, 0.60, 0xffc98a, 0.9));  // 主体盘
  disk.add(diskLayer(0.19, 0.30, 0xfff8e8, 0.95)); // 内缘炽白亮线
  disk.rotation.x = -Math.PI / 2.7;  // 略微倾斜，看得出是个盘而不是圆
  grp.add(disk);
  grp.add(makeStarHalo(0xffb066, 0.42));
  return grp;
}

// 生成一个"放大展示物"，默认隐藏；聚焦到该天体时才显示
function makeDeepSkyShowcase(def) {
  const kind = def.deepSky?.kind ?? 'nebula';
  let obj;
  if (kind === 'cluster') obj = makeClusterShowcase(def);
  else if (kind === 'blackhole') obj = makeBlackHoleShowcase(def);
  else {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeNebulaTexture(def),
      transparent: true,
      depthWrite: false,
      // 星云是"一张图片"，必须用普通混合：AdditiveBlending 会把云气颜色直接
      // 加到背景上，几十团叠加后必然烧成一片死白，看不到任何层次。
      blending: THREE.NormalBlending,
      toneMapped: false,
    }));
    sp.scale.set(0.85, 0.85, 1);
    obj = sp;
  }
  obj.visible = false;
  // 记录基准尺寸：切比例尺档位时所有「示意尺寸」要按 10^-tier 同比缩小，
  // 才能让它们在画面里占屏恒定，而不是随相机贴近被放大成满屏大球。
  obj.userData.baseScale = obj.isSprite ? 0.85 : 1;
  return obj;
}

// 按配置生成银河系「形态辉光（haze）」：真实 4 旋臂密度场 + 本地（猎户）支臂 + 核球 + 指数盘 + 银晕。
// 这是一层**定性语境辉光**——真实恒星由 HYG / Gaia 等 starfield 目录提供（见 catalogs.js），
// 本层只勾勒银盘与旋臂的密度走势，不抢真实星点。
//
// 几何：对数螺旋臂 r = r0·exp(b·θ)，b = 1/tan(pitch)。相位经调校，使太阳（盘面方位≈160.5°、
// R≈8.2 kpc）落在两条主旋臂之间的本地（猎户）支臂里，而非叠在主臂亮带上——这修正了原先
// 把太阳画在「主旋臂 A 中心线」的错误。2 条主旋臂（英仙 / 盾牌-半人马，最亮最密）+
// 2 条次旋臂（人马 / 矩尺）+ 一条以太阳为锚点的短本地支臂；中心核球 + 指数盘（老星暗背景）+ 银晕。
function buildMilkyWayHaze(g, scaleKpc) {
  const rng = mulberry32(g.seed ?? 1337);
  const diskR = g.diskRadiusKpc ?? 15;
  const thick = g.thicknessKpc ?? 0.6;
  const r0 = 2.0;                                   // 旋臂起始半径(kpc)，从核球外缘伸出
  const rEnd = diskR;                                // 旋臂延伸到银盘边缘
  const lnSpan = Math.log(rEnd / r0);
  const pitch = (g.armPitchDeg ?? 12) * DEG;         // 俯仰角：越小越卷；真实银臂约 12°
  const b = 1 / Math.tan(pitch);                     // 对数螺旋缠绕系数
  const bulgeN = g.bulgeStars ?? 4000;
  const haloN = g.haloStars ?? 2500;
  const diskN = g.diskStars ?? 12000;

  // 4 条旋臂：2 主 + 2 次。相位经调校使太阳（R≈8.2kpc, 方位≈160.5°）位于两主臂之间。
  // 计算：tangent 臂在 R=8.2 处的方位 = phase + b·ln(8.2/r0) = phase + 20.1°；
  // 令主臂在 R=8.2 的方位落在 115.5°/295.5°（与太阳各差 45°），反推 phase≈95.4°/275.4°；
  // 另两条（人马/矩尺次臂）取对角 185.4°/5.4°。
  const arms = [
    { phase: 95.4 * DEG,  major: true,  n: g.majorArmStars ?? 9000, bright: 1.45, width: 0.085, radial: 0.5,  hii: 0.22 },
    { phase: 185.4 * DEG, major: true,  n: g.majorArmStars ?? 9000, bright: 1.45, width: 0.085, radial: 0.5,  hii: 0.22 },
    { phase: 275.4 * DEG, major: false, n: g.minorArmStars ?? 6000, bright: 0.82, width: 0.06,  radial: 0.34, hii: 0.20 },
    { phase: 5.4 * DEG,   major: false, n: g.minorArmStars ?? 6000, bright: 0.82, width: 0.06,  radial: 0.34, hii: 0.20 },
  ];

  const pos = [];
  const col = [];
  const c = new THREE.Color();
  const push = (x, y, z, cr, cg, cb, bright) => {
    pos.push(x * scaleKpc, y * scaleKpc, z * scaleKpc);
    c.setRGB(Math.min(1, cr * bright), Math.min(1, cg * bright), Math.min(1, cb * bright));
    col.push(c.r, c.g, c.b);
  };
  // 恒星配色：hii 控制粉红 HII 结比例（旋臂更高，贴近真实星系的絮状红星点串）。
  // 各色保留「低次要通道」饱和度——加法混合会叠白，纯度不够就洗成一片白。
  const colorFor = (u, hii) => {
    if (u < hii) return [1.0, 0.16, 0.30, 1.15 + rng() * 0.45];   // HII 粉红星云
    if (u < 0.62) return [0.16, 0.42, 1.0, 0.95 + rng() * 0.35];  // 年轻蓝星
    if (u < 0.82) return [0.24, 0.92, 0.78, 0.9 + rng() * 0.3];   // 青白
    return [1.0, 0.72, 0.34, 0.9 + rng() * 0.3];                  // 黄白(老星)
  };

  // —— 4 条对数螺旋臂 ——
  for (const arm of arms) {
    for (let s = 0; s < arm.n; s++) {
      const t = rng();                              // 沿臂 0(内)→1(外)
      const r = r0 * Math.exp(t * lnSpan);
      const theta = arm.phase + b * Math.log(r / r0);
      const ang = theta + randn(rng) * arm.width;   // 角向散射 = 旋带粗细
      const rr = r + randn(rng) * arm.radial;        // 径向散射 = 旋带厚度
      const x = Math.cos(ang) * rr;
      const z = Math.sin(ang) * rr;
      const y = randn(rng) * thick * Math.exp(-r / (diskR * 0.5));
      const [cr, cg, cb, br] = colorFor(rng(), arm.hii);
      push(x, y, z, cr, cg, cb, br * arm.bright);
    }
  }
  // —— 本地（猎户）支臂：以太阳为锚点的短分支，介于人马臂与英仙臂之间，
  //     中等密度、偏蓝（年轻恒星形成区），让太阳不坐在完全空荡的臂间 ——
  {
    const n = g.localSpurStars ?? 2500;
    const rSun = Math.hypot(SUN_GALACTIC_POS[0], SUN_GALACTIC_POS[2]);        // ≈8.2
    const aSun = Math.atan2(SUN_GALACTIC_POS[2], SUN_GALACTIC_POS[0]);        // ≈2.80 rad
    for (let s = 0; s < n; s++) {
      const t = rng();
      const r = rSun + (t - 0.3) * 4.0;                  // 从太阳内外延伸一点
      const ang = aSun + (t - 0.5) * 0.5 + randn(rng) * 0.06;
      const rr = Math.max(2, r + randn(rng) * 0.3);
      const x = Math.cos(ang) * rr;
      const z = Math.sin(ang) * rr;
      const y = randn(rng) * thick * 0.8 * Math.exp(-r / (diskR * 0.5));
      const [cr, cg, cb, br] = colorFor(rng(), 0.30);
      push(x, y, z, cr, cg, cb, br * 0.95);
    }
  }
  // —— 臂间指数盘：老星偏黄红，暗淡背景，仅补银盘「身体」，绝不抢旋臂 ——
  for (let d = 0; d < diskN; d++) {
    const r = Math.pow(rng(), 0.6) * diskR;
    const ang = rng() * Math.PI * 2;
    const rad = r + randn(rng) * 0.6;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    const y = randn(rng) * thick * Math.exp(-r / (diskR * 0.6));
    push(x, y, z, 0.85, 0.55, 0.38, 0.16 + rng() * 0.12);
  }
  // —— 核球（中心密集的暖色椭球）——
  for (let bb = 0; bb < bulgeN; bb++) {
    const r = Math.pow(rng(), 0.5) * 3.0;
    const theta = Math.acos(2 * rng() - 1);
    const phi = 2 * Math.PI * rng();
    const x = r * Math.sin(theta) * Math.cos(phi);
    const y = r * Math.cos(theta) * 0.7;
    const z = r * Math.sin(theta) * Math.sin(phi);
    push(x, y, z, 1.0, 0.84, 0.6, 1.0 + rng() * 0.4);
  }
  // —— 银晕（稀疏、偏暗的球壳）——
  for (let h = 0; h < haloN; h++) {
    const r = (0.4 + rng()) * diskR * 1.3;
    const theta = Math.acos(2 * rng() - 1);
    const phi = 2 * Math.PI * rng();
    const x = r * Math.sin(theta) * Math.cos(phi);
    const y = r * Math.cos(theta) * 0.5;
    const z = r * Math.sin(theta) * Math.sin(phi);
    push(x, y, z, 0.8, 0.85, 1.0, 0.4 + rng() * 0.3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: g.pointSize ?? 1.3,
    map: discTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,   // 固定屏幕像素大小：总览档（相机离盘面 ~17kpc）也能看清旋臂，
    toneMapped: false,   // 关掉 ACES 色调映射，保留旋臂的蓝/粉/青/黄真实色彩，不被洗成一片白
  });
  return new THREE.Points(geo, mat);
}

// 银盘柔光：一层加法辉光盘 + 中心核球辉光，给星系一个发光的"身体"，提升整体观感。
// 总览档让「银河系」一眼可辨（盘 + 亮核），分类目录点云（HYG/OpenNGC）按档淡出后不会盖过结构。
function makeGalaxyGlow(diskR) {
  const group = new THREE.Group();
  const disk = new THREE.Sprite(new THREE.SpriteMaterial({
    map: discTexture(), color: 0xffe2bd, transparent: true,
    opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  disk.scale.set(diskR * 3.0, diskR * 0.85, 1);
  group.add(disk);
  const bulge = new THREE.Sprite(new THREE.SpriteMaterial({
    map: discTexture(), color: 0xfff1da, transparent: true,
    opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  bulge.scale.set(diskR * 1.1, diskR * 1.1, 1);
  group.add(bulge);
  return group;
}

// 远景星系：只是远处一个模糊的小点（椭圆辉光），无细节、不可交互
function makeDistantGalaxy(def) {
  const mat = new THREE.SpriteMaterial({
    map: discTexture(), color: def.color ?? 0xffffff, transparent: true,
    opacity: def.opacity ?? 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(mat);
  const sz = def.size ?? 1.4;
  const stretch = def.stretch ?? 0.45;
  s.scale.set(sz, sz * stretch, 1);
  s.position.set(def.pos[0], def.pos[1], def.pos[2]);
  return s;
}

/**
 * 算出某个"取景范围"下的相机位姿（不改动任何状态，纯计算，便于切换视角时复用）。
 * @param {object} system
 * @param {THREE.PerspectiveCamera} camera 只读用 fov
 * @param {string} [frameTo] 覆盖 system.camera.frameTo
 * @returns {{pos: THREE.Vector3, target: THREE.Vector3, maxDistance: number}}
 */
function cameraPose(system, camera, frameTo) {
  const cam = system.camera ?? {};
  const radius = frameRadius(system, frameTo);

  const dir = new THREE.Vector3(...(cam.position ?? [0, 0.45, 1]));
  if (dir.lengthSq() === 0) dir.set(0, 0.45, 1);
  dir.normalize();

  const dist = (radius / Math.tan((camera.fov * DEG) / 2)) * (cam.fitMargin ?? 1.25);

  // 拉远上限：至少能看到最外侧轨道，否则远距不规则卫星永远进不了画面
  let farthest = 0;
  for (const b of system.bodies) if (b.orbit?.a) farthest = Math.max(farthest, b.orbit.a);

  return {
    pos: dir.multiplyScalar(dist),
    target: new THREE.Vector3(...(cam.target ?? [0, 0, 0])),
    maxDistance: Math.max(cam.maxZoom ?? 0, farthest * 1.35, dist * 3),
  };
}

/**
 * 立即把相机摆到某个取景范围（不带动画）。
 */
function fitCamera(system, camera, controls, frameTo) {
  const pose = cameraPose(system, camera, frameTo);
  camera.position.copy(pose.pos);
  controls.target.copy(pose.target);
  controls.minDistance = Math.max(0.05, system.bodies[0].size * 0.3);
  controls.maxDistance = pose.maxDistance;
  return pose;
}

/**
 * 把当前放大倍数应用到已构建的天体节点（仅改 scale / 重建环几何体，不重建球几何体）。
 * 中心天体 def.size 未变，其 scale 也随之保持；仅次级天体变大。
 */
function applyExaggerationToNodes(nodes, factor) {
  for (const n of nodes) {
    const s = n.def.size;
    if (n.mesh) n.mesh.scale.setScalar(s);
    if (n.atmosphere) n.atmosphere.scale.setScalar((s + 0.1) / s);
    if (n.ring) {
      const inner = n.def.ring.innerRadius ?? s * (n.def.ring.innerScale ?? 1.24);
      const outer = n.def.ring.outerRadius ?? s * (n.def.ring.outerScale ?? 2.27);
      n.ring.geometry.dispose();
      n.ring.geometry = new THREE.RingGeometry(inner, outer, 64);
    }
    if (n.model && n._baseScale) n.model.scale.setScalar(n._baseScale * factor);
  }
}

/**
 * 统一的场景启动器。
 * system = {
 *   id, label, hasSun, background, camera, timeScale, scale,
 *   sun:{texture,intensity}, bodies:[...], asteroids:[...]
 * }
 */

// HYG / Gaia 等星表在本地邻域（太阳附近）完整度最高、点最密，叠加混合后会在
// 太阳周围糊出一团过曝亮斑。按各点到太阳场景坐标的距离(kpc)做平滑亮度衰减：
// 近处大幅压暗、远处保持原样。只改亮度不改位置，不影响任何几何 / 定位 / 深链。
function dimStarfieldNearSun(col, pos) {
  const sx = SUN_GALACTIC_POS[0], sy = SUN_GALACTIC_POS[1], sz = SUN_GALACTIC_POS[2];
  const NEAR = 1.0, FAR = 5.0, MIN = 0.4; // kpc；NEAR 内压到 MIN，FAR 外不衰减
  const out = new Float32Array(col.length);
  for (let i = 0; i < col.length; i += 3) {
    const dx = pos[i] - sx, dy = pos[i + 1] - sy, dz = pos[i + 2] - sz;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    let w = 1;
    if (r < NEAR) w = MIN;
    else if (r < FAR) w = MIN + (1 - MIN) * ((r - NEAR) / (FAR - NEAR));
    out[i] = col[i] * w; out[i + 1] = col[i + 1] * w; out[i + 2] = col[i + 2] * w;
  }
  return out;
}

export function start(system) {
  // 当前页面在宇宙层级树里的位置。导航条、滚轮「上浮 / 下钻」边界全部从这里取，
  // 不再依赖每个 system 各自硬编码的 parentSystem / zoomOutTo / childSystem。
  const currentNodeId = resolveCurrentId();

  // ---------- 天体级直达外链：?body=<ID> / #<ID> ----------
  // 打开链接即聚焦该天体、显示信息卡，并让镜头跟着它继续公转，不需要再点菜单。
  // ID 可以是全局短名（earth）、跨页消歧名（jupiter:jupiter）或中文名（地球）。
  const deepParams = new URLSearchParams(location.search);
  const rawBody = deepParams.get('body') || deepParams.get('focus') || location.hash.slice(1);
  const deepBody = resolveBody(rawBody);
  if (deepParams.get('embed') === '1') document.body.classList.add('embed');
  // 链接给错页面时自动纠正（/solar?body=europa → /jupiter?body=europa），
  // lang / embed / scale 等参数原样透传。
  if (deepBody && deepBody.page !== currentPageFile()) {
    location.replace(bodyHref(deepBody.key, carryParams(['body', 'focus'])));
    return;
  }

  // 安全网：无太阳的子系统里，没有 parent 的天体就是中心天体，不该带公转轨道。
  // （REAL 里地球/木星等都存着绕日轨道，漏写 noOrbit 会让整个系统飞出画面。）
  for (const def of system.bodies) {
    if (!system.hasSun && !system.barycentric && !def.parent && def.orbit) {
      console.warn(`[start] ${def.id} 是子系统中心天体却带有轨道，已忽略；如需保留请显式配置`);
      delete def.orbit;
    }
  }

  applyScale(system);

  // ---------- 基础三件套 ----------
  // 远裁剪面必须随系统尺度变化：不规则卫星轨道可达上万场景单位，
  // 固定 20000 的 far 会让"+不规则卫星"取景档下整屏天体被裁掉。
  let farthestOrbit = 0;
  for (const b of system.bodies) if (b.orbit?.a) farthestOrbit = Math.max(farthestOrbit, b.orbit.a);
  const homeDistRaw =
    (frameRadius(system, system.camera?.frameTo ?? 'auto') / Math.tan((45 * DEG) / 2)) *
    (system.camera?.fitMargin ?? 1.25);
  const farPlane = Math.max(20000, (farthestOrbit + homeDistRaw) * 3);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45, window.innerWidth / window.innerHeight, farPlane * 1e-5, farPlane
  );

  const homeTarget = system.camera?.target ?? [0, 0, 0];

  // 对数深度缓冲：近裁剪面远小于 far 时避免 z-fighting
  const renderer = new THREE.WebGL1Renderer({ logarithmicDepthBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  // 3D 页面不需要页面级滚动（菜单 / 比例尺 / 地图抽屉都是 fixed），
  // 关掉可避免个别平台把 canvas 溢出算成滚动条，滚轮也能全部交给相机。
  document.body.style.overflow = 'hidden';
  // 彗尾是点云，点大小要按画布高度与 fov 换算成像素；窗口变化时必须重算
  updateCometViewport(camera, window.innerHeight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.75;
  controls.screenSpacePanning = false;

  // ---------- 取景范围（多视角）----------
  // 一颗行星的内层卫星与远距不规则卫星轨道可相差上百倍，同屏必然顾此失彼。
  // system.views 定义若干"框到哪一层"的预设，GUI 下拉切换。
  const views = system.views ?? [];
  fitCamera(system, camera, controls, system.camera?.frameTo ?? 'auto');
  let homePosition = camera.position.toArray();

  // ---------- 后处理 ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const outlinePass = new OutlinePass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    scene,
    camera
  );
  outlinePass.edgeStrength = 3;
  outlinePass.edgeGlow = 1;
  outlinePass.visibleEdgeColor.set(0xffffff);
  outlinePass.hiddenEdgeColor.set(0x190a05);
  composer.addPass(outlinePass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 1, 0.4, 0.85
  );
  bloomPass.threshold = 1;
  bloomPass.radius = 0.9;
  composer.addPass(bloomPass);

  // ---------- 光照 ----------
  scene.add(new THREE.AmbientLight(0x222222, 6));

  let sunMesh = null;
  let sunMat = null;
  if (system.hasSun) {
    const sunConf = system.sun ?? {};
    sunMat = new THREE.MeshStandardMaterial({
      emissive: 0xfff88f,
      emissiveMap: new THREE.TextureLoader().load(sunConf.texture),
      emissiveIntensity: sunConf.intensity ?? 1.9,
    });
    sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(system.scale?.sunUnits ?? 18, 32, 20),
      sunMat
    );
    sunMesh.userData.bodyId = 'sun';
    scene.add(sunMesh);

    const pointLight = new THREE.PointLight(0xfdffd3, 1200, 400, 1.4);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    scene.add(pointLight);
  } else {
    const dir = new THREE.DirectionalLight(0xffffff, 2.6);
    dir.position.set(1, 0.45, 0.9).multiplyScalar(200);
    dir.castShadow = false; // 默认阴影相机仅 ±5，行星尺度下会出现接缝伪影
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x8899bb, 0.5);
    fill.position.set(-1, -0.3, -0.6).multiplyScalar(200);
    scene.add(fill);
  }

  if (system.background) {
    scene.background = new THREE.CubeTextureLoader().load(system.background);
  }

  // ---------- 构建天体 ----------
  const nodes = [];
  const byId = new Map();
  // 多层恒星系统的惯性系子框架：见下方 build 与 animate 里的说明。
  const inertialChildren = [];
  const _frameVec = new THREE.Vector3();
  const deepSkyShowcases = new Map();  // id → 放大展示物（默认隐藏，聚焦时显示）
  const starPortraits = new Map();     // id → 恒星近景球（默认隐藏，镜头贴近才显示）
  // 银盘尺度的背景对象：聚焦深空天体特写时要整体藏掉，否则近距离下
  // sizeAttenuation 会把每个恒星点放大成满屏彩色圆斑。
  let galaxyField = null;
  let galaxyGlow = null;
  let portrait = null;
  const distantGalaxyObjs = [];
  // 银河系：所有恒星点 + 锚点天体挂在一个 group 下，整体缓慢自转（聚焦时冻结）
  const galaxyGroup = system.galaxy ? new THREE.Group() : null;
  if (galaxyGroup) scene.add(galaxyGroup);
  for (const def of system.bodies) {
    const node = createBody(def);
    // 彗星：彗发作为子节点挂在核上；两条尾巴必须挂到 scene 根——
    // 尾巴要在**世界坐标**里始终背离太阳，挂在随轨道面倾斜/旋转的 plane 下无法定向。
    if (def.comet && node.mesh) {
      node.comet = createCometParts(def, node.mesh);
      // 彗发与尾巴都挂 scene 根：前者要用绝对场景单位，后者要在世界坐标里背离太阳
      scene.add(node.comet.coma);
      scene.add(node.comet.coma2);
      scene.add(node.comet.ion);
      scene.add(node.comet.dust);
    }
    if (def.parent && byId.has(def.parent)) {
      if (def.inertialParent) {
        // 层级恒星系统：父层的 group/plane 带着 Ω / i / ω 旋转。若把子层
        // group 直接挂到父 anchor，子层的轨道要素会被父层旋转一起带偏，
        // 三合 / 四合星的层级几何就画错了。改挂到一个不旋转的惯性 frame：
        // frame 每帧只跟随父质心的世界坐标，子层自己的 Ω / i / ω 仍在
        // 同一个全局天球参考系里施加。
        const frame = new THREE.Group();
        (galaxyGroup || scene).add(frame);
        frame.add(node.group);
        node.childFrame = frame;
        node.parentId = def.parent;
        inertialChildren.push(node);   // 展开器按父先于子的顺序生成
      } else {
        byId.get(def.parent).anchor.add(node.group);
      }
    } else {
      (galaxyGroup || scene).add(node.group);
    }
    // 银河系里的天体用 galaxyPos（千秒差距）定位，而非公转轨道
    if (def.galaxyPos && system.galaxy) {
      const k = system.galaxy.scaleKpc ?? 1;
      node.group.position.set(def.galaxyPos[0] * k, def.galaxyPos[1] * k, def.galaxyPos[2] * k);
    }
    // 恒星锚点：核自发光（提亮以触发 bloom）+ 加法混合光晕
    if (def.star && node.mesh) {
      if (def.noStarGlow) {
        // 行星 / 恒星系统（system 类，如「太阳系」）在宇宙层级里绝不该发光成
        // 一颗恒星亮点——否则 cosmos.html?node=milkyway 等上层页会冒出带「太阳系」
        // 标签的亮黄白点。这里只保留一个暗淡、去饱和的小锚点 + 可点击热区，
        // 不挂加法光晕、不触发 bloom、不加恒星球体。身份靠标签与信息卡表达。
        const c = new THREE.Color(def.color ?? 0x9aa6b8).multiplyScalar(0.26);
        node.mesh.material = new THREE.MeshBasicMaterial({ color: c });
        node.mesh.material.toneMapped = false;
      } else {
        // 真实恒星 / 星系：核自发光（提亮以触发 bloom）+ 加法混合光晕
        const boost = def.starBoost ?? 1.6;
        const c = new THREE.Color(def.color ?? 0xffffff).multiplyScalar(boost);
        node.mesh.material = new THREE.MeshBasicMaterial({ color: c });
        node.mesh.material.toneMapped = false;
        node.halo = makeStarHalo(def.color ?? 0xffffff, def.glowSize ?? (def.fixedSize ?? 1) * 6);
        node.halo.userData.bodyId = def.id;
        // 聚星成员 / 白矮星等与主星共用 J2000 坐标：多片加法混合光晕叠在同一点
        // 会烧成一团白斑。这里只压亮度，不挪动坐标（坐标准确性是硬约束）。
        if (def.haloOpacity != null) node.halo.material.opacity = def.haloOpacity;
        node.group.add(node.halo);
      }
      // 宇宙层级页的成员只有 1~4px，直接点几乎点不中。挂一个全透明的
      // 拾取精灵当热区：画面上看不见，但鼠标仍能选中，点的视觉尺寸不被撑大。
      if (def.pickSize) {
        const pick = makeStarHalo(def.color ?? 0xffffff, def.pickSize);
        // 关键：AdditiveBlending 在 premultipliedAlpha 下用 gl.ONE/gl.ONE，
        // 会**忽略 opacity**，光设 opacity=0 照样画出一块纯白圆盘，再被 bloom
        // 放大成几百像素的光斑。colorWrite=false 才真正不写颜色缓冲：
        // 画面完全不可见、bloom 也看不到它，但对象仍在 Raycaster 的目标里。
        pick.material.colorWrite = false;
        pick.material.opacity = 0;
        pick.visible = false;
        pick.userData.bodyId = def.id;
        node.group.add(pick);
        node.pick = pick;
      }
    }
    // 深空天体：挂一个默认隐藏的"放大展示物"，只有聚焦到它时才显示。
    // 银河系尺度上它仍然只是那个 0.07 的点，不会把星系画面撑满。
    if (def.deepSky) {
      node.deepSky = true;
      const showcase = makeDeepSkyShowcase(def);
      node.group.add(showcase);
      deepSkyShowcases.set(def.id, showcase);
    }
    // 太阳系以外的普通恒星：远景仍是上面那个 0.07 的点；镜头真正靠近时，
    // 才在同一世界坐标浮出一颗「类太阳」球体（光球贴图 + 色球 / 日冕）。
    // 星云 / 星团 / 黑洞走各自的 deepSky 展示物，不重复挂球。
    // radiusSun 是硬门槛：cosmos.html 的星系锚点同样带 star:true（为了复用
    // 自发光点材质），但它们是星系不是恒星，绝不能放大成一颗球。
    if (def.star && !def.deepSky && Number.isFinite(def.radiusSun)) {
      const p = createStarPortrait(def);
      node.group.add(p.group);
      starPortraits.set(def.id, { ...p, def, node });
    }
    nodes.push(node);
    byId.set(def.id, node);
  }

  // 背景点云：银河系用专用旋臂生成器；上级层级（星系群 / 超星系团 / 宇宙网）
  // 用通用的纤维－结点生成器，并把可点击锚点作为亮结点喂进去。
  // 深空点云（OpenNGC 等）：渲染后留作可点击拾取目标；refreshTargets 也需引用，故提到外层作用域
  let deepSkyCloud = null;
  let catalogClouds = [];
  if (system.galaxy) {
    galaxyField = system.galaxy.kind
      ? buildCosmosField(system.galaxy)
      : buildMilkyWayHaze(system.galaxy, system.galaxy.scaleKpc ?? 1);
    (galaxyGroup || scene).add(galaxyField);
    // 天体目录星场：按 src/data/catalogs.js 注册表加载所有启用的 starfield 目录
    // （当前 HYG；OpenNGC / Gaia 预留）。坐标全部来自 src/coord/galactic.js 唯一真源，
    // 与银河系形态辉光同源同尺度（银心原点、kpc），作为真实恒星填满银盘。
    // 深空点云（OpenNGC 等）：渲染后留作可点击拾取目标（deepSkyCloud 在外层作用域声明）
    if (galaxyGroup && system.galaxy.catalogs) {
      // 仅「银河系本地星场页」渲染天体目录点云（HYG 恒星形成区恒星 + OpenNGC
      // 深空）。上层 cosmos 层级页（宇宙网 / 超星系团 / 星系团 / 本星系群 / 星系
      // 肖像 / 恒星系统）一律跳过：那些页面的 galaxyGroup 是宇宙纤维场 / 形态辉光，
      // 把「太阳系周边恒星球」塞进去尺度错乱。标记见各 system.galaxy.catalogs。
      for (const cat of Object.values(CATALOGS)) {
        if (!cat.enabled || !cat.data || cat.data.count <= 0) continue;
        const catGeo = new THREE.BufferGeometry();
        catGeo.setAttribute('position', new THREE.Float32BufferAttribute(cat.data.pos, 3));
        if (cat.kind === 'starfield') {
          // 本地邻域（太阳附近）HYG/Gaia 点最密，叠加混合易过曝：按到太阳距离平滑压暗。
          const dimCol = dimStarfieldNearSun(cat.data.col, cat.data.pos);
          catGeo.setAttribute('color', new THREE.Float32BufferAttribute(dimCol, 3));
          const catMat = new THREE.PointsMaterial({
            size: 0.8, sizeAttenuation: false, vertexColors: true,
            transparent: true, opacity: 0.8, depthWrite: false,
            blending: THREE.NormalBlending, toneMapped: false, fog: false,
          });
          const catPoints = new THREE.Points(catGeo, catMat);
          catPoints.frustumCulled = false;
          catPoints.name = 'catalog:' + (cat.label || 'starfield');
          catPoints.userData.baseOpacity = 0.8;
          catalogClouds.push(catPoints);
          galaxyGroup.add(catPoints);
        } else if (cat.kind === 'deepsky') {
          // 深空天体（星云/星团/星系）：按类型着色的点云，环绕太阳按壳层摆放。
          // 不做逐体网格（~1.4 万颗会爆 draw call），点云 + 射线按索引命中弹信息卡。
          catGeo.setAttribute('color', new THREE.Float32BufferAttribute(cat.data.col, 3));
          const catMat = new THREE.PointsMaterial({
            size: 1.4, sizeAttenuation: false, vertexColors: true,
            transparent: true, opacity: 0.92, depthWrite: false,
            blending: THREE.NormalBlending, toneMapped: false, fog: false,
          });
          const catPoints = new THREE.Points(catGeo, catMat);
          catPoints.frustumCulled = false;
          catPoints.name = 'catalog:' + (cat.label || 'deepsky');
          catPoints.userData.isDeepSky = true;
          catPoints.userData.catalog = cat;
          catPoints.userData.baseOpacity = 0.92;
          catalogClouds.push(catPoints);
          galaxyGroup.add(catPoints);
          deepSkyCloud = catPoints;
        }
      }
    }
    // 银盘柔光是盘状星系专属；宇宙网加一层大椭圆辉光只会糊掉黑洞洞的空洞
    if (system.galaxy.glow !== false) {
      galaxyGlow = makeGalaxyGlow(system.galaxy.diskRadiusKpc ?? 15);
      (galaxyGroup || scene).add(galaxyGlow);
    }
    // 星系自己的页面：画出它自己的形态（高倾角尘环 / 絮状多臂 / 不规则棒…）。
    // 上级视野里它仍只是一个点 —— 这里不画，那里才画，才不会夸大尺度。
    if (system.galaxy.portrait) {
      portrait = buildGalaxyPortrait(system.galaxy.portrait);
      if (portrait) (galaxyGroup || scene).add(portrait.group);
    }
  }

  // ---------- 远景星空：与相机同心、方向固定的天球星点 ----------
  // 银盘点云是「盘内恒星」：镜头贴到某颗恒星再把视线转向盘外时，45° 视锥里
  // 可能一颗都不剩，画面整片变黑（实测拖拽 94° 后可见天体 8→2）。这层球壳
  // 代表更远、方向固定的星空：任何视角都有星点，转镜头时按方向切换，仍是
  // 三维透视，而不是一张贴在屏幕上的静态背景图。
  let skyPoints = null;
  if (system.scaleTiers || system.starfield) {
    const N = 2400;
    const skyRng = mulberry32(20261110);
    const skyPos = new Float32Array(N * 3);
    const skyCol = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = skyRng() * 2 - 1;
      const phi = skyRng() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const R = 120;                  // 落在 camera.far = 200 之内
      skyPos[i * 3] = R * s * Math.cos(phi);
      skyPos[i * 3 + 1] = R * u;
      skyPos[i * 3 + 2] = R * s * Math.sin(phi);
      const b = 0.30 + skyRng() * 0.48;
      skyCol[i * 3] = b * (0.86 + skyRng() * 0.14);
      skyCol[i * 3 + 1] = b * (0.90 + skyRng() * 0.10);
      skyCol[i * 3 + 2] = b;
    }
    const skyGeo = new THREE.BufferGeometry();
    skyGeo.setAttribute('position', new THREE.Float32BufferAttribute(skyPos, 3));
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyCol, 3));
    skyPoints = new THREE.Points(skyGeo, new THREE.PointsMaterial({
      size: 1.3, sizeAttenuation: false, vertexColors: true,
      transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    }));
    skyPoints.frustumCulled = false;
    scene.add(skyPoints);
  }

  // 远景星系（背景点缀，静态不随银盘自转，纯视觉、不可交互）
  if (system.otherGalaxies?.length) {
    for (const og of system.otherGalaxies) {
      const dg = makeDistantGalaxy(og);
      scene.add(dg);
      distantGalaxyObjs.push(dg);
    }
  }

  // 太阳的世界坐标：彗尾要背离它。总览里太阳就在原点；无太阳的系统退回光照方向。
  const sunPos = new THREE.Vector3(...(system.camera?.target ?? [0, 0, 0]));

  // ---------- 小行星带 ----------
  const asteroids = [];
  for (const belt of system.asteroids ?? []) {
    const loader = new GLTFLoader();
    loader.load(
      belt.path,
      (gltf) => {
        gltf.scene.traverse((child) => {
          if (!child.isMesh) return;
          const per = Math.max(1, Math.round(belt.count / 12));
          for (let i = 0; i < per; i++) {
            const a = child.clone();
            const r = THREE.MathUtils.randFloat(belt.min, belt.max);
            const ang = Math.random() * Math.PI * 2;
            a.position.set(r * Math.cos(ang), THREE.MathUtils.randFloat(-3, 3), r * Math.sin(ang));
            a.scale.setScalar(THREE.MathUtils.randFloat(0.8, 1.2));
            scene.add(a);
            asteroids.push(a);
          }
        });
      },
      undefined,
      (err) => console.error('小行星加载失败:', belt.path, err)
    );
  }

  // ---------- 控制面板 ----------
  const settings = {
    timeScale: system.timeScale ?? 1, // 天 / 秒
    sunIntensity: system.sun?.intensity ?? 1.9,
    followMotion: true, // 选中天体后：时间继续走，镜头跟着目标一起公转
  };

  // 紧凑界面判定：竖屏窄屏或横屏手机，与 style.css 的断点保持一致。
  // 桌面也能手动折叠左侧栏，这里只决定「默认是否收起」。
  const compactUI = () => window.innerWidth <= 760 ||
    (window.innerHeight <= 520 && window.innerWidth <= 960);

  // ---------- 跟随镜头状态 ----------
  // follow 保存「相机相对选中天体的偏移」，而不是绝对相机坐标：天体每帧沿轨道
  // 移动，把偏移加到它当前的世界坐标上就是新相机位置，飞行途中也不会飞到空点。
  let follow = null;
  const followBadge = document.createElement('div');
  followBadge.id = 'followBadge';
  followBadge.style.display = 'none';
  document.body.appendChild(followBadge);

  const gui = new dat.GUI({ autoPlace: false });
  // 移动端默认收起控制面板：手机上右上角那一大块会盖住大半个屏幕
  if (compactUI()) { try { gui.close(); } catch (_) {} }
  const guiContainer = document.getElementById('gui-container');
  if (guiContainer) guiContainer.appendChild(gui.domElement);
  // 双星周期可以从 2.87 天到 467 年，固定 200 天/秒的上限会让长周期系统
  // 几分钟都走不完一圈。上限按系统自身倍率的 8 倍放宽，仍保留 200 的地板。
  const timeCtrl = gui.add(settings, 'timeScale', 0, system.timeScaleMax ?? 200).name(t('timeScale'));
  gui.add(settings, 'followMotion').name(t('followMotion')).onChange(() => {
    refreshPause();
    if (follow && selected) {
      updateFollowBadge(selected);
      const box = document.getElementById('planetInfo');
      if (box && box.style.display !== 'none') showInfo(selected);
    }
  });
  // dat.GUI 自带 "Close Controls / Open Controls"：清空 DOM 原文，
  // 视觉文案全部交给 CSS 伪元素（按 html[lang] 切换）。它在展开/收起时会
  // 重写文本，所以用 observer 持续清空，避免英文混进中文界面或读屏内容。
  const guiClose = gui.domElement.querySelector('.close-button');
  if (guiClose) {
    guiClose.classList.add('localized');
    const clearGuiText = () => { if (guiClose.textContent.trim()) guiClose.textContent = ''; };
    clearGuiText();
    new MutationObserver(clearGuiText).observe(guiClose, {
      childList: true, characterData: true, subtree: true,
    });
  }

  // ---------- 视觉放大（仅放大天体尺寸，轨道比例不变）----------
  // 默认 1 = 物理推导尺寸（严谨模式）。调大可让原本不足 1 像素的小卫星清晰可见。
  // 中心天体（无轨道者）不参与放大，避免高倍率下膨胀到吞掉自家卫星轨道。
  settings.bodyExaggeration = system.scale?.bodyExaggeration ?? 1;
  gui.add(settings, 'bodyExaggeration', 1, 15, 0.5)
    .name(t('bodyExaggeration'))
    .onChange((v) => {
      setBodyExaggeration(system, v);
      applyExaggerationToNodes(nodes, v);
      setCurrentExaggeration(v);
    });

  // 彗尾强度：彗星只在接近太阳时才活动，长周期彗星在远日点要"等很久"才亮起来。
  // 这个滑块只放大尾巴的长度与亮度，不改变活动规律（仍严格按 1/r² 随日心距变化）。
  if (system.bodies.some((b) => b.comet)) {
    settings.tailGain = 1;
    gui.add(settings, 'tailGain', 0.5, 3, 0.1).name(t('tailGain'));
  }

  // 左下角「视觉放大 ×N（比例不变）」角标已按需求彻底移除：
  // 它既挡视野又对理解 3D 画面没有帮助，放大倍数仍可在右上角控制面板里看到。
  if (views.length > 1) {
    const labels = views.map((v) => viewName(v.label));
    // 默认选中与 camera.frameTo 对应的那一档（views[0] 不一定就是默认视角）；
    // 支持 ?view=<id> 直接指定初始档位（截图 / 嵌入 iframe 时想停在某个范围）
    const want = new URLSearchParams(location.search).get('view');
    // body 直达时忽略 view：applyView 会把 selected 清空并开始飞行，
    // 覆盖掉下面刚做好的天体聚焦。聚焦本身已经把相机放到该天体旁，无需再取景。
    const byUrl = want && !deepBody ? views.findIndex((v) => v.id === want) : -1;
    const defId = byUrl >= 0 ? byUrl
      : views.findIndex((v) => v.frameTo === (system.camera?.frameTo ?? 'auto'));
    settings.view = labels[Math.max(0, defId)];
    // applyView 依赖后面才声明的 flyPos/flyTarget，放到下一轮再飞，避免 TDZ
    if (byUrl >= 0) setTimeout(() => applyView(byUrl), 0);
    gui.add(settings, 'view', labels).name(t('viewRange')).onChange((label) => {
      const i = labels.indexOf(label);
      if (i >= 0) applyView(i);
    });
  }
  if (system.hasSun) {
    gui.add(settings, 'sunIntensity', 1, 10).name(t('sunIntensity')).onChange((v) => {
      sunMat.emissiveIntensity = v;
    });
  }

  // ---------- 拾取与信息卡 ----------
  const raycaster = new THREE.Raycaster();
  // 深空点云是点云，需放宽 Points 射线阈值（场景单位=kpc，0.6 即约 0.6 kpc 内可命中）
  raycaster.params.Points.threshold = 0.6;
  const mouse = new THREE.Vector2();
  let raycastTargets = [];
  function refreshTargets() {
    raycastTargets = [];
    for (const n of nodes) {
      // 深空天体在银河系尺度上只是一个点：刻意不参与 3D 拾取，
      // 入口统一放在左侧菜单（用户点的就是菜单），也避免误点/描边干扰
      if (n.deepSky) continue;
      if (n.mesh) raycastTargets.push(n.mesh);
      if (n.atmosphere) raycastTargets.push(n.atmosphere);
      if (n.ring) raycastTargets.push(n.ring);
      // 彗核只有几个像素，靠彗发提供可点击的面积；尾巴不参与拾取，
      // 否则巨大的锥体会挡住后面天体的点击，且描边效果会很怪
      if (n.comet) raycastTargets.push(n.comet.coma);
      if (n.halo) raycastTargets.push(n.halo);
      if (n.pick) raycastTargets.push(n.pick);   // 宇宙层级页的透明点击热区
      if (n.model) n.model.traverse((c) => { if (c.isMesh) raycastTargets.push(c); });
    }
    if (sunMesh) raycastTargets.push(sunMesh);
    if (deepSkyCloud) raycastTargets.push(deepSkyCloud); // 深空点云：射线按 point index 命中
  }
  refreshTargets();
  setTimeout(refreshTargets, 1500); // glb 异步加载完成后再刷新

  const infoById = new Map();
  for (const def of system.bodies) infoById.set(def.id, def);
  // 太阳不在 system.bodies 里（单独建的 sunMesh），但也要纳入"可点选/可聚焦"清单
  if (system.hasSun) {
    infoById.set('sun', { id: 'sun', name: '太阳', size: system.scale?.sunUnits ?? 18 });
  }

  // 矮行星 id 集合：用于左侧菜单的类型着色（避免逐个解析 info 文本）
  const DWARF = new Set(['ceres', 'pluto', 'haumea', 'makemake', 'eris']);
  function bodyType(b) {
    if (b.barycenter) return 'barycenter';
    if (b.deepSky) {
      if (b.deepSky.kind === 'cluster') return 'cluster';
      if (b.deepSky.kind === 'blackhole') return 'blackhole';
      return 'nebula';
    }
    if (b.comet) return 'comet';
    if (b.navGroup === '系外行星系统') return 'exoplanet';
    if (b.navGroup === '疏散星团') return 'opencluster';
    // 层级恒星系统成员的物理类别（白矮星 / 黑洞 / 环双星行星）。
    if (b.bodyKind === 'blackhole') return 'blackhole';
    if (b.bodyKind === 'whitedwarf') return 'pulsar';
    if (b.bodyKind === 'planet') return 'exoplanet';
    // 点天体按物理类别着色：脉冲星/白矮星、聚星成员、恒星级黑洞。
    // 它们仍带 star:true 复用自发光点材质，但菜单圆点与名字标签要能区分。
    if (b.pointOnly && b.pointKind === 'pulsar') return 'pulsar';
    if (b.pointOnly && b.pointKind === 'member') return 'member';
    if (b.pointOnly && b.pointKind === 'blackhole') return 'blackhole';
    if (b.star) return 'star';
    if (b.parent) return 'moon';
    if (DWARF.has(b.id)) return 'dwarf';
    return 'planet';
  }

  // 取某天体的聚焦目标对象（mesh / glb 模型 / 彗发 / 太阳）
  function focusObjectOf(id) {
    if (system.hasSun && id === 'sun') return sunMesh;
    const n = byId.get(id);
    if (!n) return null;
    return n.mesh || n.model || (n.comet && n.comet.coma) || null;
  }

  // 左侧菜单选中高亮
  const navRows = new Map();
  const navGroups = new Map();   // 分组标题 → DOM，切档时整组为空就隐藏
  const labelRows = new Map();   // 天体名字标签：id → { el, node, w, h }
  let labelLayer = null;
  function highlightNav(id) {
    for (const [rid, row] of navRows) row.classList.toggle('active', rid === id);
    for (const [rid, row] of labelRows) row.el.classList.toggle('active', rid === id);
  }

  // ---------- 比例尺分档（仅银河系页启用）----------
  // 核心机制：世界坐标（真实相对位置）永远不动，相机距离按 10× 递减；
  // 同时把所有「示意尺寸」（锚点球、光晕、展示物）也按 10× 递减，
  // 于是占屏大小恒定，而天体间的角距离逐档放大 —— 大档看远处结构，
  // 小档近处恒星才一个个分离出来。背景点云始终保留，只把点大小钳成屏幕像素。
  const TIERS = system.scaleTiers ?? null;
  let currentTier = 0;
  const tierFocus = new THREE.Vector3(0, 0, 0);
  const tierCamDist = (i) =>
    (TIERS[i].radiusKpc / Math.tan((camera.fov * DEG) / 2)) * (system.camera?.fitMargin ?? 1.25);

  // 所有示意尺寸随档位同比缩小；当前激活的展示物额外放大一点，便于在背景里辨认
  function applyTierScale(i) {
    if (!TIERS) return;
    // 严格 10^-i 会让占屏恒定，但全景档的深空点本来就只有 0.33% 屏高，
    // 到小档仍是 3px 的针尖，等于「什么都看不见」。用 0.8 次幂让它逐档
    // 缓慢变大（占屏 ∝ 10^0.2i，第 4 档约 6 倍），既看得清又绝不会膨胀成大球。
    const f = Math.pow(10, -i * 0.8);
    // 银河系的恒星锚点例外：严格 10^-i 同比缩小 = 占屏尺寸恒定。上面那个
    // 0.8 次幂会让点逐档膨胀（第 5 档约 6 倍），1 万光年档里挤在太阳附近的
    // 十几个恒星光晕就会叠成一团白斑。锚点在任何档位都该只是「一个点」，
    // 真正的球面交给 star-portrait 在 1 光年内单独显形。
    const fPoint = Math.pow(10, -i);
    for (const [, node] of byId) {
      const k = (node.def?.star && node.def?.fixedSize) ? fPoint : f;
      if (node.mesh) node.mesh.scale.setScalar((node.def?.size ?? 0.07) * k);
      if (node.halo) node.halo.scale.setScalar((node.def?.glowSize ?? 0.4) * k);
      if (node.pick) node.pick.scale.setScalar((node.def?.pickSize ?? 0.6) * k);
    }
    for (const [, sc] of deepSkyShowcases) {
      // 聚焦时只略放大（1.6×）便于辨认，不再 3× 铺满；移动端再收 0.7×，
      // 否则星云 sprite 在窄屏里占比过大（这正是之前「星云还是过大」的主因之一）。
      const boost = (sc.visible ? 2.2 : 1) * (compactUI() ? 0.7 : 1);
      sc.scale.setScalar((sc.userData.baseScale ?? 1) * f * boost);
      sc.traverse((o) => { if (o.isPoints) o.material.size = 0.035 * f * boost; });
    }
  }

  // 每档只显示「距离尺度匹配」的天体：太远的在画面外，太近的与太阳重合。
  // 窗口刻意留重叠，切档时天体渐次出现/退场，不会整屏跳变。
  function updateTierVisibility(i, spanOverride = null) {
    if (!TIERS) return;
    // 跟随态一律交给 updateBackdropVisibility() 的**视锥**判定：不再按「到焦点
    // 的距离 <= 视野跨度」裁天体。三维空间里 1 光年视野同样能看见 100 光年外
    // 的天体，距离窗口正是「小尺度只剩一个孤点」的根因。
    if (follow) return;
    const span = spanOverride ?? TIERS[i].spanLy;
    const visibleGroups = new Set();
    const forceId = selected?.id ?? null;
    for (const [sid, node] of byId) {
      let show;
      {
        const dLy = node.def?.dLy;
        // 下限取视野的 0.5%：比这更近的天体在该档里必然与太阳/彼此重合，
        // 显示出来只会误导（例如 10 万光年档列出 4 光年的比邻星）。
        // 点天体不设**距离上限**：空间是三维的，1 光年视野里照样看得见
        // 100 光年乃至 16 万光年外的天体，按「离焦点多远」裁掉它们正是
        // 「背景只剩孤零零一个点」的根因。3D 可见性仍由视锥判定收口。
        const pointOnly = node.def?.pointOnly === true;
        show = sid === forceId || dLy == null || dLy === 0 ||
          (dLy >= span * 0.005 && (pointOnly || dLy <= span * 1.5));
      }
      if (node.group) node.group.visible = show;
      const row = navRows.get(sid);
      if (row) {
        row.style.display = show ? '' : 'none';
        if (show && row.dataset.group) visibleGroups.add(row.dataset.group);
      }
    }
    for (const [name, el] of navGroups) {
      el.style.display = visibleGroups.has(name) ? '' : 'none';
    }
  }

  // 分类目录点云（HYG/OpenNGC）本质是「以太阳为原点的邻域星表」，若在全景档全亮，
  // 会盖过银河系结构、让本页看起来像「太阳系周边」而非「银河系」。这里按比例尺分档
  // 淡出：总览档(0)完全隐藏，越放大到本地邻域档位越清晰——既让本页一眼是银河，
  // 又保留真实星表作为缩放下钻细节。
  function updateCatalogCloudFade(i) {
    if (!catalogClouds.length) return;
    const FADE = [0.0, 0.3, 0.55, 0.75, 0.9, 1.0];
    const f = FADE[Math.min(i, FADE.length - 1)] ?? 1.0;
    for (const c of catalogClouds) {
      const base = c.userData.baseOpacity ?? 0.85;
      c.material.opacity = base * f;
      c.visible = f > 0.01;
    }
  }

  function applyTier(i, opts = {}) {
    if (!TIERS) return;
    i = Math.max(0, Math.min(TIERS.length - 1, i));
    currentTier = i;
    const dist = tierCamDist(i);
    if (opts.focus) tierFocus.copy(opts.focus);
    else if (i === 0) tierFocus.set(0, 0, 0);
    else {
      // 焦点必须取「太阳此刻的真实世界坐标」：galaxyGroup 在全景档会缓慢自转，
      // 直接用静态 sunPos 会差出几十光年，在小档（视野仅几光年）里天体全跑出画面。
      scene.updateMatrixWorld(true);
      // 银河系档聚焦太阳，宇宙各层聚焦该层的「观察原点」子节点（我们所在的链）。
      const focusNode = byId.get(system.tierFocusId ?? 'sun');
      if (focusNode?.group) focusNode.group.getWorldPosition(tierFocus);
      else tierFocus.set(...(system.sunPos ?? [0, 0, 0]));
    }
    // 跟随中切档（滚轮跨 10×）：焦点必须是目标天体「此刻」的位置，
    // 不能用静态观察原点，否则镜头会被甩回太阳附近。
    if (follow) {
      scene.updateMatrixWorld(true);
      follow.object.getWorldPosition(tierFocus);
    }
    // 未跟随时保留小档冻结；跟随中时间照常推进，镜头会一直咬住目标。
    refreshPause();

    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() === 0) dir.set(0, 0.62, 1);
    dir.normalize();
    const dest = tierFocus.clone().add(dir.multiplyScalar(dist));
    if (opts.instant) {
      controls.target.copy(tierFocus);
      camera.position.copy(dest);
      camera.lookAt(tierFocus);
      flying = false;
    } else {
      flyPos.copy(dest);
      flyTarget.copy(tierFocus);
      flying = true;
      isMoving = false;
      isZoomingOut = false;
    }

    // 每档独立 near/far。renderer 已开 logarithmicDepthBuffer，近到 1e-7 也不 z-fighting。
    camera.near = Math.max(1e-7, TIERS[i].radiusKpc * 1e-4);
    camera.far = 200;
    camera.updateProjectionMatrix();
    controls.minDistance = dist * 0.08;   // 允许一路缩到 base/10，跨满 10× 才切内档
    controls.maxDistance = dist * 2.0;    // 往外退到 2× 即到顶切外档（zoomOutTo 约定）
    // 默认每次滚轮只缩 0.95 倍，跨 10× 要滚 ~45 格，手感太钝。
    controls.zoomSpeed = 2.5;   // 每格 0.95^2.5 ≈ 0.88：内滚约 15 格、外滚约 5 格

    applyTierScale(i);
    updateTierVisibility(i);
    updateCatalogCloudFade(i);
    updateScaleBarUI(i);

    // 背景层永不隐藏：小档把银盘点云切成固定 1.6px 的屏幕空间星点，
    // 既不随相机贴近膨胀成 bokeh 球，又能一直看到银河系的星光。
    if (galaxyField) {
      // 背景点云可能是单 Points（银盘/普通宇宙网）或一个 Group
      // （可观测宇宙：主点云 + 独立的星点视界球壳 + 半透明边界球）。
      // 遍历其中所有 Points，跳过标记为 shell 的视界球壳——它用固定屏幕尺寸，
      // 不能切回透视，否则离相机远的壳点会缩成看不见。
      const wantAtten = i === 0;
      const baseSize = system.galaxy?.pointSize ?? 0.2;
      galaxyField.traverse((o) => {
        if (!o.isPoints) return;
        if (o.userData.shell) return;
        const m = o.material;
        if (m.sizeAttenuation !== wantAtten) {
          m.sizeAttenuation = wantAtten;
          m.needsUpdate = true;
        }
        m.size = wantAtten ? baseSize : 1.6;
      });
    }
    // 银盘整体柔光是 15 kpc 尺度的东西，小档只会糊满屏；点云本身仍保留。
    if (galaxyGlow) galaxyGlow.visible = i === 0;
    // 星系肖像：盘面贴图只在前两档显示，再放大就只留恒星颗粒（贴图会糊成一片）；
    // 盘内点同样钳成屏幕空间像素，避免近距离膨胀成彩色光斑。
    if (portrait) {
      const atten = i === 0;
      const R = portrait.config.radius;
      const sizes = [R * 0.0055, R * 0.010];
      const fixed = [1.6, 2.4];
      portrait.diskPointLayers.forEach((layer, k) => {
        const m = layer.material;
        if (m.sizeAttenuation !== atten) { m.sizeAttenuation = atten; m.needsUpdate = true; }
        m.size = atten ? sizes[k] : fixed[k];
      });
      portrait.disc.visible = i <= 1;
      portrait.disc.material.opacity = i === 0 ? 1 : 0.42;
    }
    // 大小麦哲伦云在 5~6 万光年外，只有全景档该看见；否则 10 光年视野的
    // 角落会挂着一颗几万光年外的模糊光斑，破坏尺度感。
    for (const dg of distantGalaxyObjs) dg.visible = i === 0;
  }

  // 深空天体的放大展示物：同一时刻只显示一个。背景与周围天体一概不隐藏，
  // 靠上面的屏幕空间尺寸钳制解决「近距离变成大白球」的问题。
  function setActiveShowcase(id) {
    for (const [sid, sc] of deepSkyShowcases) sc.visible = (sid === id);
    applyTierScale(currentTier);
  }

  // ---------- 恒星近景：真实半径 + 三维视锥背景 + 连续缩放 ----------
  // 球半径就是真实半径（R☉ = 7.3535e-8 光年），不再是 0.05 光年的示意封顶。
  // 于是「大尺度只能是点」「一帧最多一颗球」都由物理尺度自动成立。
  //
  // 关键修正：空间是三维的。相机贴在 9R 处时，几百光年外的天体**仍然在视锥里**，
  // 只要视线方向对得上就能当背景看到。旧实现按「到焦点的距离 <= 视野跨度」裁天体，
  // 把三维星空削成一个空壳，再靠「按邻居距离自动跳档」补背景，方向整个错了。
  // 现在背景靠四件事：视锥判定、按各自距离反算屏幕像素、自动挑背景方位、连续缩放。
  const _portraitWp = new THREE.Vector3();
  const _focusWp = new THREE.Vector3();
  const _bodyWp = new THREE.Vector3();
  const _portraitCandidates = [];
  /** 恒星特写态：{ defId, radiusLy, minLy, maxLy, backdrops, backdropIndex }。
   *  星云 / 星团等非恒星聚焦同样享受视锥背景，只是没有 9R 特写与方位轮换。 */
  let closeup = null;
  let lastVisibilitySpan = 0;  // 上次刷新比例尺文案时的视野跨度
  let lastNear = -1;
  let backdropCount = 0;       // 当前视锥内的天体数（含焦点本身）

  const _ndcCam = [0, 0, 0];
  const _ndcTarget = [0, 0, 0];
  const _ndcPoint = [0, 0, 0];
  const _ndcUp = [0, 1, 0];
  function viewAspect() {
    return Math.max(0.4, window.innerWidth / Math.max(1, window.innerHeight));
  }
  /** 世界坐标 → NDC。用 backdrop.js 的显式相机基，不依赖渲染前的矩阵刷新时序。 */
  function projectBody(wp) {
    _ndcCam[0] = camera.position.x; _ndcCam[1] = camera.position.y; _ndcCam[2] = camera.position.z;
    _ndcTarget[0] = controls.target.x; _ndcTarget[1] = controls.target.y; _ndcTarget[2] = controls.target.z;
    _ndcPoint[0] = wp.x; _ndcPoint[1] = wp.y; _ndcPoint[2] = wp.z;
    return projectToNdc(_ndcCam, _ndcTarget, _ndcUp, _ndcPoint,
      camera.fov, viewAspect(), 1.02);
  }

  /**
   * 跟随态的可见性 = 视锥，而不是「离焦点多远」。
   * 1 光年视野里照样看得见 100 / 550 光年外的天体；旋转镜头，入画的背景随之变化。
   */
  function updateBackdropVisibility() {
    // 自由视角也要按视锥刷新：退出跟随后，远处天体不会因为「档位距离窗口」
    // 被整体清空，星空始终是三维的；转镜头时入画集合随之变化。
    if (!TIERS) return 0;
    // 不再每帧强制全场景矩阵更新：下面每个 body 的 getWorldPosition 自带向上
    // 刷新其父链，composer.render() 渲染前也会统一更新一次。去掉这行可省掉每帧
    // 一次 O(全场景) 的矩阵重算（银河场有上千点），是真实 GPU 上的卡顿源。
    let count = 0;
    for (const [id, node] of byId) {
      node.group.getWorldPosition(_bodyWp);
      const show = projectBody(_bodyWp).inFrame;
      node.group.visible = show;
      if (show) count++;
      // 跟随态左侧菜单保留全部条目：拖视角时菜单不闪，且随时能点去别的天体。
      // 自由态仍沿用各档自己的菜单过滤，不在这里改写。
      if (follow) {
        const row = navRows.get(id);
        if (row) row.style.display = '';
      }
    }
    if (follow) for (const [, el] of navGroups) el.style.display = '';
    backdropCount = count;
    return count;
  }

  /**
   * 所有锚点按**自身到相机的距离**反算世界尺寸，于是每颗都是恒定屏幕像素的点：
   * 近处的球由 star-portrait 接管，550 光年外的太阳也还是一枚清晰亮点，
   * 不会因为「统一按焦点距离缩放」被压成 1/550 像素而消失。
   */
  function applyFocusAnchorScale() {
    const H = Math.max(1, window.innerHeight);
    for (const [id, node] of byId) {
      node.group.getWorldPosition(_bodyWp);
      const D = camera.position.distanceTo(_bodyWp);
      const px = pointWorldSize(D, camera.fov, H, 1);
      // 太阳是大家最能认出来的方向锚：在背景里稍亮一点，心宿二特写时
      // 「远远看到太阳」不只是数据成立，画面里也找得到。
      const boost = (id === 'sun' && follow?.id !== 'sun') ? 1.7 : 1;
      if (node.mesh) node.mesh.scale.setScalar(Math.max(px * 1.5 * boost, 1e-18));
      if (node.halo) node.halo.scale.setScalar(Math.max(px * 7 * boost, 1e-18));
      if (node.pick) node.pick.scale.setScalar(Math.max(px * 20, 1e-18));
    }
  }

  /** 点天体没有球面可以贴脸看：最小取 1e-4 光年（约 6 AU），再近只剩浮点噪声。 */
  const POINT_MIN_LY = 1e-4;

  /** 连续缩放的光年上下限：恒星 9R 特写、点天体、普通跟随各用自己的一组。 */
  function zoomBounds() {
    return {
      minLy: closeup?.minLy ?? (selected?.pointOnly ? POINT_MIN_LY : 1e-9),
      maxLy: closeup?.maxLy ?? 1e5,
    };
  }

  /** 连续缩放的相机距离上下限（OrbitControls.update 会 clamp，必须同步放宽）。 */
  function setContinuousZoomRange() {
    if (!TIERS) return;
    const { minLy, maxLy } = zoomBounds();
    controls.minDistance = Math.max(1e-15, minLy * UNITS_PER_LY);
    controls.maxDistance = maxLy * UNITS_PER_LY * 1.3;
  }

  /** 相机到焦点（跟随目标）的距离，光年。 */
  function focusDistanceLy() {
    return camera.position.distanceTo(controls.target) / UNITS_PER_LY;
  }

  /** 用真实三维坐标算出若干「让最多远处天体入画」的视线方向。 */
  function buildBackdrops(def, obj) {
    scene.updateMatrixWorld(true);
    obj.getWorldPosition(_focusWp);
    const bodies = [];
    for (const [id, node] of byId) {
      if (id === def.id || !node.group) continue;
      node.group.getWorldPosition(_bodyWp);
      bodies.push({
        id,
        pos: [_bodyWp.x, _bodyWp.y, _bodyWp.z],
        // 太阳 / 银心是大家最认得出的方向锚，权重略高，让默认背景不是随机星点
        weight: (id === 'sun' || id === 'sagA') ? 2.4 : (node.def?.deepSky ? 1.6 : 1),
      });
    }
    return backdropOptions([_focusWp.x, _focusWp.y, _focusWp.z], bodies, {
      fovDeg: camera.fov, aspect: viewAspect(), limit: 6, coreId: 'sun',
    });
  }

  /** 视线方向 → 相机站位向量（站在背景群反方向，略微抬高视线，画面更有纵深）。 */
  function standDirection(b) {
    const v = new THREE.Vector3(-b[0], -b[1], -b[2]);
    if (v.lengthSq() < 1e-20) v.set(0, 0.42, 1);
    v.normalize();
    v.y += 0.16;
    return v.normalize();
  }

  /** 平滑飞到某个尺度：交给 updateFollow 的指数收敛，方向仍尊重用户拖拽。 */
  function flyFocusTo(ly) {
    if (!follow) return;
    const dUnits = Math.max(1e-15, ly * UNITS_PER_LY);
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-30) dir.set(0, 0.42, 1);
    follow.want.copy(dir.normalize().multiplyScalar(dUnits));
    isMoving = true;
  }

  // 「换个背景」按钮与方位轮换函数已移除：背景方位只在进入特写时于后台
  // 随机挑选一次，之后视角完全交给鼠标。旧实现每次点击都把相机强行摆回某个
  // 预设方位（camera.position / follow.offset / follow.want 全被覆写），用户拖出来的方向会被覆盖，
  // 观感上就是「视野被锁住」。

  function updateStarPortraits(dtSec) {
    if (!starPortraits.size || !TIERS) return;
    const dCamLy = focusDistanceLy();
    const span = effectiveSpanLy(dCamLy, camera.fov);
    _portraitCandidates.length = 0;
    for (const [id, p] of starPortraits) {
      if (!p.node.group.visible) {
        _portraitCandidates.push({ id, dLy: Infinity, radiusLy: 0, dUnits: Infinity, visible: false });
        continue;
      }
      p.node.group.getWorldPosition(_portraitWp);
      const dUnits = camera.position.distanceTo(_portraitWp);
      _portraitCandidates.push({
        id, dUnits,
        dLy: dUnits / UNITS_PER_LY,
        radiusLy: starRadiusLy(p.def.radiusSun),
        visible: true,
      });
    }
    const winner = selectStarPortrait(_portraitCandidates, span);
    for (const c of _portraitCandidates) {
      const p = starPortraits.get(c.id);
      if (c.id !== winner) { p.group.visible = false; continue; }
      const a = portraitOpacity(c.dLy, c.radiusLy);
      if (a < 0.01) { p.group.visible = false; continue; }
      p.group.visible = true;
      p.group.scale.setScalar(portraitRadius(p.def.radiusSun, c.dUnits, UNITS_PER_LY));
      p.sphere.material.opacity = a;
      p.sphere.rotation.y += dtSec * 0.05;   // 光球缓慢自转，特写里不至于死板
      // 加法混合下 opacity 不可靠，色球 / 日冕直接按可见阈值开关
      p.rim.visible = p.corona.visible = a > 0.15;
    }

    // 跟随态与自由态都按视锥刷新背景与屏幕空间点尺寸：旋转视角会改变入画集合，
    // 退出跟随后天体也不会被「档位距离窗口」整体清空。
    updateBackdropVisibility();
    applyFocusAnchorScale();
    // 近裁剪面跟着取景尺度走，而不是钉死在 1e-10：9R 特写时它是 1e-9 量级，
    // 回到宏观档位自动放大，far/near 比不再长期悬在 1e11，远景星点不会被深度精度吃掉。
    if (TIERS) {
      const dUnits = Math.max(1e-12, camera.position.distanceTo(controls.target));
      // near 必须跟着取景尺度走，不能钉死在 1e-9：比邻星 / 南门二这类小恒星的
      // 特写距离只有 1e-10~3e-11 单位，1e-9 的硬下限会把整颗球裁在近裁剪面之外
      // （JS 里 group.visible=true，画面上却根本看不到球）。renderer 已开
      // logarithmicDepthBuffer，near 取 1e-13 量级也不会损失背景深度精度。
      const near = Math.max(1e-13, dUnits * 0.01);
      if (Math.abs(near - lastNear) > near * 0.05) {
        camera.near = near;
        camera.far = 200;
        camera.updateProjectionMatrix();
        lastNear = near;
      }
    }
    // 比例尺文案按真实视野刷新（节流），不再驱动任何可见性 / 跳档逻辑。
    if (!lastVisibilitySpan || Math.abs(span - lastVisibilitySpan) > lastVisibilitySpan * 0.03) {
      lastVisibilitySpan = span;
      updateScaleBarUI(currentTier, span);
      updateBackdropUI();
    }
  }

  /** 聚焦恒星（菜单 / 3D 拾取 / 外链 / hash 共用）：一次性把镜头放到 9×真实半径，
   *  让球从第一帧就显形，方位挑一个「远处天体落进画面」的方向。
   *  这里只是**取景动作**，不是常驻的「特写模式」：不再强跳最内档，也不再把
   *  近裁剪面 / 缩放范围钉死，之后视角完全交给鼠标，随时可拖、可缩、可退出。 */
  function setStarCloseup(def, obj) {
    if (!TIERS || !starPortraits.has(def.id)) return;
    const wp = new THREE.Vector3();
    obj.getWorldPosition(wp);
    const closeLy = closeupDistanceLy(def.radiusSun);
    const backdrops = buildBackdrops(def, obj);
    // 后台随机选一个背景方位，界面不暴露按钮、也不允许手动轮换。
    // 只在得分最高的前 3 个方位里随机：低分方位可能只入画 1~2 个天体，
    // 转过去就是一片黑，达不到「远处天体一直在星空里」的效果。
    const pool = Math.min(3, backdrops.length);
    const roll = backdrops.length > 1
      ? Math.floor(Math.random() * backdrops.length) % pool : 0;
    const backdropIndex = (backdrops[roll]?.ids?.length ?? 0) >= 4 ? roll : 0;
    const radiusU = starRadiusUnits(def.radiusSun);
    closeup = {
      defId: def.id,
      radiusLy: starRadiusLy(def.radiusSun),
      // 球退化成一个点的距离：超过它就没理由再把镜头锁在这颗星上（滚轮松绑用）。
      revealLy: revealDistanceLy(def.radiusSun),
      minLy: closeLy * 0.45,
      maxLy: 1e5,                  // 兜底：一路连续缩回 10 万光年才退出
      backdrops,
      backdropIndex,
    };

    const closeU = closeLy * UNITS_PER_LY;
    controls.enableZoom = false;  // 滚轮改由 continuousZoom 接管，避免双重 dolly
    setContinuousZoomRange();     // 统一的连续缩放范围，不为特写另设 clamp
    controls.minDistance = Math.max(controls.minDistance, radiusU * 1.25); // 不允许钻进球里
    lastNear = -1;                // 下一帧按当前取景距离重算近裁剪面

    const b = closeup.backdrops[closeup.backdropIndex]?.dir ?? [0, 0.42, 1];
    const want = standDirection(b).multiplyScalar(closeU);
    controls.target.copy(wp);
    camera.position.copy(wp).add(want);
    camera.lookAt(wp);
    if (follow) {
      follow.want.copy(want);
      follow.offset.copy(want);
      follow.lastPos.copy(wp);
    }
    lastVisibilitySpan = effectiveSpanLy(closeLy, camera.fov);
    updateBackdropVisibility();
    applyFocusAnchorScale();
    updateScaleBarUI(currentTier, lastVisibilitySpan);
    updateBackdropUI();
  }

  // （setPointFocus 已移除：点击统一只做「定位」，不再按距离自动切档；见 selectBody）

  // 选中并飞向某个天体（菜单点击 / 3D 拾取共用）
  // 统一策略：点击 = 在「当前尺度」下把镜头对准该天体的位置（定位），不切档、不自动进近照。
  // 近照（恒星 9R 球面特写 / 太阳系·聚星系统下钻）改为信息卡里的按钮按需进入（见 showInfo）。
  function selectBody(id, opts = {}) {
    const def = infoById.get(id);
    const obj = focusObjectOf(id);
    if (!def || !obj) return;
    selected = def;
    if (TIERS) {
      closeup = null;   // 换天体时清掉上一颗的特写态；点击统一只做定位，不自动进近照
      const wp = new THREE.Vector3();
      obj.getWorldPosition(wp);
      // 定位：保持当前档位（尺度不变），仅把焦点移到该天体 —— 仍身处银河系，只是看清楚它在哪
      beginFollow(def, obj, null, 'keep');
      applyTier(currentTier, { instant: true, focus: wp });
    } else {
      focusOn(def, obj);
    }
    setActiveShowcase(id);
    highlightNav(id);
    if (TIERS) showInfo(def);
  }

  // 构建左侧天体快捷菜单：列出当前系统所有天体，点击即切到对应视角
  function buildBodyNav() {
    const nav = document.createElement('div');
    nav.id = 'bodyNav';
    nav.className = 'body-nav';

    const head = document.createElement('div');
    head.className = 'bn-head';
    const title = document.createElement('div');
    title.className = 'bn-title';
    title.textContent = systemName(system.label ?? system.id);
    head.appendChild(title);
    // 折叠按钮全尺寸可用：桌面也能收起左侧栏把 3D 主屏让出来；
    // 手机（竖屏/横屏）默认收起，只留标题栏，点一下展开。
    const bnToggle = document.createElement('button');
    bnToggle.type = 'button';
    bnToggle.className = 'bn-toggle';
    const syncBnToggle = () => {
      const collapsed = nav.classList.contains('collapsed');
      bnToggle.textContent = collapsed ? t('navExpand') : t('navCollapse');
      bnToggle.setAttribute('aria-label', bnToggle.textContent);
    };
    bnToggle.onclick = (e) => { e.stopPropagation(); nav.classList.toggle('collapsed'); syncBnToggle(); };
    head.appendChild(bnToggle);
    // 上级 / 跨层级导航统一交给顶部的宇宙导航条（面包屑 + 上下级 + 宇宙地图）。
    // 这里不再塞只认 parentSystem 的返回按钮 —— 那正是「太阳系回不去银河系」的根因。
    nav.appendChild(head);
    if (compactUI()) nav.classList.add('collapsed');
    syncBnToggle();
    // 星系肖像页：用一句话点出这个星系的真实形态，和画面互相印证
    if (system.portraitCaption) {
      const cap = document.createElement('div');
      cap.className = 'bn-caption';
      cap.textContent = system.portraitCaption;
      nav.appendChild(cap);
    }

    const list = document.createElement('div');
    list.className = 'bn-list';
    const entries = [];
    if (system.hasSun) entries.push({ id: 'sun', name: t('nameSun'), type: 'sun' });
    for (const b of system.bodies) entries.push({ id: b.id, name: bodyName(b), type: bodyType(b), def: b });

    let lastGroup = null;
    for (const e of entries) {
      // 分组标题（银河系深空天体按类型分组；其它系统页无 navGroup，行为完全不变）
      const grp = e.def?.navGroup ?? null;
      if (grp && grp !== lastGroup) {
        const h = document.createElement('div');
        h.className = 'bn-group';
        h.textContent = groupName(grp);
        list.appendChild(h);
        navGroups.set(grp, h);
        lastGroup = grp;
      }
      const row = document.createElement('div');
      row.className = 'bn-item type-' + e.type;
      row.dataset.group = grp ?? '';
      const dot = document.createElement('span');
      dot.className = 'bn-dot';
      const name = document.createElement('span');
      name.className = 'bn-name';
      name.textContent = e.name;
      row.appendChild(dot);
      row.appendChild(name);
      // 银河系页：菜单里直接标出距离，切档时一眼看出「这一档在看多远」
      if (e.def?.dLy != null && e.def.dLy > 0) {
        const dist = document.createElement('span');
        dist.className = 'bn-dist';
        dist.textContent = e.def.distanceText ?? distText(e.def.dLy);
        row.appendChild(dist);
      }
      row.onclick = () => selectBody(e.id);
      // 有下钻入口的天体：行内标签直达（行星→"卫星系"，太阳→"太阳系"等，可用 childSystemLabel 覆盖）
      if (e.def && e.def.childSystem) {
        const go = document.createElement('span');
        go.className = 'bn-go';
        const goLabel = systemName(e.def.childSystemShort ?? e.def.childSystemLabel ?? t('childGo'));
        go.textContent = goLabel;
        go.title = t('childTitle', goLabel);
        go.onclick = (ev) => {
          ev.stopPropagation();
          window.location.href = universeHref(e.def.stellarSystem ?? e.def.id) ?? e.def.childSystem;
        };
        row.appendChild(go);
      }
      list.appendChild(row);
      navRows.set(e.id, row);
    }
    nav.appendChild(list);
    document.body.appendChild(nav);
  }

  let selected = null;
  let isMoving = false;
  let isZoomingOut = false;
  let paused = false;
  const homeVec = new THREE.Vector3(...homePosition);

  // ---------- AU 级恒星系统：真实互绕的时间控件 ----------
  // 长周期双星（如北河二 467 年）默认倍率会让一圈约 24 秒走完；这里额外给
  // 暂停与 ×2 / ÷2，方便把「两颗星确实在动、且始终分居质心两侧」看清楚。
  let clockPaused = false;
  let clockNowEl = null;
  let clockRateEl = null;
  let clockFrame = 0;
  if (system.orbitClock) {
    const bar = document.createElement('div');
    bar.id = 'orbitClock';
    bar.className = 'orbit-clock';
    bar.title = t('orbitClockTitle');

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'oc-btn oc-play';
    play.textContent = t('orbitClockPause');
    play.onclick = () => {
      clockPaused = !clockPaused;
      play.textContent = t(clockPaused ? 'orbitClockPlay' : 'orbitClockPause');
      bar.classList.toggle('paused', clockPaused);
    };

    const now = document.createElement('span');
    now.className = 'oc-now';
    const period = document.createElement('span');
    period.className = 'oc-period';
    period.textContent = t('orbitClockPeriod',
      system.orbitClock.shortestText ?? system.orbitClock.periodText);
    period.title = t('orbitClockPeriodHint', system.orbitClock.periodText);
    const rate = document.createElement('span');
    rate.className = 'oc-rate';

    // 多层级系统的成员数与层数：先把「这是几合星」说清楚，避免再被画成双星。
    const multi = document.createElement('span');
    multi.className = 'oc-multi';
    multi.textContent = t('orbitClockMultiplicity',
      system.orbitClock.multiplicity ?? 2, system.orbitClock.levelCount ?? 1);

    const setRateValue = (next) => {
      settings.timeScale = Math.min(system.timeScaleMax ?? 200, Math.max(0, next));
      rate.textContent = t('orbitClockRate', Math.round(settings.timeScale * 100) / 100);
      timeCtrl.updateDisplay();
    };
    const setRate = (factor) => setRateValue(settings.timeScale * factor);
    const slow = document.createElement('button');
    slow.type = 'button';
    slow.className = 'oc-btn';
    slow.textContent = '÷2';
    slow.title = t('orbitClockRate', '');
    slow.onclick = () => setRate(0.5);
    const fast = document.createElement('button');
    fast.type = 'button';
    fast.className = 'oc-btn';
    fast.textContent = '×2';
    fast.onclick = () => setRate(2);

    // 层级速率：每层周期差可达 5 个数量级（北河二 0.814 天 ↔ 1.4 万年），
    // 一套倍率不可能同时看清。按钮把时间基准切到指定层，一圈仍约 24 秒。
    const levelBtns = [];
    const levels = system.orbitClock.levels ?? [];
    if (levels.length > 1) {
      const box = document.createElement('span');
      box.className = 'oc-levels';
      levels.forEach((lv, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'oc-btn oc-level' + (i === 0 ? ' active' : '');
        btn.textContent = t('orbitClockLevel', i + 1);
        btn.title = t('orbitClockLevelTitle',
          (isEnglishLang() ? lv.labelEn : lv.labelZh),
          periodTextOf(lv.periodDays));
        btn.onclick = () => {
          setRateValue(lv.timeScale);
          for (const b of levelBtns) b.classList.toggle('active', b === btn);
        };
        levelBtns.push(btn);
        box.appendChild(btn);
      });
      bar.append(multi, box);
    } else {
      bar.append(multi);
    }

    // 跨层显示压缩开关：切回严格线性时内层会缩成点，这是真实尺度；
    // 用 URL 参数保存，便于分享与自动化验证。
    const scaleBtn = document.createElement('button');
    scaleBtn.type = 'button';
    scaleBtn.className = 'oc-btn oc-scale';
    scaleBtn.textContent = t(system.orbitClock.realScale
      ? 'orbitClockCompressed' : 'orbitClockReal');
    scaleBtn.title = t('orbitClockScaleTitle');
    scaleBtn.onclick = () => {
      const u = new URL(window.location.href);
      if (system.orbitClock.realScale) u.searchParams.delete('scale');
      else u.searchParams.set('scale', 'real');
      window.location.href = u.toString();
    };

    bar.append(play, now, period, rate, slow, fast, scaleBtn);
    document.body.appendChild(bar);
    clockNowEl = now;
    clockRateEl = rate;
    rate.textContent = t('orbitClockRate', Math.round(settings.timeScale * 100) / 100);
  }

  // ---------- 跟随镜头：时间不停，镜头跟着选中的天体走 ----------
  /** 统一决定时间是否冻结：跟随时默认继续推进，关掉开关才退回冻结观察。 */
  function refreshPause() {
    paused = follow ? !settings.followMotion : (TIERS ? currentTier > 0 : false);
  }

  function updateFollowBadge(def) {
    followBadge.textContent = t('following', bodyName(def), settings.followMotion) + '  ✕';
    followBadge.classList.toggle('paused', !settings.followMotion);
    followBadge.style.display = '';
  }

  /** 取景距离：小卫星按半径、彗星按尾长；菜单聚焦与外链即时聚焦共用一套公式。 */
  function followDistance(def) {
    const tailUnits = def.comet ? (def.comet.ionTailUnits ?? 100) : 0;
    // 深空展示物（星云/星团/黑洞）没有 size 字段，原来的 Math.max(undefined*8, ...)
    // 算出 NaN，相机飞到无穷，星云 sprite 直接糊满整屏——这正是「星云过大」的根因。
    // 按类型给一个能完整看见、又不铺满视野的视距。
    let base = def.cameraOffset ?? (def.size != null ? def.size * 8 : null);
    if (base == null) {
      if (def.deepSky?.kind === 'nebula') base = 3.4;
      else if (def.deepSky?.kind === 'cluster') base = 3.0;
      else if (def.deepSky?.kind === 'blackhole') base = 3.6;
      else base = 2;
    }
    return Math.max(base, tailUnits * 0.35, 2);
  }

  /**
   * 建立跟随。want 是期望的「相机 - 天体」偏移（世界坐标）；
   * mode = fly（飞近）/ instant（外链即时到位）/ keep（档位页保留当前取景距离）。
   */
  function beginFollow(def, object, want, mode = 'fly') {
    const wp = new THREE.Vector3();
    object.getWorldPosition(wp);
    const current = camera.position.clone().sub(wp);
    const target = (mode === 'keep' || !want) ? current.clone() : want.clone();
    follow = {
      id: def.id,
      object,
      want: target,
      offset: mode === 'fly' ? current.clone() : target.clone(),
      lastPos: wp.clone(),
      lastAngle: orbitAngle(wp),
    };
    isMoving = mode === 'fly';
    isZoomingOut = false;
    flying = false;
    if (TIERS) {
      // 滚轮缩放交给 continuousZoom：关掉 OrbitControls 自带的 dolly，
      // 同时放宽它的 min/max clamp，否则 update() 会把连续缩放拽回档位窗口。
      controls.enableZoom = false;
      setContinuousZoomRange();
    }
    refreshPause();
    updateFollowBadge(def);
    return wp;
  }

  function stopFollow() {
    const wasCloseup = !!closeup;
    // 退出前记下视野跨度：旧实现无条件 applyTier(0, instant)，把镜头从 9R
    // 特写一步拽回 10 万光年全景（相机、target、near、可见性全变）。
    const keepSpan = effectiveSpanLy(focusDistanceLy(), camera.fov);
    follow = null;
    isMoving = false;
    closeup = null;
    lastVisibilitySpan = 0;
    lastNear = -1;
    backdropCount = 0;
    controls.enableZoom = true;
    followBadge.style.display = 'none';
    refreshPause();
    // 从恒星特写退出 = 原地松绑。near / 锚点尺寸 / 可见性现在每帧都按当前
    // 视野自适应，不需要靠 applyTier 恢复；旧实现那样做会把相机瞬移到档位距离
    // （实测 0.09 ly → 1.67 ly），观感就是「一退出画面就跳、视野被锁住」。
    if (wasCloseup && TIERS) {
      const d = camera.position.distanceTo(controls.target);
      controls.minDistance = Math.max(1e-12, d * 0.02);
      controls.maxDistance = Math.max(d * 200, 60);
      let best = 0, bestD = Infinity;
      TIERS.forEach((tier, i) => {
        const dd = Math.abs(Math.log10(
          Math.max(keepSpan, 1e-15) / Math.max(tier.spanLy, 1e-15)));
        if (dd < bestD) { bestD = dd; best = i; }
      });
      currentTier = best;             // 只同步比例尺档位标签，不动相机
      updateScaleBarUI(best, keepSpan);
    }
    updateBackdropUI();
  }

  const _followPos = new THREE.Vector3();
  function updateFollow(dtSec) {
    if (!follow) return;
    follow.object.getWorldPosition(_followPos);

    // 方位角：目标几乎在原点（太阳 / 中心天体）时保持上一帧角度，
    // 免得 atan2 在原点附近的数值噪声把镜头甩飞。
    const planar = Math.hypot(_followPos.x, _followPos.z);
    const angle = planar > 1e-6 ? orbitAngle(_followPos) : follow.lastAngle;

    // 1) 先跟「上一帧写进去的偏移」比对，判断用户是否拖拽 / 缩放过镜头。
    //    必须在共转之前比：共转本身就会改变偏移，拿它比对会误判成用户操作。
    const before = follow.offset.clone();
    const actual = camera.position.clone().sub(follow.lastPos);
    // 阈值必须随取景尺度收缩：太阳系页相机偏移上百单位，0.01 足够滤掉阻尼噪声；
    // 但恒星特写时整段偏移只有 1e-8~1e-11 单位（老人星 1.44e-8、比邻星 3e-11），
    // 拖动 1° 改变的 offset 约 offset×0.017——老人星 ~2.4e-10、比邻星 ~5e-13，
    // 若再套一个 1e-9 的绝对下限，这些真实拖拽都会被误判成「用户没动」，
    // 镜头被每帧弹回原处，表现就是「看得见球却拖不动 / 锁死」。所以下限也随尺度走。
    const eps = Math.min(0.01, before.length() * 0.002);
    const userMoved = actual.distanceTo(before) > eps;
    if (userMoved) before.copy(actual);

    // 2) 共转：天体绕中心转过多少，相机偏移也转过多少。于是中心光源始终留在
    //    相机背后同一侧（不会公转半圈后看到黑面），星空与其它天体相对流动。
    const rOff = coRotate(before, follow.lastAngle, angle);
    const rWant = coRotate(follow.want, follow.lastAngle, angle);
    follow.offset.set(rOff.x, rOff.y, rOff.z);
    follow.want.set(rWant.x, rWant.y, rWant.z);
    follow.lastAngle = angle;

    if (userMoved) {
      // 尊重用户手动调整过的取景方向。飞行中只改方向、距离仍继续收敛，
      // 否则 OrbitControls 的阻尼残留会被误判成「用户接管」而让飞行半途停下。
      if (isMoving) {
        const reach = Math.max(follow.want.length(), 1e-6);
        const len = follow.offset.length();
        if (len > 1e-9) follow.want.copy(follow.offset).multiplyScalar(reach / len);
      } else {
        follow.want.copy(follow.offset);
      }
    }

    // 3) 飞行只在「相对偏移」上插值：目标天体怎么跑都不会脱靶。
    //    指数收敛与帧率无关——固定 lerp(0.06) 在低帧率 / 软件渲染下要飞十几秒。
    if (isMoving) {
      const k = 1 - Math.exp(-Math.max(dtSec, 1e-3) * 3.5);
      follow.offset.lerp(follow.want, k);
      const reach = Math.max(follow.want.length(), 1e-6);
      if (follow.offset.distanceTo(follow.want) < reach * 0.01) {
        follow.offset.copy(follow.want);
        isMoving = false;
        // 用户主动收起过信息卡就别在落地时又弹回来。
        if (selected && !infoDismissed) showInfo(selected);
      }
    }

    // 4) 落到本帧天体位置：target 与 camera 同步平移，OrbitControls 的
    //    spherical 由两者之差重算，镜头朝向只随共转变化。
    controls.target.copy(_followPos);
    camera.position.copy(_followPos).add(follow.offset);
    follow.lastPos.copy(_followPos);
    if (TIERS) tierFocus.copy(_followPos); // 滚轮切档时焦点不退回静态原点
  }

  // 视角切换：飞向新位姿，同时更新"返回基准点"，保证关闭信息卡后回到当前视角
  const flyPos = new THREE.Vector3();
  const flyTarget = new THREE.Vector3();
  let flying = false;
  function applyView(idx) {
    stopFollow();
    const pose = cameraPose(system, camera, views[idx].frameTo);
    controls.minDistance = Math.max(0.05, system.bodies[0].size * 0.3);
    controls.maxDistance = pose.maxDistance;
    homePosition = pose.pos.toArray();
    homeVec.copy(pose.pos);
    flyPos.copy(pose.pos);
    flyTarget.copy(pose.target);
    flying = true;
    selected = null;
    isMoving = false;
    isZoomingOut = false;
    setActiveShowcase(null);
    const box = document.getElementById('planetInfo');
    if (box) box.style.display = 'none';
  }

  function showInfo(def) {
    const box = document.getElementById('planetInfo');
    const nameEl = document.getElementById('planetName');
    const detailEl = document.getElementById('planetDetails');
    if (!box || !nameEl || !detailEl) return;
    nameEl.innerText = bodyName(def);
    // 英文模式：字段名/值都本地化；没有英文译名的长描述（简介、类型等）直接跳过，
    // 宁可少几行，也不让中文段落混进英文界面。
    let detail = Object.entries(def.info ?? {})
      .map(([k, v]) => {
        const key = infoKey(k);
        const val = infoValue(v);
        return key == null || val == null ? null : `${key}: ${val}`;
      })
      .filter(Boolean)
      .join('\n');
    if (settings.bodyExaggeration > 1) {
      detail += (detail ? '\n' : '') + t('infoZoom', settings.bodyExaggeration);
    }
    // 恒星：写出真实半径。特写时 showInfo() 往往比下一帧的 updateStarPortraits()
    // 先跑，此时球的 visible 还是 false，不能拿它当「现在是一个点」的判据。
    if (def.radiusSun != null) {
      detail += (detail ? '\n' : '') + t('starRadius', def.radiusSun);
      const inCloseup = !!closeup && closeup.defId === def.id && follow?.id === def.id
        && focusDistanceLy() <= revealDistanceLy(def.radiusSun) * 1.2;
      detail += '\n' + t(inCloseup ? 'starCloseupNote' : 'starCloseupHint');
    }
    // 点天体（脉冲星 / 白矮星 / 聚星成员）：明确告诉用户「这里就是一个点」，
    // 并把三维视锥里还有多少远处天体写出来 —— 背景不是空壳。
    if (def.pointOnly) {
      detail += (detail ? '\n' : '') + t('pointBodyNote');
      detail += '\n' + t('backdropNote', Math.max(0, backdropCount - 1));
    }
    if (closeup && closeup.defId === def.id) {
      detail += '\n' + t('backdropNote', Math.max(0, backdropCount - 1));
      // 点名一个最有代表性的背景天体（优先太阳）。心宿二的信息卡会写
      // 「背景锚点：太阳（约 550 光年）」，把三维背景这件事讲清楚。
      const ids = closeup.backdrops[closeup.backdropIndex]?.ids ?? [];
      const anchorId = ids.includes('sun') ? 'sun' : ids[0];
      const anchor = anchorId && infoById.get(anchorId);
      const anchorNode = anchorId && byId.get(anchorId);
      const meNode = byId.get(def.id);
      if (anchor && anchorNode && meNode && anchorId !== def.id) {
        scene.updateMatrixWorld(true);
        const a = new THREE.Vector3(), m = new THREE.Vector3();
        anchorNode.group.getWorldPosition(a);
        meNode.group.getWorldPosition(m);
        detail += '\n' + t('backdropAnchor', bodyName(anchor), distText(a.distanceTo(m) / UNITS_PER_LY));
      }
    }
    if (follow) detail += (detail ? '\n' : '') + t('followingNote', settings.followMotion);
    detailEl.innerText = detail;
    // 有卫星系统的天体：信息卡里给出"进入卫星系统"按钮，点行星即可下钻
    const oldBtn = box.querySelector('.child-btn');
    if (oldBtn) oldBtn.remove();
    if (def.childSystem) {
      const btn = document.createElement('button');
      btn.className = 'child-btn';
      const goLabel = t('childBtn', systemName(def.childSystemLabel ?? bodyName(def)));
      btn.textContent = goLabel;
      btn.onclick = () => { window.location.href = universeHref(def.stellarSystem ?? def.id) ?? def.childSystem; };
      box.querySelector('.planet-info-content').appendChild(btn);
    }
    // 有真实球面特写的恒星：信息卡给「查看近照」按钮，点在原位放大看球（背景仍在），
    // 不再像以前那样一点击就自动跳 9R 特写。与「点击只定位」统一：近照是用户主动选择。
    if (!def.childSystem && starPortraits.has(def.id)) {
      const cBtn = document.createElement('button');
      cBtn.className = 'child-btn';
      cBtn.textContent = t('closeupBtn');
      cBtn.onclick = () => { const o = focusObjectOf(def.id); if (o) setStarCloseup(def, o); };
      box.querySelector('.planet-info-content').appendChild(cBtn);
    }
    box.style.display = 'block';
    infoDismissed = false;   // 用户选了新天体，允许镜头落地时重新展开信息卡
  }

  // ---------- OpenNGC 深空点云点击：按 point index 取元数据弹信息卡 ----------
  // 深空天体不做逐体网格（~1.4 万颗），只渲染成点云；射线命中后用 hits[0].index
  // 定位到具体天体，构造一个轻量 def 直接喂给 showInfo（仅展示，不飞行/不切档）。
  function pad2(n) { return String(n).padStart(2, '0'); }
  function raToHMS(raDeg) {
    let h = raDeg / 15;
    const hh = Math.floor(h); const m = Math.floor((h - hh) * 60); const s = ((h - hh) * 60 - m) * 60;
    return `${pad2(hh)}:${pad2(m)}:${s.toFixed(1)}`;
  }
  function decToDMS(decDeg) {
    const sgn = decDeg < 0 ? '-' : '+'; const a = Math.abs(decDeg);
    const d = Math.floor(a); const m = Math.floor((a - d) * 60); const s = ((a - d) * 60 - m) * 60;
    return `${sgn}${pad2(d)}:${pad2(m)}:${s.toFixed(1)}`;
  }
  function makeOpenNgcDef(i) {
    const meta = OPENNGC_META;
    if (!meta || i < 0 || i >= meta.ids.length) return null;
    const id = meta.ids[i];
    const cat = meta.cat ? meta.cat[i] : 10;
    const catZh = (meta.catZh && meta.catZh[cat]) || '其他';
    const mag = meta.mag ? meta.mag[i] : -99;
    const dist = meta.dist ? meta.dist[i] : -1;
    const ra = meta.ra ? meta.ra[i] : NaN;
    const dec = meta.dec ? meta.dec[i] : NaN;
    const l = meta.lb ? meta.lb[i * 2] : NaN;
    const b = meta.lb ? meta.lb[i * 2 + 1] : NaN;
    const common = meta.common ? meta.common[i] : '';
    const info = {};
    info['类型'] = catZh;
    info['视星等'] = isFinite(mag) && mag > -90 ? mag.toFixed(1) : '—';
    info['赤经'] = isFinite(ra) ? raToHMS(ra) : '—';
    info['赤纬'] = isFinite(dec) ? decToDMS(dec) : '—';
    info['银道坐标'] = (isFinite(l) && isFinite(b))
      ? `银经 = ${l.toFixed(1)}°，银纬 = ${b.toFixed(1)}°` : '—';
    if (dist > 0) {
      const ly = dist * 3.26156e6; // Mpc → 光年
      const distFmt = dist < 0.01 ? dist.toFixed(4) : dist.toFixed(2);
      info['距离'] = `~ ${Math.round(ly).toLocaleString('en-US')} ly (${distFmt} Mpc)`;
    } else {
      info['距离'] = 'n/a';
    }
    if (common) info['别名'] = common;
    info['简介'] = `OpenNGC 收录的深空天体（${id}）。方向为真实赤经赤纬换算的银道坐标；距离目录未逐体给出，按壳层近似摆放，仅供方向参考。`;
    return { id: 'openngc:' + id, name: common || id, nameEn: id, info };
  }
  function handleDeepSkyPick(i) {
    const def = makeOpenNgcDef(i);
    if (!def) return;
    selected = def;
    showInfo(def);
  }
  // 关闭信息卡 = 纯 UI 收起，绝不动 3D 状态。
  // 旧实现在这里调用 setActiveShowcase(null) + stopFollow()，结果用户只是想
  // 收起一张卡片，镜头却从恒星 9R 特写瞬间跳回 10 万光年全景（实测跟随、
  // 档位、相机、近裁剪面、可见天体等 11 项状态全变）。退出聚焦改为显式动作：
  // Esc 或点击「跟随中」角标 → exitFocus()。
  let infoDismissed = false;
  function closeInfo() {
    infoDismissed = true;
    const box = document.getElementById('planetInfo');
    if (box) box.style.display = 'none';
  }
  function exitFocus() {
    infoDismissed = true;
    const box = document.getElementById('planetInfo');
    if (box) box.style.display = 'none';
    setActiveShowcase(null);
    stopFollow();
    // 未聚焦时保留当前宏观档位；若刚才是恒星特写，stopFollow 已按当前视野
    // 就近恢复档位与 near / 锚点尺寸 / 可见性窗口。
    if (TIERS) return;
    isZoomingOut = true;
    controls.target.set(...homeTarget);
  }
  window.closeInfo = closeInfo;
  window.exitFocus = exitFocus;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (follow || selected)) exitFocus();
  });
  followBadge.title = document.documentElement.lang === 'zh-CN'
    ? '点击或按 Esc 退出聚焦' : 'Click or press Esc to exit focus';
  followBadge.style.cursor = 'pointer';
  followBadge.addEventListener('click', () => { if (follow || selected) exitFocus(); });

  function focusOn(def, object) {
    const box = document.getElementById('planetInfo');
    if (box) box.style.display = 'none';
    const worldPos = new THREE.Vector3();
    object.getWorldPosition(worldPos);
    controls.target.copy(worldPos);
    camera.lookAt(worldPos);

    // 不再冻结全场：时间继续推进，相机改为追踪「天体 + 相对偏移」。
    // 落点从绝对坐标换成相对偏移后，飞行途中天体一直在跑也不会飞到空点，
    // 落地后镜头继续跟着它绕中心运动，其它天体和背景都保持动态。
    const dir = camera.position.clone().sub(worldPos);
    if (dir.lengthSq() < 1e-12) dir.set(0, 0.42, 1);
    dir.normalize().multiplyScalar(followDistance(def));
    beginFollow(def, object, dir, 'fly');
  }

  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // 3D 拾取 + 「单击空白退出聚焦」。进入天体特写后相机被跟随态接管，过去只能
  // 一直往外滚 30+ 格缩到 10 万光年才自动解锁；现在单击画面空白处（没点中
  // 任何天体、且鼠标几乎没移动，即不是拖拽转视角）就立刻恢复自由视野。
  const UI_HIT_SELECTOR = '#bodyNav, #planetInfo, #scaleBar, #universeNav, ' +
    '#universeMap, #gui-container, .lang-toggle, #followBadge';
  let blankDown = null;
  window.addEventListener('mousedown', (e) => {
    if (e.target && e.target.closest && e.target.closest(UI_HIT_SELECTOR)) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(raycastTargets, false);
    const id = hits.length ? hits[0].object.userData.bodyId : null;
    if (id) { blankDown = null; selectBody(id); return; }
    // 深空点云（OpenNGC）：命中时用 point index 取元数据，直接弹信息卡（不飞行、不切档）
    if (hits.length && hits[0].object.userData.isDeepSky && hits[0].index != null) {
      blankDown = null;
      handleDeepSkyPick(hits[0].index);
      return;
    }
    blankDown = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', (e) => {
    if (!blankDown) return;
    const moved = Math.hypot(e.clientX - blankDown.x, e.clientY - blankDown.y);
    blankDown = null;
    if (moved > 6) return;               // 这是拖拽转视角，不能误退出
    if (follow || selected) exitFocus(); // 单击空白 = 一键退出聚焦
  });

  // ---------- 动画：真实时间驱动的开普勒运动 ----------
  let elapsedDays = 0;
  let last = performance.now();

  function animate() {
    const now = performance.now();
    const dtSec = Math.min((now - last) / 1000, 0.1);
    last = now;
    const dtDays = (paused || clockPaused) ? 0 : dtSec * settings.timeScale; // 本帧推进的真实天数
    elapsedDays += dtDays;
    if (clockNowEl && (++clockFrame & 7) === 0) {
      const y = elapsedDays / 365.25;
      clockNowEl.textContent = t('orbitClockYear',
        y >= 100 ? Math.round(y).toLocaleString('en-US') : y.toFixed(2));
      if (clockRateEl) {
        clockRateEl.textContent = t('orbitClockRate', Math.round(settings.timeScale * 100) / 100);
      }
    }

    for (const n of nodes) {
      const d = n.def;

      // 公转：解开普勒方程，近日点快、远日点慢
      if (d.orbit) {
        const T = d.orbit.periodDays;
        const M = (2 * Math.PI * elapsedDays) / T + (d.orbit.M0 ?? 0);
        const E = solveKepler(M, d.orbit.e ?? 0);
        const p = orbitPoint(d.orbit.a, d.orbit.e ?? 0, E);
        n._E = E; // 彗尾要用偏近点角算真实日心距
        if (n.mesh) n.mesh.position.set(p.x, 0, p.z);
        else if (n.model) n.model.position.set(p.x, 0, p.z);
        n.anchor.position.set(p.x, 0, p.z);
      }

      // 自转：周期取负即逆行（金星、天王星）
      if (n.mesh && d.rotationHours) {
        n.mesh.rotateY(((2 * Math.PI) / (d.rotationHours / 24)) * dtDays);
      }
      if (n.model && d.rotationHours) {
        n.model.rotateY(((2 * Math.PI) / (d.rotationHours / 24)) * dtDays);
      }
      // 大气层单独周期：云层相对地表缓慢漂移；金星大气"超级旋转"仅约 4 天
      if (n.atmosphere && d.atmosphereRotateHours) {
        n.atmosphere.rotateY(((2 * Math.PI) / (d.atmosphereRotateHours / 24)) * dtDays);
      }
    }

    // 层级恒星系统的惯性子框架：所有成员的轨道局部位置本帧已写进
    // mesh / anchor，这里按「父先于子」的顺序把每个 frame 摆到父质心的
    // 世界坐标，然后立刻刷新该子树的矩阵，供下一层读取世界位置。
    // scene 根节点无旋转缩放，因此 world 坐标可直接当 frame.position 用。
    if (inertialChildren.length) {
      scene.updateMatrixWorld(true);
      for (const n of inertialChildren) {
        const p = byId.get(n.parentId);
        if (!p) continue;
        (p.mesh ?? p.anchor).getWorldPosition(_frameVec);
        n.childFrame.position.copy(_frameVec);
        n.childFrame.updateMatrixWorld(true);
      }
    }

    // 彗发 / 彗尾：依赖本帧刚写好的位置与偏近点角，必须排在公转更新之后
    cometGlobals.uTime.value = performance.now() / 1000; // 驱动彗尾湍流缓慢漂移
    for (const n of nodes) {
      if (n.comet) updateComet(n, sunPos, settings.tailGain ?? 1);
    }

    // 银河系整体缓慢自转：全景档常驻；跟随中连小档也放开——镜头每帧咬住目标
    // 并随它共转，刚体自转不会把近邻恒星甩出画面，反而是更自然的动态背景。
    if (galaxyGroup && !paused && (!TIERS || currentTier === 0 || follow)) {
      galaxyGroup.rotation.y += dtSec * (system.galaxy?.rotateSpeed ?? 0.006);
    }

    if (sunMesh) sunMesh.rotateY(((2 * Math.PI) / (609.12 / 24)) * dtDays);

    for (const a of asteroids) {
      a.rotation.y += 0.0001;
      const c = Math.cos(0.0001 * settings.timeScale * 0.02);
      const s = Math.sin(0.0001 * settings.timeScale * 0.02);
      const x = a.position.x, z = a.position.z;
      a.position.x = x * c + z * s;
      a.position.z = z * c - x * s;
    }

    // 跟随镜头：天体位置已按本帧时间更新，先把相机与 controls.target 同步过去，
    // 再做拾取 / 标签投影，避免慢一帧。飞行中的收敛也在 updateFollow 内完成。
    if (follow) updateFollow(dtSec);

    // 悬停描边
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(raycastTargets, false);
    outlinePass.selectedObjects = hits.length ? [hits[0].object] : [];

    // 相机飞行：视角切换 / 关闭信息卡后返回基准点（跟随与聚焦飞行已在上面处理）
    if (flying) {
      camera.position.lerp(flyPos, 0.05);
      controls.target.lerp(flyTarget, 0.05);
      // 收敛阈值必须随档位缩放：固定 0.5 对全景档（相机距 50）没问题，
      // 但最内档相机距只有 ~5e-4，等于第一帧就判定"飞到了"，镜头根本没到位。
      const eps = TIERS
        ? Math.max(1e-7, tierCamDist(currentTier) * 0.01)
        : Math.max(0.5, flyPos.length() * 0.004);
      if (camera.position.distanceTo(flyPos) < eps) flying = false;
    } else if (isZoomingOut) {
      camera.position.lerp(homeVec, 0.05);
      if (camera.position.distanceTo(homeVec) < 1) isZoomingOut = false;
    }

    if (skyPoints) skyPoints.position.copy(camera.position); // 天球以相机为中心 = 无限远
    controls.update();
    updateStarPortraits(dtSec);  // 相机位姿定下来后再判恒星近景显隐与球径
    updateLabels();   // 相机/天体动完再投影，标签才不会慢一帧

    requestAnimationFrame(animate);
    composer.render();
  }
  // ---------- 天体名字标签（世界坐标投影到屏幕，跟着天体走）----------
  // 全站启用：银河系是一堆无名彩点，太阳系/卫星系统是一串行星与卫星，
  // 就地标注都比"去左边菜单里找"直观。用 DOM 层 + 每帧投影，而不是
  // CSS2DRenderer：能同时跟随轨道运动 / 档位可见性，做屏幕空间避让，
  // 也不必和 composer 后处理抢渲染层。
  function buildBodyLabels() {
    labelLayer = document.createElement('div');
    labelLayer.id = 'bodyLabels';
    document.body.appendChild(labelLayer);

    const add = (id, node, def, typeOverride) => {
      const short = shortName(bodyName(def));
      // 宇宙层级页：点小到几乎看不见，所以第二行用文字点出类型与真实直径
      const note = def.labelNote ?? null;
      const el = document.createElement('div');
      const type = typeOverride ?? bodyType(def);
      el.className = 'bl-item type-' + type + (note ? ' with-note' : '');
      // 按成员自身配色，免得所有星系的标签都是同一种暖黄、又「长得一样」
      if (def.labelColor) el.style.setProperty('--bl-color', def.labelColor);
      const dot = document.createElement('span');
      dot.className = 'bl-dot';
      const text = document.createElement('span');
      text.className = 'bl-text';
      const name = document.createElement('span');
      name.className = 'bl-name';
      name.textContent = short;
      text.appendChild(name);
      if (note) {
        const sub = document.createElement('span');
        sub.className = 'bl-note';
        sub.textContent = note;
        text.appendChild(sub);
      }
      el.appendChild(dot);
      el.appendChild(text);
      labelLayer.appendChild(el);
      // 宽度按中英文字符估算，用于避让；不读 offsetWidth，避免每帧强制回流
      const est = (s) => [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 12 : 7), 0);
      const w = Math.max(est(short), note ? est(note) * 0.82 : 0) + 26;
      // 全景档所有近邻恒星都投影到太阳附近，卫星系统内卫星群也挤成一团：
      // 避让时优先保留中心天体 / 锚点与有名有姓的深空天体，普通成员让位。
      // 非银河系页里「无 orbit 且无 parent」的就是该子系统中心天体（木星、地球…）。
      const central = id === 'sun' || id === 'sagA' ||
        (!TIERS && !def.orbit && !def.parent);
      const weight = central ? -1
        : (type === 'nebula' || type === 'cluster' || type === 'blackhole') ? 0
        : type === 'star' ? 2 : 1;
      labelRows.set(id, { el, node, w, h: note ? 30 : 18, weight });
    };

    for (const [id, node] of byId) add(id, node, node.def);
    // 太阳在 hasSun 的系统里是单独建的 sunMesh，不在 system.bodies / byId 中，
    // 这里补一个伪 node，让它也能有名字标签（左侧菜单早就单独列了它）。
    if (system.hasSun && sunMesh && !byId.has('sun')) {
      const def = infoById.get('sun');
      add('sun', { group: sunMesh, mesh: sunMesh, def }, def, 'sun');
    }
  }

  const _labelV = new THREE.Vector3();
  function updateLabels() {
    if (!labelLayer) return;
    // renderer 要到 composer.render() 才刷新 matrixWorldInverse；这里在渲染前
    // 投影，必须自己刷一次，否则标签永远慢一帧、拖动时会甩在天体后面。
    camera.updateMatrixWorld();
    const W = window.innerWidth, H = window.innerHeight;
    // 只有银河系页有分档缩放；其它系统页的球体尺寸不随档位变化
    const f = TIERS ? Math.pow(10, -currentTier * 0.8) : 1;
    const tanHalf = Math.tan((camera.fov * DEG) / 2);
    const items = [];
    for (const [id, row] of labelRows) {
      const n = row.node;
      // updateTierVisibility 会把不匹配档位的 group 整体隐藏，标签跟着收起
      if (n.group && !n.group.visible) { row.el.style.display = 'none'; continue; }
      // 必须投影「天体本体」而不是 group：group 是轨道 pivot，公转时位置由
      // n.mesh.position / n.model.position 更新，group 本身一直停在原点附近。
      // 早先用 group.getWorldPosition() 会让所有行星标签叠在画面中心，
      // 再被贪心避让互相吃掉，只剩太阳一个。
      const obj = n.mesh || n.model || n.anchor || n.group;
      obj.getWorldPosition(_labelV);
      const dCam = _labelV.distanceTo(camera.position);
      _labelV.project(camera);
      if (_labelV.z > 1 || _labelV.z < -1 ||
          Math.abs(_labelV.x) > 1.05 || Math.abs(_labelV.y) > 1.05) {
        row.el.style.display = 'none';
        continue;
      }
      // 银河系天体用示意光晕直径 glowSize（随档位缩放，占屏 ~4px→45px）；
      // 太阳系/卫星系统没有 glowSize，用真实球体半径 def.size（SphereGeometry(1)
      // 被 scale 成 size），太阳 18 单位、木卫一 0.45 单位，差距正好按透视体现。
      // 按它的占屏半径把标签推到球体外面，否则文字压在球上根本读不清。
      const baseR = n.def?.glowSize ?? n.def?.size ?? 0.4;
      const worldR = TIERS ? baseR * f * 0.5 : baseR;
      const pxR = dCam > 0 ? (worldR / (dCam * tanHalf)) * (H * 0.5) : 0;
      // 深空天体被点亮时是一张 ~90px 的星云/星团图，彗星也有比核大得多的彗发，
      // 这些"示意物"都比本体球大，标签要按它们外移。
      const sc = deepSkyShowcases.get(id);
      const showcaseR = sc && sc.visible ? 46 : (n.def?.comet ? 24 : 0);
      const off = Math.max(12, Math.min(72, Math.max(pxR, showcaseR) + 10));
      // 背景锚点（默认太阳）的标签要抢在普通背景星之前放置：一堆远处天体
      // 挤在焦点附近时，贪心避让很容易把「太阳」这个名字吃掉，而它正是
      // 说明「百光年外的天体仍在同一画面」最直观的那一个。
      const isAnchor = !!closeup && id === 'sun'
        && closeup.backdrops[closeup.backdropIndex]?.ids.includes('sun');
      row.el.classList.toggle('backdrop-anchor', isAnchor);
      items.push({
        row, off,
        sx: (_labelV.x * 0.5 + 0.5) * W,
        sy: (-_labelV.y * 0.5 + 0.5) * H - 9,
        pri: id === selected?.id ? -1 : (isAnchor ? -0.5 : 0),
      });
    }
    // 贪心避让：选中的 > 锚点/深空天体 > 普通恒星，同级按屏幕纵坐标从上往下放；
    // 与已放置标签矩形重叠的直接收起，避免一堆名字糊成一团。
    items.sort((a, b) => a.pri - b.pri || a.row.weight - b.row.weight || a.sy - b.sy);
    const placed = [];
    // 左侧菜单 z-index 12 会盖住标签层（10）；把它当成一个已占用矩形，
    // 免得名字从菜单边缘露出半截。一次只读，且所有 DOM 写入都在后面。
    const navEl = document.querySelector('.body-nav');
    if (navEl) {
      const r = navEl.getBoundingClientRect();
      placed.push({ x1: r.left - 4, y1: r.top - 2, x2: r.right + 4, y2: r.bottom + 2 });
    }
    // 顶部宇宙导航条同样是不可盖住的 UI 区域
    const uniEl = document.querySelector('.universe-nav');
    if (uniEl) {
      const r = uniEl.getBoundingClientRect();
      placed.push({ x1: r.left - 4, y1: r.top - 2, x2: r.right + 4, y2: r.bottom + 2 });
    }
    for (const it of items) {
      const { row, sx, sy, off } = it;
      // 一个位置放不下就换位置，而不是直接把名字丢掉：内行星 / 内卫星群
      // 在投影上本来就挤成一团，只给一次机会会隐藏掉大半标签。
      // 优先右侧（引线朝左），再上下错开，最后翻到左侧（引线朝右）。
      const dxR = off, dxL = -off - row.w;
      const cands = [
        [dxR, 0], [dxR, -17], [dxR, 17],
        [dxL, 0], [dxL, -17], [dxL, 17],
      ];
      let put = null;
      for (const [dx, dy] of cands) {
        const x = sx + dx, y = sy + dy;
        if (x < -40 || x + row.w > W - 8 || y < 4 || y + row.h > H - 8) continue;
        const box = { x1: x, y1: y, x2: x + row.w, y2: y + row.h };
        const clash = placed.some((p) =>
          box.x1 < p.x2 + 4 && box.x2 + 4 > p.x1 && box.y1 < p.y2 + 2 && box.y2 + 2 > p.y1);
        if (!clash) { put = { x, y, box, flip: dx < 0 }; break; }
      }
      if (!put) { row.el.style.display = 'none'; continue; }
      placed.push(put.box);
      row.el.style.display = '';
      row.el.classList.toggle('flip', put.flip);
      row.el.style.setProperty('--lead', Math.max(6, Math.round(off - 3)) + 'px');
      row.el.style.transform = `translate(${Math.round(put.x)}px, ${Math.round(put.y)}px)`;
    }
  }

  // ---------- 左侧天体快捷菜单 + 顶部宇宙导航 + 底部比例尺条 + 名字标签（注入式）----------
  buildBodyNav();
  buildBodyLabels();
  // 面包屑 / 上下级 / 宇宙地图：所有页面统一挂载，位置完全由注册表驱动
  mountUniverseNav({ currentId: currentNodeId });

  let scaleBar = null;
  function buildScaleBar() {
    // 比例尺只保留「− 当前尺度 ＋」三个元素，固定在右下角当参考。
    // 6 档按钮、说明文字、「换个背景」按钮、折叠胶囊全部去掉：它们把主屏
    // 中间整条挡住，在手机上占地比 3D 画面还多。
    if (!TIERS || TIERS.length < 2) return;
    const bar = document.createElement('div');
    bar.id = 'scaleBar';
    bar.className = 'scale-bar';
    const compact = document.createElement('div');
    compact.className = 'sb-compact';
    const sbMinus = document.createElement('button');
    sbMinus.type = 'button';
    sbMinus.className = 'sb-minus';
    sbMinus.textContent = '−';          // 缩小：往更大尺度切一档
    sbMinus.title = t('scaleMinus');
    sbMinus.setAttribute('aria-label', t('scaleMinus'));
    const sbNow = document.createElement('span');
    sbNow.className = 'sb-now';
    const sbPlus = document.createElement('button');
    sbPlus.type = 'button';
    sbPlus.className = 'sb-plus';
    sbPlus.textContent = '+';           // 放大：往更小尺度切一档
    sbPlus.title = t('scalePlus');
    sbPlus.setAttribute('aria-label', t('scalePlus'));
    const stepTier = (dir) => {
      // 点加减时若正跟随某天体，先退出聚焦再切宏观档位。
      if (follow) stopFollow();
      const next = Math.max(0, Math.min(TIERS.length - 1, currentTier + dir));
      if (next !== currentTier) applyTier(next, { instant: true });
    };
    sbMinus.onclick = (e) => { e.stopPropagation(); stepTier(-1); };
    sbPlus.onclick = (e) => { e.stopPropagation(); stepTier(1); };
    compact.append(sbMinus, sbNow, sbPlus);
    bar.appendChild(compact);
    document.body.appendChild(bar);
    scaleBar = bar;
  }
  // 背景方位不再有 UI：进入特写时后台随机选一次，用户不能也不需要手动切换。
  // 保留这个空函数，是为了不改动散落在 stopFollow / setStarCloseup 等处的调用点。
  function updateBackdropUI() { /* intentionally empty */ }
  function updateScaleBarUI(i, spanOverride = null) {
    if (!scaleBar) return;
    // 特写时显示真实视野跨度，宏观档位时显示档位短标签。
    const now = scaleBar.querySelector('.sb-now');
    if (now) now.textContent = spanOverride != null ? spanText(spanOverride) : tierShort(TIERS[i]);
  }
  buildScaleBar();

  // 从手机旋转/放大到桌面时，把移动端默认收起的左侧栏展开（桌面可再手动折叠）。
  let _wasCompact = compactUI();
  window.addEventListener('resize', () => {
    const compact = compactUI();
    if (_wasCompact && !compact) {
      document.getElementById('bodyNav')?.classList.remove('collapsed');
    }
    _wasCompact = compact;
  });

  // 深链必须等首帧把开普勒轨道位置写进 group 后再取世界坐标：
  // 否则 getWorldPosition() 还是 (0,0,0)，相机会被推到太阳表面、整屏糊成黄色（实测过）。
  requestAnimationFrame(() => {
  // ---------- ?body=<id> / #<id> / ?focus=<id> / ?scale=<spanLy> 深链 ----------
  // 银河系页：?scale= 直接定位档位（用于博客 iframe 与逐档截图）；
  // 指定天体则自动切到它所属档位并把观察焦点移过去，背景与其它天体照常保留。
  // deepBody 解析出的是页内 ID；cosmos 页的动态成员没进注册表，按原样走 focus 兜底。
  const params = new URLSearchParams(location.search);
  const focusId = deepBody ? deepBody.id
    : (params.get('body') || params.get('focus') || location.hash.slice(1));
  const scaleParam = params.get('scale');

  // 即时到位（不走相机飞行）：外链打开或改 hash 时要立刻看到天体，而不是等几秒飞过去。
  // 复现「点击该天体后」的界面：相机对准、镜头随行、菜单高亮、信息卡展开。
  function focusInstant(id) {
    const def = infoById.get(id);
    const obj = focusObjectOf(id);
    if (!def || !obj) return false;
    const wp = new THREE.Vector3();
    obj.getWorldPosition(wp);
    controls.target.copy(wp);
    // 与 focusOn 同一套取景距离：旧的固定 2 单位比地球本体还小，
    // 相机贴在球内部反而什么都看不见；彗星还要按彗尾长度退开。
    const offset = followDistance(def);
    // 站在天体「朝中心天体」的一侧、略偏切向与上方：中心光源落在相机背后，
    // 看到的是被照亮的一面，而且太阳不会进入画面把它糊满。
    // 不能用「当前相机位置 - 天体」当方向，轨道相位不同结果不可控（实测会贴进太阳）。
    const radial = wp.clone();
    let dir;
    if (radial.lengthSq() < 1e-6) {
      dir = new THREE.Vector3(...(system.camera?.position ?? [-0.83, 0.55, 0.06])).normalize();
    } else {
      radial.normalize();
      const tangent = new THREE.Vector3().crossVectors(radial, new THREE.Vector3(0, 1, 0));
      if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
      dir = radial.clone().multiplyScalar(-0.55)
        .addScaledVector(tangent.normalize(), 0.6)
        .add(new THREE.Vector3(0, 0.42, 0))
        .normalize();
    }
    const want = dir.multiplyScalar(offset);
    camera.position.copy(wp).add(want);
    camera.lookAt(wp);
    selected = def;
    beginFollow(def, obj, want, 'instant');
    setActiveShowcase(id);
    highlightNav(id);
    showInfo(def);
    return true;
  }

  if (TIERS) {
    let initTier = 0;
    if (scaleParam) {
      const found = TIERS.findIndex((t) => String(t.spanLy) === scaleParam || t.short === scaleParam);
      if (found >= 0) initTier = found;
    }
    let focusWp = null;
    if (focusId && infoById.has(focusId)) {
      const def = infoById.get(focusId);
      if (!scaleParam) initTier = currentTier;  // 无显式 ?scale= 时只定位到当前尺度，不自动跳近照
      const obj = focusObjectOf(focusId);
      if (obj) {
        scene.updateMatrixWorld(true);
        focusWp = new THREE.Vector3();
        obj.getWorldPosition(focusWp);
      }
    }
    applyTier(initTier, { instant: true, focus: focusWp ?? undefined });
    if (focusId && infoById.has(focusId) && focusWp) {
      const def = infoById.get(focusId);
      selected = def;
      const obj = focusObjectOf(focusId);
      if (obj) {
        // 统一入口：深链 / hash 也只做「定位」，近照交给信息卡按钮（与点击行为一致）
        beginFollow(def, obj, null, 'keep');
      }
      setActiveShowcase(focusId);
      highlightNav(focusId);
      showInfo(def);
    }
  } else if (focusId) {
    focusInstant(focusId);
  }

  // 同一页面内改 hash 即可切换天体（iframe 里无需刷新页面），同样即时到位
  window.addEventListener('hashchange', () => {
    const id = resolveBody(location.hash)?.id ?? location.hash.slice(1);
    if (!id || !infoById.has(id)) return;
    if (TIERS) selectBody(id, { close: true });
    else focusInstant(id);
  });
  });

  // ---------- 滚轮：跨 10× 自动切档 + 现有 zoomOutTo 边界 ----------
  // 卫星/行星系统页行为完全不变；银河系页由 animate() 在 controls.update() 后判档。
  // 上浮 / 下钻边界一律从宇宙层级注册表推导：
  // 太阳系 → 银河系 → 本星系群 → 室女座 → 拉尼亚凯亚 → 宇宙，任意一层都能继续走。
  // 旧字段只作为页面未被注册表收录时的兜底。
  const zoomInUrl = childHref(currentNodeId);
  const zoomOutUrl = parentHref(currentNodeId)
    ?? system.parentSystem?.url ?? system.zoomOutTo?.url;
  window.addEventListener('wheel', (e) => {
    if (e.target && e.target.closest && e.target.closest('#bodyNav, #scaleBar')) return;
    // OrbitControls 的 wheel 监听挂在 canvas（target 阶段），本监听挂在 window
    // （冒泡阶段），执行到这里时 dolly 已完成，读到的相机距离就是本帧真实值。
    // 判定必须在事件里同步做且瞬间切档：若交给动画帧 + 飞行动画，飞行 lerp 会把
    // dolly 抵消，相机距离永远到不了边界（实测缩小到顶 60 次都没切回上一档）。
    const d = camera.position.distanceTo(controls.target);
    if (TIERS) {
      // 跟随态：固定倍率的连续对数缩放。缩放跟「周围有没有邻居」完全无关 ——
      // 三维背景里的远处天体一直都在，1 / 10 / 100 光年想停就停，不跳档。
      if (follow) {
        const { minLy, maxLy } = zoomBounds();
        const dLy = focusDistanceLy();
        // 恒星特写：球已退化成一个点，就没理由再把镜头锁在这颗星上。
        // 再往外滚一格即原地松绑（约 3 格，和星云 / 黑洞一致）；旧实现必须
        // 一路缩到 10 万光年（22+ 格）才解锁，正是「只有恒星像被锁住」的根因。
        if (e.deltaY > 0 && closeup && dLy >= closeup.revealLy * 1.5) {
          stopFollow(); return;
        }
        // 一路缩回 10 万光年全景后，退出跟随交给宏观 6 档浏览
        if (e.deltaY > 0 && dLy >= maxLy * 0.995) { stopFollow(); return; }
        flyFocusTo(continuousZoom(dLy, e.deltaY, {
          minLy, maxLy, ratio: DEFAULT_ZOOM_RATIO,
        }));
        return;
      }
      const base = tierCamDist(currentTier);
      if (e.deltaY < 0 && d <= base / 10) {
        if (currentTier < TIERS.length - 1) applyTier(currentTier + 1, { instant: true });
        else {
          // 最内档继续放大 → 下钻到下一级（银河系→太阳系、本星系群→银河系…）
          const sunChild = zoomInUrl ?? infoById.get('sun')?.childSystem;
          if (sunChild) window.location.href = sunChild;
        }
      } else if (e.deltaY > 0 && d >= controls.maxDistance * 0.985) {
        // 往外滚到本档最外边界才切回上一档，沿用既有 zoomOutTo「到顶即退出」约定。
        if (currentTier > 0) applyTier(currentTier - 1, { instant: true });
        else if (zoomOutUrl) window.location.href = zoomOutUrl;
      }
      return;
    }
    if (zoomOutUrl && d >= controls.maxDistance * 0.985 && e.deltaY > 0) {
      window.location.href = zoomOutUrl;
    }
  }, { passive: true });

  // ?debug=1 暴露只读状态，供真实浏览器 / CDP 验证跟随镜头；默认不挂到 window。
  if (new URLSearchParams(location.search).has('debug')) {
    window.__astro = {
      get state() {
        return {
          paused,
          elapsedDays,
          // AU 级双星页：CDP 用 orbitPositions 逐帧比对，确认两星确实在动
          // 且始终分居质心两侧（不是静态摆位、也不是一颗绕静止主星）。
          orbitClock: system.orbitClock ?? null,
          orbitPairs: system.orbitPairs ?? [],
          // 层级恒星系统：逐 body 的显示系数与 parent 链，供 CDP 验证
          // 惯性子框架、跨层压缩与 ?scale=real 开关确实接到了渲染层。
          orbitDisplay: Object.fromEntries([...byId]
            .filter(([, n]) => n.def?.orbit)
            .map(([id, n]) => [id, n.def.orbit.displayScale ?? 1])),
          orbitTree: (system.bodies ?? [])
            .filter((b) => b.parent)
            .map((b) => ({
              id: b.id, parent: b.parent,
              inertial: b.inertialParent === true,
              depth: b.hierarchyDepth ?? null,
            })),
          clockPaused,
          // 含不带 orbit 的根质心：层级质心守恒需要它的世界坐标当基准。
          orbitPositions: Object.fromEntries([...byId]
            .map(([id, n]) => {
              const v = new THREE.Vector3();
              (n.mesh ?? n.anchor).getWorldPosition(v);
              return [id, v.toArray()];
            })),
          selected: selected?.id ?? null,
          following: follow?.id ?? null,
          followMotion: settings.followMotion,
          camera: camera.position.toArray(),
          target: controls.target.toArray(),
          // 恒星近景 LOD：真实浏览器 / CDP 用来验证「大档零球、特写唯一球」
          portraitCount: starPortraits.size,
          tierIndex: currentTier,
          portraitSpanLy: effectiveSpanLy(focusDistanceLy(), camera.fov),
          focusDistanceLy: focusDistanceLy(),
          closeup: closeup ? {
            defId: closeup.defId,
            backdropIndex: closeup.backdropIndex,
            backdrops: closeup.backdrops.map((b) => ({ ids: b.ids, core: b.core, score: b.score })),
          } : null,
          zoomMode: follow ? 'continuous' : 'tiers',
          backdropDir: closeup?.backdrops[closeup.backdropIndex]?.dir ?? null,
          backdropCount,
          // 焦点 1 光年以外、仍落在视锥里的天体：验证「小尺度也有三维背景」
          distantVisible: (() => {
            if (!follow) return [];
            scene.updateMatrixWorld(true);
            follow.object.getWorldPosition(_focusWp);
            const out = [];
            for (const [id, n] of byId) {
              if (!n.group.visible) continue;
              n.group.getWorldPosition(_bodyWp);
              const dLy = _bodyWp.distanceTo(_focusWp) / UNITS_PER_LY;
              if (dLy > 1) out.push({ id, dLy: +dLy.toFixed(3), ndc: projectBody(_bodyWp) });
            }
            return out.sort((a, b) => a.dLy - b.dLy);
          })(),
          cameraNear: camera.near,
          fieldPoints: (galaxyField
            ? (() => { let n = 0; galaxyField.traverse((o) => { if (o.isPoints) n += o.geometry.attributes.position.count; }); return n; })()
            : 0),
          // 目录点云（HYG 星场 / OpenNGC 深空）按名字前缀识别：本该只出现在
          // 银河系本地星场页。上层 cosmos 页此数组应为空，用来验证点球不再串场。
          catalogClouds: (galaxyGroup
            ? galaxyGroup.children
              .filter((o) => o.isPoints && o.name && o.name.startsWith('catalog:'))
              .map((o) => ({ name: o.name, count: o.geometry.attributes.position.count }))
            : []),
          visibleBodies: [...byId.entries()]
            .filter(([, n]) => n.group.visible).map(([id]) => id),
          visiblePortraits: [...starPortraits.values()].filter((p) => p.group.visible).length,
          closeups: [...starPortraits.entries()]
            .filter(([, p]) => p.group.visible)
            .map(([id, p]) => ({
              id,
              radius: p.group.scale.x,
              radiusLy: p.group.scale.x / UNITS_PER_LY,
              opacity: p.sphere.material.opacity,
            })),
        };
      },
      // OpenNGC 深空点云（仅调试）：暴露 pick(i) 让 CDP 直接验证「点中深空点 → 信息卡」链路
      openngc: {
        count: OPENNGC_META.ids.length,
        catZh: OPENNGC_META.catZh,
        meta: OPENNGC_META,
        makeDef: makeOpenNgcDef,
        pick: handleDeepSkyPick,
      },
    };
  }

  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    updateCometViewport(camera, window.innerHeight);
  });

  return { scene, camera, renderer, nodes, settings };
}
