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
import {
  t, distText, tierLabel, tierShort, systemName, groupName,
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
    sp.scale.set(1.1, 1.1, 1);
    obj = sp;
  }
  obj.visible = false;
  // 记录基准尺寸：切比例尺档位时所有「示意尺寸」要按 10^-tier 同比缩小，
  // 才能让它们在画面里占屏恒定，而不是随相机贴近被放大成满屏大球。
  obj.userData.baseScale = obj.isSprite ? 1.1 : 1;
  return obj;
}

// 按配置生成一整片银河系恒星：絮状多旋臂（2 主 + 多次 + 羽状分支）+ 核球 + 银晕。
// 关键几何：对数螺旋 + 总缠绕 < 1 圈（theta ∈ [0, armThetaMax]，r 随 theta 指数增长），
// 这样是开放的 S 形旋涡，而不是"绕满一圈 = 同心环蚊香"。
// 结构贴近真实多旋臂星系：2 条主旋臂（粗亮密、贯穿全盘）+ 若干条「角度/长短错落」的
// 次旋臂 + 从旋臂上分叉出去的羽状支臂（细碎、粉红 HII 结比例更高）。旋臂一律连续撒点，
// 不做断节；亮度按 主臂 > 次臂 > 支臂 分级，保证旋臂丰富但主旋臂依然最突出。
function buildGalaxyField(g, scaleKpc) {
  const rng = mulberry32(g.seed ?? 1337);
  const diskR = g.diskRadiusKpc;
  const thick = g.thicknessKpc;
  const thetaMax = g.armThetaMax ?? 4.0;     // 旋臂总缠绕弧度（4.0≈0.64 圈；越大越像同心环）
  const rMin = g.armRMin ?? 2.0;            // 旋臂起始半径(kpc)，从核球外缘伸出
  const logSpan = Math.log(diskR / rMin);
  const interN = g.interArmStars ?? 100;    // 臂间极稀疏暗淡填充，仅补背景、绝不抢旋臂
  const bulgeN = g.bulgeStars ?? 900;
  const haloN = g.haloStars ?? 550;
  // 主旋臂
  const mainArmCount = g.mainArmCount ?? 2;
  const mainStars = g.mainArmStars ?? 3800;
  const mainWidth = g.mainArmWidth ?? 0.10;
  const mainRadial = g.mainArmRadial ?? 0.45;
  const mainBright = g.mainArmBrightness ?? 1.55;
  // 次旋臂（多条、错落）
  const minorArmCount = g.minorArmCount ?? 6;
  const minorStars = g.minorArmStars ?? 900;
  const minorWidth = g.minorArmWidth ?? 0.055;
  const minorRadial = g.minorArmRadial ?? 0.28;
  const minorBright = g.minorArmBrightness ?? 0.7;
  const minorStartMin = g.minorArmStartMin ?? 0.08; // 次臂起始 t 下限（错落，不都从中心长出）
  const minorStartMax = g.minorArmStartMax ?? 0.40; // 次臂起始 t 上限
  // 羽状支臂：从某条旋臂的某处分叉出去的短片段（絮状感的关键）
  const spurCount = g.spurCount ?? 34;
  const spurStars = g.spurStars ?? 60;
  const spurBright = g.spurBrightness ?? 0.55;
  const spurShear = g.spurShear ?? 1.6;      // 分叉相对宿主臂的角向剪切强度
  const spurLenT = g.spurLenT ?? 0.16;       // 分叉沿 t 的长度
  const spurWidth = g.spurWidth ?? 0.035;
  const spurRadial = g.spurRadial ?? 0.2;
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  const push = (x, y, z, cr, cg, cb, bright) => {
    pos.push(x * scaleKpc, y * scaleKpc, z * scaleKpc);
    c.setRGB(Math.min(1, cr * bright), Math.min(1, cg * bright), Math.min(1, cb * bright));
    col.push(c.r, c.g, c.b);
  };
  // 恒星配色：hii 控制粉红 HII 结比例（支臂更高，贴近真实星系的絮状红星点串）。
  // 各色刻意保留「低次要通道」的饱和度——加法混合会叠白，纯度不够就洗成一片白。
  const colorFor = (u, hii) => {
    if (u < hii) return [1.0, 0.16, 0.30, 1.15 + rng() * 0.45];         // HII 粉红星云
    if (u < 0.62) return [0.16, 0.42, 1.0, 0.95 + rng() * 0.35];        // 年轻蓝星
    if (u < 0.82) return [0.24, 0.92, 0.78, 0.9 + rng() * 0.3];         // 青白
    return [1.0, 0.72, 0.34, 0.9 + rng() * 0.3];                        // 黄白(老星)
  };
  const armBases = [];  // 收集所有旋臂的起始角，供羽状支臂挑选宿主
  // 单条「连续」旋臂：沿对数螺旋连续撒 N 颗星（t 连续、不留节），加角向/径向散射形成平滑旋带
  const buildArm = (base, n, width, radial, bright, tMin, tMax, hii) => {
    armBases.push(base);
    for (let s = 0; s < n; s++) {
      const t = tMin + rng() * (tMax - tMin);                    // 沿臂的位置 0(核球)→1(外缘)
      const theta = t * thetaMax;                                // 缠绕角（总 < 1 圈）
      const r = rMin * Math.exp(t * logSpan) + randn(rng) * radial; // 对数螺旋：半径随角度指数增长
      const ang = base + theta + randn(rng) * width;             // 角向散射 = 旋带粗细
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      const y = randn(rng) * thick * Math.exp(-r / (diskR * 0.5));
      const [cr, cg, cb, br] = colorFor(rng(), hii);
      push(x, y, z, cr, cg, cb, br * bright);
    }
  };
  // 2 条主旋臂：相隔 180°，贯穿全盘，最粗最亮最密
  for (let a = 0; a < mainArmCount; a++) {
    buildArm(a * (Math.PI * 2 / mainArmCount), mainStars, mainWidth, mainRadial, mainBright, 0, 1, 0.20);
  }
  // 6 条次旋臂：起始角带抖动、起始/结束半径各不相同 → 长短错落的多旋臂，而非等间距整齐长臂
  for (let a = 0; a < minorArmCount; a++) {
    const base = (a + 0.3 + rng() * 0.4) * (Math.PI * 2 / minorArmCount);
    const tMin = minorStartMin + rng() * (minorStartMax - minorStartMin);
    const tMax = 0.84 + rng() * 0.16;
    const n = Math.round(minorStars * (0.7 + rng() * 0.6));
    buildArm(base, n, minorWidth, minorRadial, minorBright * (0.8 + rng() * 0.4), tMin, tMax, 0.22);
  }
  // 羽状支臂：从某条旋臂的某点分叉出去，角向逐渐剪切偏离宿主臂 → 细碎的絮状分支
  for (let s = 0; s < spurCount; s++) {
    const base = armBases[Math.floor(rng() * armBases.length)] + randn(rng) * 0.12;
    const t0 = 0.18 + rng() * 0.62;
    const len = spurLenT * (0.6 + rng() * 0.9);
    const shear = spurShear * (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.8);
    const n = Math.round(spurStars * (0.6 + rng() * 0.8));
    for (let i = 0; i < n; i++) {
      const t = t0 + (i / n) * len;
      const theta = t * thetaMax + (t - t0) * shear;            // 相对宿主臂逐渐偏离 = 分叉
      const r = rMin * Math.exp(t * logSpan) + randn(rng) * spurRadial;
      const ang = base + theta + randn(rng) * spurWidth;
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      const y = randn(rng) * thick * Math.exp(-r / (diskR * 0.5));
      const [cr, cg, cb, br] = colorFor(rng(), 0.34);           // 支臂粉红 HII 结更多
      push(x, y, z, cr, cg, cb, br * spurBright);
    }
  }
  // —— 臂间暗淡填充：极稀疏、暗红老星，仅补一点背景，绝不抢旋臂 ——
  for (let b = 0; b < interN; b++) {
    const r = Math.pow(rng(), 0.7) * diskR;
    const ang = rng() * Math.PI * 2;
    const rad = r + randn(rng) * 0.5;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    const y = randn(rng) * thick * Math.exp(-r / (diskR * 0.6));
    push(x, y, z, 0.85, 0.5, 0.38, 0.14 + rng() * 0.1);
  }
  // —— 核球（中心密集的暖色椭球）——
  for (let b = 0; b < bulgeN; b++) {
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
    size: g.pointSize ?? 0.18,
    map: discTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,   // 关掉 ACES 色调映射，保留旋臂的蓝/粉/青/黄真实色彩，不被洗成一片白
  });
  return new THREE.Points(geo, mat);
}

