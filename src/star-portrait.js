/**
 * 恒星近景 LOD —— 太阳系以外天体「放大之后长什么样」。
 *
 * 分尺度原则（与 readme 的「远景是点 / 特写有形态」一致）。这里有三条硬规则，
 * 都是为了修掉上一版「1 万光年档稍微放大就冒出一堆互相重叠的球」：
 *
 *  1. **绝对尺度门槛**：只有当前档位视野 ≤ 1 光年，且相机距该恒星 < 1 光年时，
 *     才允许出现球体。档位取景距离随每档缩小 10×，1 万光年档连能缩到的最近
 *     距离都是上千光年 —— 物理上根本不可能触发，大尺度上永远是点。
 *     旧版只看「相机距离 / 本档取景距离」的相对比例，于是任何档位稍一滚轮
 *     所有恒星就集体淡入，且球径按 10^(-0.8i) 随粗档膨胀到几百光年。
 *  2. **一帧最多一颗球**：恒星彼此至少相距几光年（最近的比邻星—南门二也隔
 *     约 0.21 光年），1 光年视野装不下第二颗。候选里只挑离相机最近的一颗。
 *  3. **球径绝对封顶 0.05 光年**（直径 0.1 光年），比最近恒星对间距还小，
 *     不随档位系数放大；只按真实半径（太阳半径为单位）表达相对大小。
 *
 * 球体本身仍是「用类似太阳的模型去建立」：程序化米粒组织光球 + 色球 / 日冕，
 * 不需要为每颗恒星单独建模；它不参与银河系定位，也不改变档位尺度。
 */
import * as THREE from 'three';

// ---------- 纯数学（无 DOM / 无 Three.js 依赖，供 check:stars 直接断言） ----------

/** 1 场景单位 = 1 kpc = 3261.56 光年（与 systems/galaxy.js 的 LY_PER_KPC 一致） */
export const UNITS_PER_LY = 1 / 3261.56;
/** 只有视野跨度 ≤ 1 光年的档位（6 档里的最内档）才允许出现球体 */
export const PORTRAIT_TIER_SPAN_LY = 1;
/** 相机进入恒星 1 光年以内才可能显形；0.55 光年及更近完全不透明 */
export const PORTRAIT_REVEAL_LY = 1;
export const PORTRAIT_FULL_LY = 0.55;
/** 外链直达把镜头放到这个距离（光年），保证一打开就看到球面 */
export const PORTRAIT_CLOSEUP_LY = 0.45;
/** 球半径上限（光年）：直径 0.1 ly < 最近恒星对间距 0.21 ly，绝不互相穿插 */
export const PORTRAIT_MAX_RADIUS_LY = 0.05;

/**
 * 真实半径 → 近景球体的相对半径系数。
 * 0.15 R☉ 的红矮星 ≈ 0.75，1 R☉ ≈ 0.89，764 R☉ 的参宿四 ≈ 2.3（封顶 3）。
 */
export function starSizeFactor(radiusSun = 1) {
  const r = Math.max(0.02, Number(radiusSun) || 1);
  return Math.min(3, 0.72 + 0.55 * Math.log10(1 + r));
}

/** 档位硬门槛：1 万 / 1 千 / 100 / 10 光年档一律不许出现球体。 */
export function tierAllowsPortrait(spanLy) {
  return Number.isFinite(spanLy) && spanLy <= PORTRAIT_TIER_SPAN_LY;
}

/** 绝对距离门槛：相机到该恒星必须小于 1 光年。 */
export function starWithinPortrait(dLy) {
  return Number.isFinite(dLy) && dLy >= 0 && dLy < PORTRAIT_REVEAL_LY;
}

/**
 * 唯一性：给一组候选 { id, dLy, visible }，返回这一帧唯一允许显形的 id。
 * 档位不符、或没有任何恒星进入 1 光年内 → null（全部隐藏，仍只是点）。
 */
export function selectStarPortrait(candidates, spanLy) {
  if (!tierAllowsPortrait(spanLy)) return null;
  let best = null;
  for (const c of candidates) {
    if (!c || !c.visible || !starWithinPortrait(c.dLy)) continue;
    if (!best || c.dLy < best.dLy) best = c;
  }
  return best ? best.id : null;
}

/** 淡入：1 光年处 0，0.55 光年及更近处 1（参数是光年，不是场景单位）。 */
export function portraitOpacity(dLy) {
  if (!starWithinPortrait(dLy)) return 0;
  return Math.min(1, (PORTRAIT_REVEAL_LY - dLy) / (PORTRAIT_REVEAL_LY - PORTRAIT_FULL_LY));
}

