/**
 * 程序化「星系肖像」—— 进入某个星系自己的页面时，画出它自己的样子。
 *
 * 为什么不用一张照片贴图：星系是三维薄盘，贴一张平面照片一旋转就穿帮；
 * 而且四个星系共用一张图正是上一版被指出的毛病。这里用参数化绘制：
 *
 *   1) Canvas 盘面（局部 XY 正视图，之后由 3D 倾斜成椭圆）：
 *      指数盘渐变 → 对数螺旋旋臂（多次描边做柔光）→ 偏心棒 →
 *      暗尘环 / 断续尘弧（destination-out 真实地"擦掉"背后的光，而不是
 *      叠一层黑颜料）→ 电离氢区亮结 → 核球与核点。
 *   2) 三维点云：盘星 + 臂星 + 亮结，带薄盘厚度，随盘一起倾斜；
 *      放大到小比例尺档时点大小被钳成屏幕像素，不会膨胀成光斑。
 *   3) 前景恒星：银河系内的近处恒星，挂在最外层，不随盘倾斜，
 *      所以看起来是"照片上撒的星点"而不是星系里的成员。
 *
 * 只在星系自己的页面出现；在上级（本星系群 / 宇宙网）视野里，它仍是
 * 一个点 —— 分尺度，才既看得到形态，又不夸大天体尺寸。
 */
import * as THREE from 'three';
import { portraitOf } from './portraits.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

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
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function mix(a, b, t) {
  const x = rgb(a), y = rgb(b);
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
}

let _discTex = null;
function discTexture() {
  if (_discTex) return _discTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.22)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _discTex = new THREE.CanvasTexture(c);
  return _discTex;
}

/** 生成对数螺旋臂的像素坐标点列；flocculent 时打断裂成絮状短段 */
function armPaths(p, rng, S, R) {
  const C = S / 2;
  const n = p.arms ?? 0;
  const out = [];
  if (!n) return out;
  const b = p.armTwist;
  const r0 = R * (p.armStart ?? 0.2);
  const thetaMax = Math.log((R * 0.95) / r0) / b;
  const steps = 190;
  for (let k = 0; k < n; k++) {
    const phase = (k / n) * TAU + (p.armPhase ?? 0.35);
    const pts = [];
    let broken = false;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * thetaMax;
      const wobble = p.flocculent
        ? Math.sin(t * 7 + k * 2.1) * R * 0.035 * p.flocculent + randn(rng) * R * 0.012 * p.flocculent
        : 0;
      const r = r0 * Math.exp(b * t) + wobble;
      const a = t + phase + Math.sin(t * 3 + k) * 0.035 * (p.flocculent ?? 0);
      // 絮状臂：随机断口，用 null 让描边重新起笔
      if (p.flocculent && i > 8 && i < steps - 8 && rng() < 0.062 * p.flocculent) {
        broken = true;
        pts.push(null);
        continue;
      }
      if (broken && rng() < 0.86) { pts.push(null); continue; }
      broken = false;
      pts.push({ x: C + r * Math.cos(a), y: C + r * Math.sin(a), r, a });
    }
    // path 保留 null 作为描边断口；points 是采样用的纯净点列
    out.push({ path: pts, points: pts.filter(Boolean) });
  }
  return out;
}

function strokePaths(g, pts, color, width, alpha, blur) {
  g.lineWidth = width;
  g.strokeStyle = rgba(color, alpha);
  g.shadowBlur = blur;
  g.shadowColor = rgba(color, Math.min(1, alpha * 1.6));
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  let pen = false;
  for (const q of pts) {
    if (q == null) { pen = false; continue; }
    if (!pen) { g.moveTo(q.x, q.y); pen = true; } else g.lineTo(q.x, q.y);
  }
  g.stroke();
  g.shadowBlur = 0;
}

