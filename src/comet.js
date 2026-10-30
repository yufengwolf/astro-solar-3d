import * as THREE from 'three';
import { orbitPoint } from './bodies.js';

/**
 * 彗星视觉：核 + 彗发（辉光球）+ 两条粒子尾。
 *
 * 为什么单独成模块：彗星不是"一颗球"，它的可见部分几乎全是被太阳吹出来的。
 * 三条物理约束决定了这里的写法：
 *
 *   1. 尾巴方向 = 背离太阳（太阳风 / 辐射压），所以必须每帧按世界坐标重定向，
 *      不能挂在随轨道面旋转的 plane 节点下。
 *   2. 活动强度随日心距衰减（约 1/r²）。彗星只在接近太阳时才"长出"彗发与尾巴，
 *      在远日点就是一颗又黑又小、看不出特征的核——这正是它难以被发现的原因。
 *   3. 两类尾巴：离子尾（太阳风拖拽，笔直、偏蓝、更长）；尘埃尾（辐射压推动，
 *      因尘埃粒子轨道滞后而向运动反方向弯曲、偏黄、更宽更短）。
 *
 * 关于形状：早期版本用 ConeGeometry（圆锥）画尾巴，结果是边缘笔直、从尖端线性
 * 张开的"喇叭"，完全不像彗尾。这里改用**粒子系统 + 顶点着色器**逐粒子塑形：
 *   - 横向张开用 pow(t, 0.55) 而非线性 —— 真实彗尾是抛物线形张开，不是三角
 *   - 叠加随 t 增强、随时间漂移的湍流，尾巴会缓慢"飘动"而不是死板的几何体
 *   - 按 aStrand 给粒子分组形成"流线"+ 沿轴的明暗条纹（真实的 knot / striae 结构）
 *   - 尘埃尾末端按 t² 向运动反方向偏移 => 弯曲，而不是整条尾巴硬转一个角度
 *   - 边缘由粒子稀疏度自然产生，没有硬边界
 *
 * 长度以"场景单位"给出而非 AU：总览用的是幂律压缩距离（a^0.45），
 * 非线性映射下无法把 AU 线性换算成长度，因此尾巴长度是**视觉量**，已在文档中标注。
 * 但"何时亮、何时暗"用的是真实日心距（r = a(1 - e·cos E)），这部分是真实的。
 */

const DEFAULTS = {
  comaScale: 6, // 彗发半径 = 核半径 × 该值（满活动时）
  comaOpacity: 0.34,
  comaColor: 0xbfe6ff,
  comaFalloff: 2.0, // 辉光边缘衰减指数，越大中心越集中
  ionTailUnits: 100, // 离子尾满活动时的长度（场景单位）
  dustTailRatio: 0.62, // 尘埃尾长度 = 离子尾 × 该比例
  ionWidthRatio: 0.13, // 尾的横向张开半径 / 长度
  dustWidthRatio: 0.30, // 尘埃尾明显更宽
  ionOpacity: 0.55,
  dustOpacity: 0.42,
  ionColor: 0xbfe8ff, // 根部：彗发散射，偏青白
  ionColorTip: 0x4f9dff, // 末端：CO+ 荧光，偏蓝
  dustColor: 0xffeccb, // 根部：偏白黄
  dustColorTip: 0xffbe73, // 末端：偏橙（尘埃 reddening）
  onsetAU: 3.0, // 进入该日心距内活动强度达到 1，向外按 1/r² 衰减
  dustLag: 0.30, // 尘埃尾整体向"运动反方向"偏转的强度
  dustCurve: 0.10, // 尘埃尾末端额外弯曲量（相对长度，按 t² 施加）
  ionCurve: 0.015, // 离子尾也有一点太阳风扰动造成的弯曲
  ionParticles: 900,
  dustParticles: 700,
  ionTurb: 0.055, // 湍流幅度（相对长度）
  dustTurb: 0.032,
};

/**
 * 全场景共享的 uniform：所有彗星材质复用同一份对象，避免逐个遍历更新。
 * uTime 驱动湍流漂移，uPix 把"世界尺寸"换算成像素（gl_PointSize 需要）。
 */
export const cometGlobals = {
  uTime: { value: 0 },
  uPix: { value: 800 },
};

/** 窗口尺寸变化时重算像素换算系数：点大小 = 世界尺寸 × uPix / 视距 */
export function updateCometViewport(camera, heightPx) {
  const fov = (camera?.fov ?? 45) * (Math.PI / 180);
  cometGlobals.uPix.value = (heightPx * 0.5) / Math.tan(fov / 2);
}

// ---------------------------------------------------------------- 着色器