// 银盘柔光：一层极淡的加法辉光，给星系一个发光的"身体"，提升整体观感
function makeGalaxyGlow(diskR) {
  const mat = new THREE.SpriteMaterial({
    map: discTexture(), color: 0xffe7c2, transparent: true,
    opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(diskR * 2.8, diskR * 0.7, 1);
  return s;
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
export function start(system) {
  // 安全网：无太阳的子系统里，没有 parent 的天体就是中心天体，不该带公转轨道。
  // （REAL 里地球/木星等都存着绕日轨道，漏写 noOrbit 会让整个系统飞出画面。）
  for (const def of system.bodies) {
    if (!system.hasSun && !def.parent && def.orbit) {
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
  const deepSkyShowcases = new Map();  // id → 放大展示物（默认隐藏，聚焦时显示）
  // 银盘尺度的背景对象：聚焦深空天体特写时要整体藏掉，否则近距离下
  // sizeAttenuation 会把每个恒星点放大成满屏彩色圆斑。
  let galaxyField = null;
  let galaxyGlow = null;
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
      byId.get(def.parent).anchor.add(node.group);
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
      const c = new THREE.Color(def.color ?? 0xffffff).multiplyScalar(1.6);
      node.mesh.material = new THREE.MeshBasicMaterial({ color: c });
      node.mesh.material.toneMapped = false;
      node.halo = makeStarHalo(def.color ?? 0xffffff, def.glowSize ?? (def.fixedSize ?? 1) * 6);
      node.halo.userData.bodyId = def.id;
      node.group.add(node.halo);
    }
    // 深空天体：挂一个默认隐藏的"放大展示物"，只有聚焦到它时才显示。
    // 银河系尺度上它仍然只是那个 0.07 的点，不会把星系画面撑满。
    if (def.deepSky) {
      node.deepSky = true;
      const showcase = makeDeepSkyShowcase(def);
      node.group.add(showcase);
      deepSkyShowcases.set(def.id, showcase);
    }
    nodes.push(node);
    byId.set(def.id, node);
  }

  // 银河系：恒星点云（旋臂 + 臂间 + 核球 + 银晕）挂到 galaxyGroup，随银盘一起自转
  if (system.galaxy) {
    galaxyField = buildGalaxyField(system.galaxy, system.galaxy.scaleKpc ?? 1);
    (galaxyGroup || scene).add(galaxyField);
    galaxyGlow = makeGalaxyGlow(system.galaxy.diskRadiusKpc);
    (galaxyGroup || scene).add(galaxyGlow);
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
  };
  const gui = new dat.GUI({ autoPlace: false });
  const guiContainer = document.getElementById('gui-container');
  if (guiContainer) guiContainer.appendChild(gui.domElement);
  gui.add(settings, 'timeScale', 0, 200).name(t('timeScale'));
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
      updateBadge(v);
    });

  // 彗尾强度：彗星只在接近太阳时才活动，长周期彗星在远日点要"等很久"才亮起来。
  // 这个滑块只放大尾巴的长度与亮度，不改变活动规律（仍严格按 1/r² 随日心距变化）。
  if (system.bodies.some((b) => b.comet)) {
    settings.tailGain = 1;
    gui.add(settings, 'tailGain', 0.5, 3, 0.1).name(t('tailGain'));
  }

  // 角标：常驻显示当前放大倍数，明确"这是为了看清小天体而做的视觉放大"
  const badge = document.createElement('div');
  badge.id = 'exaggerationBadge';
  document.body.appendChild(badge);
  function updateBadge(f) {
    const txt = Number.isInteger(f) ? String(f) : f.toFixed(1);
    badge.textContent = t('badge', txt);
  }
  updateBadge(settings.bodyExaggeration);
  if (views.length > 1) {
    const labels = views.map((v) => viewName(v.label));
    // 默认选中与 camera.frameTo 对应的那一档（views[0] 不一定就是默认视角）；
    // 支持 ?view=<id> 直接指定初始档位（截图 / 嵌入 iframe 时想停在某个范围）
    const want = new URLSearchParams(location.search).get('view');
    const byUrl = want ? views.findIndex((v) => v.id === want) : -1;
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
      if (n.model) n.model.traverse((c) => { if (c.isMesh) raycastTargets.push(c); });
    }
    if (sunMesh) raycastTargets.push(sunMesh);
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
    if (b.deepSky) {
      if (b.deepSky.kind === 'cluster') return 'cluster';
      if (b.deepSky.kind === 'blackhole') return 'blackhole';
      return 'nebula';
    }
    if (b.comet) return 'comet';
    if (b.navGroup === '系外行星系统') return 'exoplanet';
    if (b.navGroup === '疏散星团') return 'opencluster';
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
    for (const [, node] of byId) {
      if (node.mesh) node.mesh.scale.setScalar((node.def?.size ?? 0.07) * f);
      if (node.halo) node.halo.scale.setScalar((node.def?.glowSize ?? 0.4) * f);
    }
    for (const [, sc] of deepSkyShowcases) {
      const boost = sc.visible ? 3.0 : 1;
      sc.scale.setScalar((sc.userData.baseScale ?? 1) * f * boost);
      sc.traverse((o) => { if (o.isPoints) o.material.size = 0.035 * f * boost; });
    }
  }

  // 每档只显示「距离尺度匹配」的天体：太远的在画面外，太近的与太阳重合。
  // 窗口刻意留重叠，切档时天体渐次出现/退场，不会整屏跳变。
  function updateTierVisibility(i) {
    if (!TIERS) return;
    const span = TIERS[i].spanLy;
    const visibleGroups = new Set();
    for (const [sid, node] of byId) {
      const dLy = node.def?.dLy;
      // 下限取视野的 0.5%：比这更近的天体在该档里必然与太阳/彼此重合，
      // 显示出来只会误导（例如 10 万光年档列出 4 光年的比邻星）。
      const show = dLy == null || dLy === 0 ||
        (dLy >= span * 0.005 && dLy <= span * 1.5);
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
      const sunNode = byId.get('sun');
      if (sunNode?.group) sunNode.group.getWorldPosition(tierFocus);
      else tierFocus.set(...system.sunPos);
    }
    // 小档冻结银盘自转，否则几十光年视野里天体会持续漂走（沿用「聚焦即冻结」约定）
    paused = i > 0;

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
    updateScaleBarUI(i);

    // 背景层永不隐藏：小档把银盘点云切成固定 1.6px 的屏幕空间星点，
    // 既不随相机贴近膨胀成 bokeh 球，又能一直看到银河系的星光。
    if (galaxyField) {
      const m = galaxyField.material;
      // 只有全景档用透视点大小；从第 1 档起相机距离已经缩到 1/10，
      // 继续 sizeAttenuation 会让每个恒星点膨胀 10 倍，正是上一轮的 bokeh 圆斑。
      const wantAtten = i === 0;
      if (m.sizeAttenuation !== wantAtten) {
        m.sizeAttenuation = wantAtten;
        m.needsUpdate = true;
      }
      m.size = wantAtten ? (system.galaxy?.pointSize ?? 0.2) : 1.6;
    }
    // 银盘整体柔光是 15 kpc 尺度的东西，小档只会糊满屏；点云本身仍保留。
    if (galaxyGlow) galaxyGlow.visible = i === 0;
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

  // 选中并飞向某个天体（菜单点击 / 3D 拾取共用）
  function selectBody(id) {
    const def = infoById.get(id);
    const obj = focusObjectOf(id);
    if (!def || !obj) return;
    selected = def;
    if (TIERS) {
      // 银河系页：点菜单里的天体 = 自动切到它所属的比例尺档位，并把观察焦点移过去。
      // 不再用旧的「贴到 2 kpc 外看示意物」特写，背景与周围天体始终都在。
      const wp = new THREE.Vector3();
      obj.getWorldPosition(wp);
      paused = true;
      applyTier(def.tier ?? currentTier, { instant: true, focus: wp });
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
    // 卫星系统页：左上角常驻"返回上级系统"按钮
    if (system.parentSystem) {
      const back = document.createElement('a');
      back.className = 'bn-back';
      back.href = system.parentSystem.url;
      back.textContent = t('back', systemName(system.parentSystem.label));
      head.appendChild(back);
    }
    nav.appendChild(head);

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
        dist.textContent = distText(e.def.dLy);
        row.appendChild(dist);
      }
      row.onclick = () => selectBody(e.id);
      // 有下钻入口的天体：行内标签直达（行星→"卫星系"，太阳→"太阳系"等，可用 childSystemLabel 覆盖）
      if (e.def && e.def.childSystem) {
        const go = document.createElement('span');
        go.className = 'bn-go';
        const goLabel = systemName(e.def.childSystemLabel ?? t('childGo'));
        go.textContent = goLabel;
        go.title = t('childTitle', goLabel);
        go.onclick = (ev) => {
          ev.stopPropagation();
          window.location.href = e.def.childSystem;
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
  const targetCameraPosition = new THREE.Vector3();
  const homeVec = new THREE.Vector3(...homePosition);

  // 视角切换：飞向新位姿，同时更新"返回基准点"，保证关闭信息卡后回到当前视角
  const flyPos = new THREE.Vector3();
  const flyTarget = new THREE.Vector3();
  let flying = false;
  function applyView(idx) {
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
    detailEl.innerText = detail;
    // 有卫星系统的天体：信息卡里给出"进入卫星系统"按钮，点行星即可下钻
    const oldBtn = box.querySelector('.child-btn');
    if (oldBtn) oldBtn.remove();
    if (def.childSystem) {
      const btn = document.createElement('button');
      btn.className = 'child-btn';
      const goLabel = t('childBtn', systemName(def.childSystemLabel ?? bodyName(def)));
      btn.textContent = goLabel;
      btn.onclick = () => { window.location.href = def.childSystem; };
      box.querySelector('.planet-info-content').appendChild(btn);
    }
    box.style.display = 'block';
  }
  function closeInfo() {
    const box = document.getElementById('planetInfo');
    if (box) box.style.display = 'none';
    setActiveShowcase(null);
    // 银河系页保留当前比例尺档位，别把用户刚刚切到的尺度弹回全景；
    // 小档继续保持冻结，防止银盘自转把近邻恒星甩出画面。
    if (TIERS) { paused = currentTier > 0; return; }
    paused = false;
    isZoomingOut = true;
    controls.target.set(...homeTarget);
  }
  window.closeInfo = closeInfo;

  function focusOn(def, object) {
    const box = document.getElementById('planetInfo');
    if (box) box.style.display = 'none';
    // 进入聚焦立即冻结时间：天体（公转+自转）原地停住，相机飞向它"此刻"的位置，
    // 落地即严丝合缝居中。否则飞行途中天体仍在运动，等相机抵达时它已漂移出旧的落点，
    // 菜单聚焦（通常要飞很远）尤其明显——看起来就是"聚焦到一个空点，天体已不在那"。
    paused = true;

    const worldPos = new THREE.Vector3();
    object.getWorldPosition(worldPos);
    controls.target.copy(worldPos);
    camera.lookAt(worldPos);

    // 小卫星按自身半径取景，否则飞过去了还是看不见；
    // 彗星则要按"尾长"取景——按核半径飞过去会一头扎进彗发里（加法混合的雾会糊满屏幕）
    const tailUnits = def.comet ? (def.comet.ionTailUnits ?? 100) : 0;
    const offset = def.cameraOffset ?? Math.max(def.size * 8, tailUnits * 0.35, 2);
    targetCameraPosition
      .copy(worldPos)
      .add(camera.position.clone().sub(worldPos).normalize().multiplyScalar(offset));
    isMoving = true;
  }

  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('mousedown', (e) => {
    // 点在左侧菜单 / 信息卡上时不要触发 3D 拾取，否则会误聚焦
    if (e.target && e.target.closest && e.target.closest('#bodyNav, #planetInfo')) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(raycastTargets, false);
    if (!hits.length) return;
    const id = hits[0].object.userData.bodyId;
    if (!id) return;
    selectBody(id);
  });

  // ---------- 动画：真实时间驱动的开普勒运动 ----------
  let elapsedDays = 0;
  let last = performance.now();

  function animate() {
    const now = performance.now();
    const dtSec = Math.min((now - last) / 1000, 0.1);
    last = now;
    const dtDays = paused ? 0 : dtSec * settings.timeScale; // 本帧推进的真实天数
    elapsedDays += dtDays;

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
    // 彗发 / 彗尾：依赖本帧刚写好的位置与偏近点角，必须排在公转更新之后
    cometGlobals.uTime.value = performance.now() / 1000; // 驱动彗尾湍流缓慢漂移
    for (const n of nodes) {
      if (n.comet) updateComet(n, sunPos, settings.tailGain ?? 1);
    }

    // 银河系整体缓慢自转：只在全景档（currentTier===0）允许，小档一律冻结。
    // 小档视野只有几光年，任何自转都会让天体迅速漂出焦点。
    if (galaxyGroup && !paused && (!TIERS || currentTier === 0)) {
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

    // 悬停描边
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(raycastTargets, false);
    outlinePass.selectedObjects = hits.length ? [hits[0].object] : [];

    // 相机飞行：视角切换 > 点击聚焦 > 返回基准点
    if (flying) {
      camera.position.lerp(flyPos, 0.05);
      controls.target.lerp(flyTarget, 0.05);
      // 收敛阈值必须随档位缩放：固定 0.5 对全景档（相机距 50）没问题，
      // 但最内档相机距只有 ~5e-4，等于第一帧就判定"飞到了"，镜头根本没到位。
      const eps = TIERS
        ? Math.max(1e-7, tierCamDist(currentTier) * 0.01)
        : Math.max(0.5, flyPos.length() * 0.004);
      if (camera.position.distanceTo(flyPos) < eps) flying = false;
    } else if (isMoving) {
      camera.position.lerp(targetCameraPosition, 0.03);
      if (camera.position.distanceTo(targetCameraPosition) < 1) {
        isMoving = false;
        paused = true; // 飞抵后暂停时间，便于观察
        showInfo(selected);
      }
    } else if (isZoomingOut) {
      camera.position.lerp(homeVec, 0.05);
      if (camera.position.distanceTo(homeVec) < 1) isZoomingOut = false;
    }

    controls.update();
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
      const el = document.createElement('div');
      const type = typeOverride ?? bodyType(def);
      el.className = 'bl-item type-' + type;
      const dot = document.createElement('span');
      dot.className = 'bl-dot';
      const name = document.createElement('span');
      name.textContent = short;
      el.appendChild(dot);
      el.appendChild(name);
      labelLayer.appendChild(el);
      // 宽度按中英文字符估算，用于避让；不读 offsetWidth，避免每帧强制回流
      const w = [...short].reduce((s, ch) => s + (ch.charCodeAt(0) > 255 ? 12 : 7), 0) + 26;
      // 全景档所有近邻恒星都投影到太阳附近，卫星系统内卫星群也挤成一团：
      // 避让时优先保留中心天体 / 锚点与有名有姓的深空天体，普通成员让位。
      // 非银河系页里「无 orbit 且无 parent」的就是该子系统中心天体（木星、地球…）。
      const central = id === 'sun' || id === 'sagA' ||
        (!TIERS && !def.orbit && !def.parent);
      const weight = central ? -1
        : (type === 'nebula' || type === 'cluster' || type === 'blackhole') ? 0
        : type === 'star' ? 2 : 1;
      labelRows.set(id, { el, node, w, h: 18, weight });
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
      items.push({
        row, off,
        sx: (_labelV.x * 0.5 + 0.5) * W,
        sy: (-_labelV.y * 0.5 + 0.5) * H - 9,
        pri: id === selected?.id ? -1 : 0,
      });
    }
    // 贪心避让：选中的 > 锚点/深空天体 > 普通恒星，同级按屏幕纵坐标从上往下放；
    // 与已放置标签矩形重叠的直接收起，避免一堆名字糊成一团。
    items.sort((a, b) => a.pri - b.pri || a.row.weight - b.row.weight || a.y - b.y);
    const placed = [];
    // 左侧菜单 z-index 12 会盖住标签层（10）；把它当成一个已占用矩形，
    // 免得名字从菜单边缘露出半截。一次只读，且所有 DOM 写入都在后面。
    const navEl = document.querySelector('.body-nav');
    if (navEl) {
      const r = navEl.getBoundingClientRect();
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

  // ---------- 左侧天体快捷菜单 + 底部比例尺条 + 名字标签（注入式）----------
  buildBodyNav();
  buildBodyLabels();

  let scaleBar = null;
  function buildScaleBar() {
    if (!TIERS) return;
    const bar = document.createElement('div');
    bar.id = 'scaleBar';
    bar.className = 'scale-bar';
    const label = document.createElement('div');
    label.className = 'sb-label';
    label.append(document.createTextNode(t('scaleLabel')));
    label.appendChild(document.createElement('b'));
    bar.appendChild(label);
    const row = document.createElement('div');
    row.className = 'sb-tiers';
    TIERS.forEach((tier, i) => {
      const btn = document.createElement('button');
      btn.className = 'sb-tier';
      btn.textContent = tierShort(tier);
      btn.title = t('tierTitle', tierLabel(tier));
      btn.dataset.tier = String(i);
      btn.onclick = () => applyTier(i, { instant: true });
      row.appendChild(btn);
    });
    bar.appendChild(row);
    const hint = document.createElement('div');
    hint.className = 'sb-hint';
    hint.textContent = t('scaleHint');
    bar.appendChild(hint);
    document.body.appendChild(bar);
    scaleBar = bar;
  }
  function updateScaleBarUI(i) {
    if (!scaleBar) return;
    const b = scaleBar.querySelector('.sb-label b');
    if (b) b.textContent = tierLabel(TIERS[i]);
    for (const btn of scaleBar.querySelectorAll('.sb-tier')) {
      btn.classList.toggle('active', Number(btn.dataset.tier) === i);
    }
  }
  buildScaleBar();

  // ---------- ?focus=<id> / ?scale=<spanLy> 深链 ----------
  // 银河系页：?scale= 直接定位档位（用于博客 iframe 与逐档截图）；
  // ?focus= 自动切到该天体所属档位并把观察焦点移过去，背景与其它天体照常保留。
  const params = new URLSearchParams(location.search);
  const focusId = params.get('focus');
  const scaleParam = params.get('scale');
  if (TIERS) {
    let initTier = 0;
    if (scaleParam) {
      const found = TIERS.findIndex((t) => String(t.spanLy) === scaleParam || t.short === scaleParam);
      if (found >= 0) initTier = found;
    }
    let focusWp = null;
    if (focusId && infoById.has(focusId)) {
      const def = infoById.get(focusId);
      if (!scaleParam) initTier = def.tier ?? 0;
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
      paused = true;
      setActiveShowcase(focusId);
      highlightNav(focusId);
      showInfo(def);
    }
  } else if (focusId && infoById.has(focusId) && !flying) {
    // 其它系统页保持原有深链行为
    const def = infoById.get(focusId);
    const obj = focusObjectOf(focusId);
    if (obj) {
      const wp = new THREE.Vector3();
      obj.getWorldPosition(wp);
      controls.target.copy(wp);
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(wp).add(dir.multiplyScalar(def.cameraOffset ?? 2));
      camera.lookAt(wp);
      selected = def;
      paused = true;
      setActiveShowcase(focusId);
      highlightNav(focusId);
      showInfo(def);
    }
  }

  // ---------- 滚轮：跨 10× 自动切档 + 现有 zoomOutTo 边界 ----------
  // 卫星/行星系统页行为完全不变；银河系页由 animate() 在 controls.update() 后判档。
  const zoomOutUrl = system.parentSystem?.url ?? system.zoomOutTo?.url;
  window.addEventListener('wheel', (e) => {
    if (e.target && e.target.closest && e.target.closest('#bodyNav, #scaleBar')) return;
    // OrbitControls 的 wheel 监听挂在 canvas（target 阶段），本监听挂在 window
    // （冒泡阶段），执行到这里时 dolly 已完成，读到的相机距离就是本帧真实值。
    // 判定必须在事件里同步做且瞬间切档：若交给动画帧 + 飞行动画，飞行 lerp 会把
    // dolly 抵消，相机距离永远到不了边界（实测缩小到顶 60 次都没切回上一档）。
    const d = camera.position.distanceTo(controls.target);
    if (TIERS) {
      const base = tierCamDist(currentTier);
      if (e.deltaY < 0 && d <= base / 10) {
        if (currentTier < TIERS.length - 1) applyTier(currentTier + 1, { instant: true });
        else {
          // 最内档继续放大 → 下钻太阳系，接上现有 childSystem 边界
          const sunChild = infoById.get('sun')?.childSystem;
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