/** 把形态参数画成一张 RGBA 盘面贴图（黑底处是透明，露出宇宙背景） */
function paintDisc(p, rng, paths) {
  const S = 1024, C = S / 2, R = S * 0.455;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.globalCompositeOperation = 'source-over';

  // 1) 指数盘：内暖外冷（M31 黄核蓝盘）或内冷外暖（M33 青核橙红外缘）
  const grd = g.createRadialGradient(C, C, 0, C, C, R);
  grd.addColorStop(0, rgba(p.diskInner, 0.60));
  grd.addColorStop(0.16, rgba(p.diskMid, 0.46));
  grd.addColorStop(0.48, rgba(p.diskMid, 0.27));
  // M33 这类外缘橙红的星系，让暖色提前进盘，橙红才是"弥漫的尘埃网"
  // 而不是只剩几条粗旋臂；普通星系保持外缘才出现的冷色淡晕。
  const outerStart = p.outerStart ?? 0.79;
  if (outerStart < 0.7) {
    grd.addColorStop(outerStart, rgba(p.diskOuter, 0.30));
    grd.addColorStop(0.88, rgba(p.diskOuter, 0.15));
  } else {
    grd.addColorStop(outerStart, rgba(p.diskOuter, 0.15));
  }
  grd.addColorStop(1, rgba(p.diskOuter, 0));
  g.fillStyle = grd;
  g.beginPath(); g.arc(C, C, R, 0, TAU); g.fill();

  // 2) 旋臂：宽→窄多层描边叠出柔光；M31 压低对比，M33 提高对比
  const contrast = p.armContrast ?? 0.8;
  const widthScale = (p.armWidth ?? 0.10) / 0.10;
  for (const arm of paths) {
    for (const [w, a, blur] of [[0.17, 0.085, 36], [0.10, 0.15, 20], [0.045, 0.24, 9], [0.014, 0.28, 2]]) {
      strokePaths(g, arm.path, p.armColor, R * w * widthScale, a * contrast, blur);
    }
  }

  // 3) 偏心棒（不规则星系 / 棒旋）
  if (p.bar) {
    g.save();
    g.translate(C, C);
    g.rotate((p.positionAngle + 12) * DEG);
    const bg = g.createLinearGradient(-R * p.bar, 0, R * p.bar, 0);
    // 不规则星系的棒是密集恒星，不是一盏白色射灯：用盘色、低亮度，
    // 避免 bloom 把中心洗成和其它星系一样的纯白飞盘。
    bg.addColorStop(0, rgba(p.diskMid, 0));
    bg.addColorStop(0.5, rgba(p.diskMid, 0.22));
    bg.addColorStop(1, rgba(p.diskMid, 0));
    g.fillStyle = bg;
    g.shadowBlur = 12; g.shadowColor = rgba(p.diskMid, 0.18);
    g.beginPath();
    g.ellipse(0, 0, R * p.bar, R * 0.075, 0, 0, TAU);
    g.fill();
    g.restore();
    g.shadowBlur = 0;
  }

  // 4) 暗尘带：destination-out 把背后的星光"擦掉"，这才是遮挡而非涂黑
  g.globalCompositeOperation = 'destination-out';
  if (p.dustRings?.length) {
    for (let k = 0; k < p.dustRings.length; k++) {
      const rr = p.dustRings[k] * R;
      g.beginPath();
      let pen = false;
      for (let i = 0; i <= 200; i++) {
        const a = (i / 200) * TAU;
        // 真实 M31 的尘环是断裂、缠绕的，不是闭合的同心靶心
        if (Math.sin(a * 2.3 + k * 2.1) + 0.5 * Math.sin(a * 5.1 + k) > 0.95) {
          pen = false;
          continue;
        }
        const wav = 1 + 0.055 * Math.sin(a * 3 + k * 1.7) + 0.025 * Math.sin(a * 7 + k);
        const x = C + rr * wav * Math.cos(a);
        const y = C + rr * wav * Math.sin(a);
        if (!pen) { g.moveTo(x, y); pen = true; } else g.lineTo(x, y);
      }
      g.lineWidth = R * p.dustWidth * (1 + k * 0.18);
      g.strokeStyle = `rgba(0,0,0,${p.dustStrength * (1 - k * 0.08)})`;
      g.shadowBlur = 14; g.shadowColor = 'rgba(0,0,0,0.6)';
      g.lineCap = 'round';
      g.stroke();
    }
  } else if (p.dustArc) {
    // 絮状星系：沿旋臂内缘的断续尘弧
    for (const arm of paths) {
      const pts = arm.points;
      for (let i = 0; i < pts.length - 2; i += 3) {
        if (rng() > p.dustArc) continue;
        const q = pts[i];
        const inner = 0.94;
        const x = C + (q.x - C) * inner, y = C + (q.y - C) * inner;
        g.beginPath();
        g.arc(x, y, R * p.dustWidth * (0.7 + rng()), 0, TAU);
        g.fillStyle = `rgba(0,0,0,${p.dustStrength})`;
        g.fill();
      }
    }
  }
  g.globalCompositeOperation = 'source-over';
  g.shadowBlur = 0;

  // 5) 电离氢区 / 亮星协：沿旋臂撒柔光小结，画在尘埃之后所以仍然明亮
  const hiiN = Math.round(210 * (p.hii ?? 0.6));
  const bias = p.hiiBias ?? [0, 0];
  for (let i = 0; i < hiiN; i++) {
    let x, y;
    if (paths.length) {
      const pts = paths[Math.floor(rng() * paths.length)].points;
      const q = pts[Math.floor(rng() * pts.length)];
      x = q.x + randn(rng) * R * 0.026;
      y = q.y + randn(rng) * R * 0.026;
    } else {
      // 无旋臂的不规则星系：结偏在盘的一侧（蜘蛛星云）
      const a = rng() * TAU, r = Math.sqrt(rng()) * R * 0.7;
      x = C + r * Math.cos(a) + bias[0] * R * 0.6;
      y = C + r * Math.sin(a) + bias[1] * R * 0.6;
    }
    const rad = R * (0.006 + rng() * 0.020);
    const hg = g.createRadialGradient(x, y, 0, x, y, rad);
    hg.addColorStop(0, rgba(p.hiiColor, 0.85));
    hg.addColorStop(0.4, rgba(p.hiiColor, 0.32));
    hg.addColorStop(1, rgba(p.hiiColor, 0));
    g.fillStyle = hg;
    g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
  }

  // 6) 核球：最后盖上，中心最亮；M33 / 麦哲伦云几乎没有核球
  const br = R * (p.bulge ?? 0.1);
  const bg = g.createRadialGradient(C, C, 0, C, C, br * 2.4);
  bg.addColorStop(0, rgba(p.coreColor, p.coreGlow ?? 0.9));
  bg.addColorStop(0.22, rgba(p.coreColor, (p.coreGlow ?? 0.9) * 0.72));
  bg.addColorStop(0.55, rgba(p.diskInner, 0.24));
  bg.addColorStop(1, rgba(p.diskInner, 0));
  g.fillStyle = bg;
  g.beginPath(); g.arc(C, C, br * 2.4, 0, TAU); g.fill();

  return { canvas: cv, S, C, R };
}