const COMA_VERT = `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalMatrix * normal;
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

// 彗发不做硬边球：按视线与法线的夹角做柔和衰减，得到自然的圆形辉光
const COMA_FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFalloff;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float a = pow(f, uFalloff);
  gl_FragColor = vec4(uColor, a * uOpacity);
}
`;

const TAIL_VERT = `
attribute float aT;      // 沿尾轴的归一化位置 0..1
attribute float aA;      // 绕轴角度
attribute float aR;      // 径向位置 0..1（已做幂律分布）
attribute float aSeed;   // 随机种子
attribute float aStrand; // 所属"流线"编号，用于形成丝状结构

uniform float uLen;
uniform float uWidth;
uniform float uTurb;
uniform float uOpacity;
uniform float uSize;
uniform float uPix;
uniform vec2  uCurve;
uniform float uKnot;
uniform float uFade;
uniform float uTime;

varying float vAlpha;
varying float vT;

void main() {
  float t = aT;
  // 每条流线有独立相位，粒子沿轴时逐渐拧转 -> 丝状/射线结构，而不是一团均匀雾
  float ph = aStrand * 7.3 + aSeed * 3.1;
  float ang = aA + t * (aSeed - 0.5) * 2.2 + ph * 0.15;

  // 张开用 pow(t, .55)：真实彗尾是抛物线形张开，线性张开就是"喇叭"
  float spread = uWidth * pow(t, 0.55);
  spread *= 0.72 + 0.56 * sin(ang * 2.0 + ph); // 横截面不是标准圆，有起伏
  vec2 xy = vec2(cos(ang), sin(ang)) * aR * spread;

  // 湍流：越靠尾部越乱，且随时间漂移 -> 尾巴缓慢飘动
  xy += vec2(
    sin(t * 5.5 + uTime * 0.50 + ph),
    cos(t * 3.7 + uTime * 0.38 + ph * 1.6)
  ) * uTurb * pow(t, 1.25);

  // 弯曲按 t² 施加：根部仍朝背日方向，越往末端越偏 -> 弯刀形，而非整条硬转角度
  xy += uCurve * t * t;

  vec3 p = vec3(xy, t) * uLen;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // 亮度：沿轴指数衰减 + 末端淡出 + 起点淡入（让尾巴从彗发里"长出来"）
  float fade = exp(-uFade * t) * (1.0 - smoothstep(0.75, 1.0, t));
  fade *= smoothstep(0.0, 0.045, t);
  // 沿轴明暗条纹：真实离子尾有 knot（结节）结构，会随太阳风扰动移动
  float knot = 0.62 + 0.38 * sin(t * uKnot + ph * 2.0);
  vAlpha = uOpacity * fade * knot * (0.45 + 0.55 * (1.0 - aR));
  vT = t;

  float sz = uSize * uLen * (0.012 + 0.05 * t);
  gl_PointSize = clamp(sz * uPix / max(0.001, -mv.z), 1.0, 26.0);
}
`;

const TAIL_FRAG = `
uniform vec3 uColor0;
uniform vec3 uColor1;
varying float vAlpha;
varying float vT;
void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float d2 = dot(pc, pc) * 4.0;
  if (d2 > 1.0) discard;
  float a = pow(1.0 - smoothstep(0.0, 1.0, d2), 1.7); // 软边光点，避免方块
  vec3 col = mix(uColor0, uColor1, vT);
  gl_FragColor = vec4(col, a * vAlpha);
}
`;

// ---------------------------------------------------------------- 构造

/** 简单的可复现随机数（避免每次刷新尾巴形状都变） */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 尾巴的点云几何。position 全填 0（真实位置在顶点着色器里算），
 * 因此必须关掉视锥剔除，否则会被错误地整体剔掉。
 */