/**
 * 近景球的世界半径（场景单位）：按真实半径相对大小给出 0.0225~0.05 光年，
 * 再按相机距离封顶，防止贴太近时钻进球内。与档位系数完全无关。
 * @param radiusSun 真实半径 / 太阳半径
 * @param cameraDistanceUnits 相机到恒星的距离（场景单位）
 * @param unitsPerLy 1 光年 = 多少场景单位
 */
export function portraitRadius(radiusSun, cameraDistanceUnits, unitsPerLy = UNITS_PER_LY) {
  const rel = starSizeFactor(radiusSun) / starSizeFactor(1);
  const rLy = Math.min(PORTRAIT_MAX_RADIUS_LY, PORTRAIT_MAX_RADIUS_LY * 0.45 * rel);
  const u = Number.isFinite(unitsPerLy) && unitsPerLy > 0 ? unitsPerLy : UNITS_PER_LY;
  return Math.min(rLy * u, Math.max(cameraDistanceUnits, 1e-12) * 0.42);
}

// ---------- 程序化贴图（不依赖外部图片，静态部署 / 离线可用） ----------

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _photosphere = null;
/** 米粒组织光球：多倍频值噪声，横向可无缝平铺；灰度图，颜色由 material.color 着色 */
function photosphereTexture() {
  if (_photosphere) return _photosphere;
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const rng = mulberry32(20261109);

  const grid = (cols, rows) => {
    const a = new Float32Array(cols * rows);
    for (let i = 0; i < a.length; i++) a[i] = rng();
    return { cols, rows, a };
  };
  // x 方向取模 → 球体 UV 接缝处不会出现一条竖线
  const sample = (gr, u, v) => {
    const x = u * gr.cols, y = v * (gr.rows - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const at = (cx, cy) => gr.a[((cy % gr.rows) + gr.rows) % gr.rows * gr.cols
      + ((cx % gr.cols) + gr.cols) % gr.cols];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy)
      + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
  };
  const g1 = grid(10, 6), g2 = grid(28, 15), g3 = grid(78, 40);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / (H - 1);
      const n = 0.52 * sample(g1, u, v) + 0.32 * sample(g2, u, v) + 0.16 * sample(g3, u, v);
      // 米粒组织的对比很弱：0.74~1.0 的灰度，避免变成一颗花斑球
      const val = Math.round(255 * (0.74 + 0.26 * Math.pow(n, 0.8)));
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  _photosphere = new THREE.CanvasTexture(c);
  _photosphere.colorSpace = THREE.SRGBColorSpace;
  _photosphere.wrapS = THREE.RepeatWrapping;
  return _photosphere;
}

const _glowTex = new Map();
/** kind = corona（柔光日冕） / rim（贴着边缘的色球亮环） */
function glowTexture(kind) {
  if (_glowTex.has(kind)) return _glowTex.get(kind);
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  if (kind === 'rim') {
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.68, 'rgba(255,255,255,0)');
    grd.addColorStop(0.79, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.90, 'rgba(255,255,255,0.28)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.42, 'rgba(255,255,255,0.16)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
  }
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  _glowTex.set(kind, tex);
  return tex;
}

function glowSprite(color, kind, scale) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(kind),
    color,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  sp.scale.setScalar(scale);
  return sp;
}

/**
 * 生成一颗恒星的近景特写。返回 { group, sphere, corona, rim }。
 * group 默认 invisible，由 main.js updateStarPortraits() 每帧按距离显隐与缩放。
 * group 的 scale 即球体半径，所有子对象都用单位尺寸。
 */
export function createStarPortrait(def) {
  const color = def.color ?? 0xfff0c0;
  const group = new THREE.Group();
  group.visible = false;
  group.name = `star-portrait:${def.id}`;

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshBasicMaterial({
      map: photosphereTexture(),
      color,
      transparent: true,
      opacity: 1,
      toneMapped: false,   // 自发光恒星交给 bloom 出辉光，不受曝光压暗
    }),
  );
  sphere.userData.bodyId = def.id;
  group.add(sphere);

  // 色球亮环贴着球缘，日冕往外散开；两者都是 billboard，不随球体自转
  const rim = glowSprite(color, 'rim', 2.18);
  const corona = glowSprite(color, 'corona', 3.6);
  group.add(rim, corona);

  return { group, sphere, corona, rim };
}
