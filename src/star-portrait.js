/**
 * 恒星近景模型 —— 太阳系以外天体「放大之后长什么样」。
 *
 * 建模仍是「用类似太阳的模型去建立」：程序化米粒组织光球 + 色球 / 日冕，
 * 不需要为每颗恒星单独建模或贴图。但**球有多大、什么时候看得见、缩放停在哪些
 * 尺度**全部交给 src/zoom-ladder.js 的真实物理量决定：
 *
 *  · 球半径 = 真实半径（R☉ = 7.3535×10⁻⁸ 光年），不再用 0.05 光年的示意封顶；
 *  · 显隐看「相机距离 / 恒星真实半径」的角尺寸，而不是固定 1 光年门槛；
 *  · 聚焦自动落到 9R 的特写，缩小时按周围真实邻居距离跳过空白尺度。
 *
 * 本文件只负责生成 Three.js 对象；所有尺度数学都从 zoom-ladder.js 转出，
 * 便于 check:stars 在 Node 里直接断言。
 */
import * as THREE from 'three';

export * from './zoom-ladder.js';

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