function tailGeometry(count, seed) {
  const rnd = mulberry32(seed);
  const n = Math.max(1, count | 0);
  const position = new Float32Array(n * 3);
  const aT = new Float32Array(n);
  const aA = new Float32Array(n);
  const aR = new Float32Array(n);
  const aSeed = new Float32Array(n);
  const aStrand = new Float32Array(n);
  const strands = 14; // 流线条数：太少像几根线，太多又糊成一片

  for (let i = 0; i < n; i++) {
    // t 轻微非线性：靠近核的粒子更密（那里物质最新鲜）
    aT[i] = Math.pow(rnd(), 0.85);
    aA[i] = rnd() * Math.PI * 2;
    aR[i] = Math.pow(rnd(), 0.7); // 略偏向轴心，边缘自然稀疏
    aSeed[i] = rnd();
    aStrand[i] = (i % strands) + rnd() * 0.4;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  g.setAttribute('aA', new THREE.BufferAttribute(aA, 1));
  g.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  g.setAttribute('aStrand', new THREE.BufferAttribute(aStrand, 1));
  return g;
}

function tailPoints(count, seed, cfg) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uLen: { value: 0 },
      uWidth: { value: cfg.width },
      uTurb: { value: cfg.turb },
      uOpacity: { value: 0 },
      uSize: { value: cfg.size ?? 1 },
      uCurve: { value: new THREE.Vector2(0, 0) },
      uKnot: { value: cfg.knot },
      uFade: { value: cfg.fade },
      uColor0: { value: new THREE.Color(cfg.color0) },
      uColor1: { value: new THREE.Color(cfg.color1) },
      // 共享 uniform：时间（湍流漂移）与像素换算系数
      uTime: cometGlobals.uTime,
      uPix: cometGlobals.uPix,
    },
    vertexShader: TAIL_VERT,
    fragmentShader: TAIL_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending, // 发光叠加，不与背景争深度
    depthWrite: false,
    depthTest: true,
  });
  const pts = new THREE.Points(tailGeometry(count, seed), mat);
  pts.frustumCulled = false; // 位置在 shader 里算，包围球不可信
  pts.raycast = () => {}; // 尾巴不参与拾取：否则巨大的粒子云会挡住后面的天体
  return pts;
}

function comaMesh(color, opacity, falloff, scale) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uFalloff: { value: falloff },
    },
    vertexShader: COMA_VERT,
    fragmentShader: COMA_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
  m.scale.setScalar(scale);
  return m;
}

/**
 * 给彗星本体挂上彗发，并造出两条粒子尾（尾巴挂 scene 根，由调用方加入场景）。
 * @param {object} def 天体定义（需含 def.comet 配置）
 * @param {THREE.Mesh} mesh 本体（核）
 * @returns {{cfg:object, coma:THREE.Mesh, coma2:THREE.Mesh, ion:THREE.Points, dust:THREE.Points}}
 */
export function createCometParts(def, mesh) {
  const cfg = { ...DEFAULTS, ...(def.comet ?? {}) };
  const seed = (def.id ?? 'comet').split('').reduce((s, ch) => s + ch.charCodeAt(0), 0);

  // 彗发挂在核下面，会继承核的 scale(=def.size)，
  // 因此这里的 scale 是"相对核半径的倍数"，随视觉放大滑块自动同步增长。
  // 两层：内层亮而小（彗发核心），外层淡而大（外层氢冕）
  const coma = comaMesh(cfg.comaColor, cfg.comaOpacity, cfg.comaFalloff, cfg.comaScale);
  const coma2 = comaMesh(cfg.comaColor, cfg.comaOpacity * 0.35, cfg.comaFalloff * 0.6, cfg.comaScale * 2.1);
  coma.userData.bodyId = def.id;
  coma2.userData.bodyId = def.id;
  coma2.raycast = () => {};
  mesh.add(coma);
  mesh.add(coma2);

  const ion = tailPoints(cfg.ionParticles, seed + 1, {
    width: cfg.ionWidthRatio,
    turb: cfg.ionTurb,
    knot: 26, // 离子尾条纹细密
    fade: 2.2,
    size: 1.0,
    color0: cfg.ionColor,
    color1: cfg.ionColorTip,
  });
  const dust = tailPoints(cfg.dustParticles, seed + 2, {
    width: cfg.dustWidthRatio,
    turb: cfg.dustTurb,
    knot: 9, // 尘埃尾条纹粗疏
    fade: 2.9,
    size: 1.5, // 尘埃颗粒更大更散
    color0: cfg.dustColor,
    color1: cfg.dustColorTip,
  });
  ion.userData.bodyId = def.id;
  dust.userData.bodyId = def.id;
  ion.visible = false;
  dust.visible = false;

  return { cfg, coma, coma2, ion, dust };
}

// 复用的临时向量，避免每帧 new
const _pos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _dust = new THREE.Vector3();
const _lag = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _target = new THREE.Vector3();
const _inv = new THREE.Quaternion();

/**
 * 摆放一条尾巴：位置 + 朝向（尾轴 = 局部 +Z）+ 长度 + 亮度。
 * 长度写进 uniform 由顶点着色器使用，同时存一份到 userData 便于自检脚本读取。
 */
function placeTail(tail, pos, dir, len, opacity) {
  if (!(len > 0.05) || !(opacity > 0.004)) {
    tail.visible = false;
    tail.userData.length = 0;
    return;
  }
  tail.visible = true;
  tail.position.copy(pos);
  tail.userData.length = len;
  const u = tail.material.uniforms;
  u.uLen.value = len;
  u.uOpacity.value = Math.min(0.9, opacity);
  // lookAt 依赖 matrixWorld 中的当前位置，先刷新再定向
  tail.updateMatrixWorld(true);
  _target.copy(pos).add(dir);
  tail.lookAt(_target);
}