/**
 * @param {string} nodeId universe.js 的节点 id
 * @returns {{group:THREE.Group, disc:THREE.Mesh, diskPointLayers:Array, config:object}|null}
 */
export function buildGalaxyPortrait(nodeId) {
  const p = portraitOf(nodeId);
  if (!p) return null;
  const rng = mulberry32(p.seed);
  const S = 1024, C = S / 2, Rpx = S * 0.455;
  const R = p.radius;
  const paths = armPaths(p, rng, S, Rpx);
  const { canvas } = paintDisc(p, rng, paths);

  const group = new THREE.Group();
  const spin = new THREE.Group();
  spin.rotation.z = (p.positionAngle ?? 0) * DEG;
  const tilt = new THREE.Group();
  // 天文倾角 0=正视（法线朝相机 +Z），90=侧视（法线 +Y）。
  // disc 躺平时法线是 +Y，绕 X 转 (90-i) 度后即得到目标视角。
  tilt.rotation.x = (90 - (p.inclination ?? 45)) * DEG;
  if (p.stretch) tilt.scale.z = p.stretch;
  group.add(spin);
  spin.add(tilt);

  // ---- 盘面 ----
  const tex = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  else if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  const disc = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * R, 2 * R),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false,
      blending: THREE.NormalBlending, opacity: 1,
    }),
  );
  disc.rotation.x = -Math.PI / 2;   // 躺进盘平面 XZ
  disc.renderOrder = -1;            // 先画盘，再叠加发光恒星点
  tilt.add(disc);

  // ---- 盘内恒星点云 ----
  const toScene = (px, py) => [(px - C) / Rpx * R, (py - C) / Rpx * R];
  const pos = [], col = [], hiiPos = [], hiiCol = [];
  const push = (arrP, arrC, x, y, z, c, k) => {
    arrP.push(x, y, z);
    arrC.push(Math.min(1, c[0] / 255 * k), Math.min(1, c[1] / 255 * k), Math.min(1, c[2] / 255 * k));
  };
  // 弥散盘星：内暖外冷，亮度压低，只做"颗粒感"
  for (let i = 0; i < (p.diskStars ?? 7000); i++) {
    const r = Math.sqrt(rng()) * R * 0.98;
    const a = rng() * TAU;
    const t = Math.min(1, r / R);
    const c = t < 0.5 ? mix(p.diskInner, p.diskMid, t * 2) : mix(p.diskMid, p.diskOuter, (t - 0.5) * 2);
    push(pos, col, Math.cos(a) * r, randn(rng) * R * 0.012, Math.sin(a) * r,
      c, 0.22 + rng() * 0.38);
  }
  // 旋臂亮星：沿臂撒点，带横向散射；颜色偏白蓝 / 橙红
  for (let i = 0; i < (p.armStars ?? 4000); i++) {
    if (!paths.length) break;
    const pts = paths[Math.floor(rng() * paths.length)].points;
    const q = pts[Math.floor(rng() * pts.length)];
    const [sx, sz] = toScene(q.x, q.y);
    const j = R * 0.022;
    push(pos, col, sx + randn(rng) * j, randn(rng) * R * 0.009, sz + randn(rng) * j,
      mix(p.armColor, '#ffffff', rng() * 0.35), 0.5 + rng() * 0.55);
  }
  // 亮结（电离氢区）：单独一层，点稍大
  const hiiC = rgb(p.hiiColor);
  for (let i = 0; i < Math.round(380 * (p.hii ?? 0.6)); i++) {
    let q;
    if (paths.length) {
      const pts = paths[Math.floor(rng() * paths.length)].points;
      q = pts[Math.floor(rng() * pts.length)];
    } else {
      const a = rng() * TAU, r = Math.sqrt(rng()) * R * 0.75;
      const bias = p.hiiBias ?? [0, 0];
      q = { x: C + (r * Math.cos(a) + bias[0] * R * 0.6) / R * Rpx,
            y: C + (r * Math.sin(a) + bias[1] * R * 0.6) / R * Rpx };
    }
    const [sx, sz] = toScene(q.x, q.y);
    push(hiiPos, hiiCol, sx + randn(rng) * R * 0.02, randn(rng) * R * 0.008,
      sz + randn(rng) * R * 0.02, hiiC, 0.75 + rng() * 0.5);
  }

  const mkPoints = (pa, ca, size) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pa, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(ca, 3));
    const m = new THREE.Points(geo, new THREE.PointsMaterial({
      size, map: discTexture(), vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
      sizeAttenuation: true, toneMapped: false,
    }));
    m.renderOrder = 1;
    tilt.add(m);
    return m;
  };
  const diskPointLayers = [
    mkPoints(pos, col, R * 0.0055),
    mkPoints(hiiPos, hiiCol, R * 0.010),
  ];

  // ---- 前景恒星：不随盘倾斜，屏幕空间固定像素大小 ----
  const fgPos = [], fgCol = [], fgBig = [], fgBigCol = [];
  const starCols = ['#fff4d6', '#ffd9a0', '#ffffff', '#cfe0ff'];
  for (let i = 0; i < (p.foreground ?? 70); i++) {
    const x = (rng() * 2 - 1) * 26;
    const y = (rng() * 2 - 1) * 17;
    const z = 5 + rng() * 16;
    const c = rgb(starCols[Math.floor(rng() * starCols.length)]);
    const k = 0.35 + Math.pow(rng(), 2) * 0.9;
    const target = rng() < 0.12 ? [fgBig, fgBigCol] : [fgPos, fgCol];
    target[0].push(x, y, z);
    target[1].push(c[0] / 255 * k, c[1] / 255 * k, c[2] / 255 * k);
  }
  const mkForeground = (pa, ca, size) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pa, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(ca, 3));
    const m = new THREE.Points(geo, new THREE.PointsMaterial({
      size, map: discTexture(), vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
      sizeAttenuation: false, toneMapped: false,
    }));
    m.renderOrder = 2;
    group.add(m);
    return m;
  };
  if (fgPos.length) mkForeground(fgPos, fgCol, 2.2);
  if (fgBig.length) mkForeground(fgBig, fgBigCol, 5.0);

  return { group, disc, diskPointLayers, config: p };
}
