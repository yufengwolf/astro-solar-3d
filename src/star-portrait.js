/**
 * 恒星近景 LOD —— 太阳系以外天体「放大之后长什么样」。
 *
 * 分尺度原则（与 readme 的「远景是点 / 特写有形态」一致）：
 *   · 银河系全景档：恒星仍然只是 fixedSize=0.07 的一个点 + 光晕，绝不夸大成球；
 *   · 镜头真正靠近它（滚轮一路放大，或 ?body= 外链直达特写）时，才在**同一个
 *     世界坐标**上浮出一颗球体：程序化米粒组织光球 + 按光谱色着色 + 色球 / 日冕。
 *     这就是「用类似太阳的模型去建立」——球体 + 自发光表面 + 外层柔光，
 *     不需要为每颗恒星单独建模或贴图。
 *
 * 球径只表达**相对大小**：真实半径（太阳半径为单位）取 size-of-space
 * (src/data/objects.ts) 与常用恒星参数表，用对数压缩，让红超巨星明显更大但
 * 不至于比红矮星大几千倍把画面撑爆。它不参与银河系定位，也不改变档位尺度。
 *
 * 显隐完全由「相机到该恒星的距离 / 当前档位取景距离」决定，不依赖是否选中，
 * 所以任意一颗恒星只要被靠近就会显形；远景里所有近景球一律 invisible。
 */
import * as THREE from 'three';

// ---------- 纯数学（无 DOM / 无 Three.js 依赖，供 check:stars 直接断言） ----------

/**
 * 真实半径 → 近景球体的相对半径系数。
 * 0.15 R☉ 的红矮星 ≈ 0.75，1 R☉ ≈ 0.89，764 R☉ 的参宿四 ≈ 2.3（封顶 3）。
 */
export function starSizeFactor(radiusSun = 1) {
  const r = Math.max(0.02, Number(radiusSun) || 1);
  return Math.min(3, 0.72 + 0.55 * Math.log10(1 + r));
}

/**
 * 近景球的世界半径。
 * @param markerRadius 远景点的半径（def.size，银河系里恒为 0.07 场景单位）
 * @param tierFactor   当前档位的示意尺寸系数 10^(-0.8i)，与 applyTierScale 同款
 * @param cameraDistance 相机到该恒星的距离；用它封顶，防止相机钻进球里
 */
export function portraitRadius(markerRadius, tierFactor, radiusSun, cameraDistance) {
  const r = Math.max(1e-9, Number(markerRadius) || 0.07) * Math.max(1e-9, tierFactor) * 7
    * starSizeFactor(radiusSun);
  return Math.min(r, Math.max(cameraDistance, 1e-9) * 0.42);
}

/**
 * 距离驱动的淡入：档位取景距离处完全不可见（远景仍是一个点），
 * 缩到 0.43× 取景距离时完全显形。返回 0..1。
 */
export function portraitOpacity(cameraDistance, tierDistance) {
  if (!(tierDistance > 0) || !(cameraDistance >= 0)) return 0;
  return Math.max(0, Math.min(1, (tierDistance * 0.98 - cameraDistance) / (tierDistance * 0.55)));
}

/** 档位示意尺寸系数，必须与 main.js applyTierScale 保持一致 */
export const tierFactorOf = (i) => Math.pow(10, -Math.max(0, i) * 0.8);

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