/**
 * 计算尾巴在**局部横截面**上的弯曲方向与强度。
 * 局部 +Z 是尾轴，因此把"运动反方向"转到局部坐标后取 (x, y) 即可。
 */
function applyCurve(tail, worldLagDir, strength) {
  const u = tail.material.uniforms;
  tail.userData.curve = u.uCurve.value; // 供自检脚本读取
  if (!strength) {
    u.uCurve.value.set(0, 0);
    return;
  }
  _inv.copy(tail.quaternion).invert();
  _lag.copy(worldLagDir).applyQuaternion(_inv);
  const m = Math.hypot(_lag.x, _lag.y);
  if (m < 1e-6) {
    u.uCurve.value.set(0, 0);
    return;
  }
  u.uCurve.value.set((_lag.x / m) * strength, (_lag.y / m) * strength);
}

/**
 * 每帧更新一条彗星的彗发与尾巴。
 *
 * @param {object} node createBody 返回的节点（需已挂载 node.comet）
 * @param {THREE.Vector3} sunPos 太阳的世界坐标
 * @param {number} tailGain 用户可调的彗尾强度倍数
 */
export function updateComet(node, sunPos, tailGain = 1) {
  const c = node.comet;
  const d = node.def;
  if (!c || !node.mesh || !d.orbit) return;
  const cfg = c.cfg;

  // ---- 活动强度：用真实日心距（真实偏心率 eReal，不受近日点渲染下限影响）----
  const eReal = d.orbit.eReal ?? d.orbit.e ?? 0;
  const aAU = d.orbit.aAU ?? (d.orbit.aKm ? d.orbit.aKm / 149597870.7 : 1);
  const rAU = Math.max(1e-4, aAU * (1 - eReal * Math.cos(node._E ?? 0)));
  const onset = cfg.onsetAU ?? 3;
  const act = Math.min(1, (onset * onset) / (rAU * rAU)); // 1/r² 衰减

  // ---- 彗发：远日点几乎消失，近日点膨胀 ----
  const comaScale = cfg.comaScale * (0.28 + 0.72 * act);
  c.coma.scale.setScalar(comaScale);
  c.coma2.scale.setScalar(comaScale * 2.1);
  const comaOp = Math.min(0.7, cfg.comaOpacity * (0.25 + 0.75 * act) * tailGain);
  c.coma.material.uniforms.uOpacity.value = comaOp;
  c.coma2.material.uniforms.uOpacity.value = comaOp * 0.35;

  // ---- 位置与背离太阳方向 ----
  node.mesh.getWorldPosition(_pos);
  _dir.copy(_pos).sub(sunPos);
  if (_dir.lengthSq() < 1e-8) _dir.set(0, 0, 1);
  _dir.normalize();

  // ---- 轨道运动方向：对位置做一次微小前插，得到速度方向（尘埃尾要向后偏）----
  const a = d.orbit.a;
  const e = d.orbit.e ?? 0;
  const E = node._E ?? 0;
  const q1 = orbitPoint(a, e, E);
  const q2 = orbitPoint(a, e, E + 0.002);
  _p1.set(q1.x, 0, q1.z);
  _p2.set(q2.x, 0, q2.z);
  node.plane.updateWorldMatrix(true, false);
  node.plane.localToWorld(_p1);
  node.plane.localToWorld(_p2);
  _p2.sub(_p1);
  if (_p2.lengthSq() < 1e-8) _p2.set(0, 0, 1);
  _p2.normalize();

  const lenIon = cfg.ionTailUnits * act * tailGain;
  const lenDust = cfg.ionTailUnits * cfg.dustTailRatio * act * tailGain;
  const opIon = cfg.ionOpacity * (0.35 + 0.65 * act) * tailGain;
  const opDust = cfg.dustOpacity * (0.35 + 0.65 * act) * tailGain;

  placeTail(c.ion, _pos, _dir, lenIon, opIon);

  // 尘埃尾滞后于运动方向：在"背离太阳"与"运动反方向"之间偏一个角度；
  // 弯曲量另由 shader 按 t² 施加，让末端比根部更偏 -> 弯刀形而非硬转的圆锥
  _dust.copy(_dir).addScaledVector(_p2, -cfg.dustLag);
  if (_dust.lengthSq() < 1e-8) _dust.copy(_dir);
  _dust.normalize();
  placeTail(c.dust, _pos, _dust, lenDust, opDust);

  // 弯曲必须在 lookAt 之后算（要用最终的 quaternion）
  _lag.copy(_p2).multiplyScalar(-1); // 运动反方向
  applyCurve(c.dust, _lag, cfg.dustCurve);
  applyCurve(c.ion, _lag, cfg.ionCurve);
}
