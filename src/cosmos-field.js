/**
 * 通用「大尺度结构」背景点云 —— 只画结构，不画天体。
 *
 * 上一版给每个可点击成员撒 900 个点，形成一颗白色「绒球」：
 *   · 本星系群页里银河系、仙女座、三角座、大小麦哲伦云长得一模一样，
 *     而且每个都被画成横跨几万光年的大球；
 *   · 可观测宇宙 / 拉尼亚凯亚 / 室女座页的每个结点也是同一颗绒球。
 * 在 1000 万光年乃至 930 亿光年的视野里，一个星系本来就只是像素级的
 * 一个点，把它画成球是数量级错误，也完全体现不出宇宙的空旷。
 *
 * 现在成员本体交给 main.js 的 star mesh + halo：按真实直径给不同的
 * 颜色、亮度与大小，一律是点；身份由名字标签、左侧菜单和信息卡用文字点出。
 * 这里只负责「宇宙网纤维 / 空洞 / 稀薄场星系」这类**结构**：
 *   · 宇宙 / 超星系团层：保留纤维网，结点只是纤维汇聚处一小撮暗点，
 *     密度、范围、颜色按成员自身数据变化，不再有统一的白球；
 *   · 星系群 / 星系团 / 单个星系层：星系之间本来就是近乎全黑的空间，
 *     只留极稀疏的暗场星系点与寥寥几颗更暗的伴星系。
 *
 * 纯程序化，无外部贴图 / 数据文件，静态部署与离线都能用。
 */
import * as THREE from 'three';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 文字精灵：在 3D 场景里做标注（如视界球）。仅在浏览器渲染时调用。 */
function makeTextSprite(text, color) {
  const fs = 48, pad = 10;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `bold ${fs}px sans-serif`;
  const tw = Math.ceil(g.measureText(text).width);
  c.width = tw + pad * 2;
  c.height = fs + pad * 2;
  const ctx = c.getContext('2d');
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, pad, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.userData.aspect = c.width / c.height;
  return sp;
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
  grd.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.65, 'rgba(255,255,255,0.16)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _discTex = new THREE.CanvasTexture(c);
  return _discTex;
}

// 每类的调色板：[纤维冷色, 弥散背景色]，线性 RGB 三元组。
// 结点不再用统一暖白，而是取成员自己的 color。
const PALETTE = {
  universe: [[0.28, 0.48, 1.00], [0.30, 0.31, 0.56]],
  supercluster: [[0.34, 0.60, 1.00], [0.32, 0.33, 0.58]],
  cluster: [[0.50, 0.66, 1.00], [0.34, 0.38, 0.60]],
  group: [[0.54, 0.70, 1.00], [0.32, 0.36, 0.56]],
  galaxy: [[0.46, 0.64, 1.00], [0.34, 0.34, 0.56]],
  void: [[0.40, 0.54, 0.86], [0.26, 0.30, 0.48]],
};

/** 锚点兼容两种写法：坐标数组，或 { pos, color, weight } */
function normAnchor(a) {
  if (Array.isArray(a)) return { pos: a, rgb: [0.82, 0.86, 1], weight: 0.5 };
  const hex = a.color ?? 0xffffff;
  return {
    pos: a.pos ?? [0, 0, 0],
    rgb: [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255],
    weight: Math.max(0, Math.min(1, a.weight ?? 0.5)),
  };
}

/**
 * @param {object} cfg
 * @param {string} cfg.kind        universe | supercluster | cluster | group | galaxy
 * @param {number} cfg.seed        随机种子，保证每一层画面稳定可复现
 * @param {Array}  cfg.anchors     可点击成员：坐标数组或 { pos, color, weight }
 * @param {number} cfg.pointSize   全景档点大小（场景单位）
 * @param {number} cfg.radius      背景点云的整体半径
 * @param {boolean} [cfg.shell]    可观测宇宙专属：再以一层稀疏星点球壳表示「视界球」边界，
 *                                  并在球内体积填充稀薄场星系（center-on-observer 的 465 亿光年球）
 * @param {number} [cfg.shellRadius]    球壳半径（默认 = cfg.radius）
 * @param {number[]} [cfg.shellColor]   球壳星点颜色（线性 RGB，默认偏冷星光白）
 * @param {number} [cfg.shellDensity]   球壳星点数（默认 6500）
 * @param {number} [cfg.shellThickness] 球壳厚度（默认 = shellRadius×0.035）
 * @param {number} [cfg.volumeDensity]  球内场星系数（默认 1500）
 */
export function buildCosmosField(cfg) {
  const kind = cfg.kind ?? 'group';
  const rng = mulberry32(cfg.seed ?? 1);
  const anchors = (cfg.anchors ?? []).map(normAnchor)
    .filter((a) => Array.isArray(a.pos) && a.pos.length >= 3);
  const radius = cfg.radius ?? 15;
  const [filamentCol, hazeCol] = PALETTE[kind] ?? PALETTE.group;
  // 不同上层结构用不同生成规则：宇宙是网、超星系团是引力流域、
  // 星系团是中心密集 + 外围链、星系群/星系页是近乎空的场。
  // 以前所有上层页共用同一张两两互联的纤维网，才会「长得一样」。
  const shape = cfg.shape ?? (kind === 'universe' || kind === 'supercluster' ? 'web' : 'void');
  const isWeb = shape !== 'void';

  const pos = [];
  const col = [];
  const push = (x, y, z, c, bright) => {
    pos.push(x, y, z);
    col.push(
      Math.min(1, c[0] * bright),
      Math.min(1, c[1] * bright),
      Math.min(1, c[2] * bright),
    );
  };
  // 一小撮暗点：立方根分布让中心略密，外缘迅速散开
  const clump = (centre, n, spread, c, bright) => {
    for (let i = 0; i < n; i++) {
      const r = Math.cbrt(rng()) * spread;
      const u = rng() * 2 - 1;
      const phi = rng() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      push(
        centre[0] + r * s * Math.cos(phi),
        centre[1] + r * u * 0.55,
        centre[2] + r * s * Math.sin(phi),
        c, bright * (0.55 + rng() * 0.75),
      );
    }
  };
  // 纤维：两点之间一条略弯的二次曲线，沿线撒点并给横向散射
  const filament = (a, b, n, width, c, bright) => {
    const mx = (a[0] + b[0]) / 2 + randn(rng) * radius * 0.12;
    const my = (a[1] + b[1]) / 2 + randn(rng) * radius * 0.06;
    const mz = (a[2] + b[2]) / 2 + randn(rng) * radius * 0.12;
    for (let i = 0; i < n; i++) {
      const t = rng();
      const q = 1 - t;
      push(
        q * q * a[0] + 2 * q * t * mx + t * t * b[0] + randn(rng) * width,
        q * q * a[1] + 2 * q * t * my + t * t * b[1] + randn(rng) * width * 0.5,
        q * q * a[2] + 2 * q * t * mz + t * t * b[2] + randn(rng) * width,
        c, bright * (0.35 + rng() * 0.7),
      );
    }
  };

  if (shape === 'web') {
    // 宇宙网：纤维是唯一的主角。结点只表现为「纤维在这里汇聚得略密」，
    // 不再是 900 点的大白球；密度 / 范围 / 颜色随成员真实尺度变化。
    const linkCount = kind === 'universe' ? 2100 : 1600;
    const n = Math.max(2, anchors.length);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        filament(anchors[i].pos, anchors[j].pos,
          Math.round(linkCount / ((n * (n - 1)) / 2)), 0.55, filamentCol, 0.62);
      }
      // 向外缘伸出短纤维，避免整张图只在中间打转
      const ang = (i / n) * Math.PI * 2 + rng() * 0.6;
      const far = [Math.cos(ang) * radius, randn(rng) * 1.2, Math.sin(ang) * radius];
      filament(anchors[i].pos, far, Math.round(linkCount / (n * 2)), 0.75, filamentCol, 0.46);
    }
    for (const a of anchors) {
      clump(a.pos, 48 + Math.round(a.weight * 130), 0.45 + a.weight * 0.65, a.rgb, 0.36);
    }
    clump([0, 0, 0], 260, 5.0, hazeCol, 0.14);
  } else if (shape === 'flow') {
    // 拉尼亚凯亚：星系的运动轨迹都朝「巨引源」汇聚，所以是一束束
    // 弯向同一处的流域线，而不是各向同性的网。
    const sink = [-2.4, 0.4, 3.6];
    for (const a of anchors) {
      for (let k = 0; k < 3; k++) {
        const via = [
          (a.pos[0] + sink[0]) / 2 + randn(rng) * 2.0,
          (a.pos[1] + sink[1]) / 2 + randn(rng) * 0.7,
          (a.pos[2] + sink[2]) / 2 + randn(rng) * 2.0,
        ];
        filament(a.pos, via, 130, 0.42, filamentCol, 0.42);
        filament(via, sink, 190, 0.36, filamentCol, 0.55);
      }
      clump(a.pos, 44 + Math.round(a.weight * 90), 0.5 + a.weight * 0.6, a.rgb, 0.28);
    }
    clump(sink, 420, 2.6, hazeCol, 0.16);
  } else if (shape === 'cluster') {
    // 星系团：一个致密的中央团，外围成员由星系链连到中心，越外越稀。
    clump([0, 0, 0], 900, 2.4, hazeCol, 0.20);
    for (const a of anchors) {
      filament([0, 0, 0], a.pos, 260, 0.50, filamentCol, 0.46);
      clump(a.pos, 36 + Math.round(a.weight * 80), 0.6 + a.weight * 0.7, a.rgb, 0.26);
    }
    for (let i = 0; i < 6; i++) {
      const ang = rng() * Math.PI * 2;
      filament([0, 0, 0], [Math.cos(ang) * radius, randn(rng) * 1.2, Math.sin(ang) * radius],
        150, 0.7, filamentCol, 0.30);
    }
  } else {
    // 星系群 / 单个星系：不画纤维，更不画盘。
    // 每个成员周围只留十几颗更暗的伴星系，暗示「星系成群」而不是「星系是个球」。
    for (const a of anchors) {
      clump(a.pos, 12 + Math.round(a.weight * 22), 1.6, a.rgb, 0.16);
    }
  }

  // ===== 主点云：结构（网/流/团/空洞）+ 球内体积填充 =====
  // 体积填充放在主点云里（随距离正常衰减），让球壳与内部网在「同一套
  // 尺度语言」里——壳内的稀薄场星系把球心和球壳连成一片巨大的空间感。
  if (cfg.shell) {
    // 可观测宇宙：球内体积均匀填充极暗场星系，营造「巨大的空间而非一个亮点」，
    // 星系团 / 超星系团在球内按真实大尺度结构分布（见上方的 web 分支）。
    const volN = cfg.volumeDensity ?? 1500;
    for (let i = 0; i < volN; i++) {
      const u = rng() * 2 - 1, phi = rng() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const r = Math.cbrt(rng()) * radius * 0.92;
      push(r * s * Math.cos(phi), r * u, r * s * Math.sin(phi), hazeCol, 0.06 + rng() * 0.12);
    }
  } else {
    // 极稀疏的场星系，给空洞一点深度：亮度低到只有在黑底上才隐约可见
    const fieldN = shape === 'void' ? 150 : (shape === 'cluster' ? 380 : 460);
    for (let i = 0; i < fieldN; i++) {
      const r = Math.pow(rng(), 0.6) * radius * 1.15;
      const ang = rng() * Math.PI * 2;
      push(
        Math.cos(ang) * r, randn(rng) * radius * 0.12, Math.sin(ang) * r,
        hazeCol, 0.05 + rng() * 0.14,
      );
    }
  }

  const mainGeo = new THREE.BufferGeometry();
  mainGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  mainGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mainField = new THREE.Points(mainGeo, new THREE.PointsMaterial({
    size: cfg.pointSize ?? 0.18,
    map: discTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  }));

  const group = new THREE.Group();
  group.add(mainField);

  // ===== 可观测宇宙专属：星点「视界球壳」+ 半透明边界球 =====
  // 关键：球壳星点用「固定屏幕尺寸 + 不受距离衰减」，否则远在半径 15 处的点
  // 又暗又小，整层壳几乎看不见（上一版就是这个病根）。这样「视界球」在任意
  // 缩放档位都是一圈清晰明亮的星光，背景再叠一层极淡的边界球强化球的形体。
  if (cfg.shell) {
    const SR = cfg.shellRadius ?? radius;
    const shellCol = cfg.shellColor ?? [0.70, 0.82, 1.0];
    const shellN = cfg.shellDensity ?? 9000;
    const shellThick = cfg.shellThickness ?? SR * 0.045;
    const sp = [], sc = [];
    const pushShell = (x, y, z, c, b) => {
      sp.push(x, y, z);
      sc.push(Math.min(1, c[0] * b), Math.min(1, c[1] * b), Math.min(1, c[2] * b));
    };
    for (let i = 0; i < shellN; i++) {
      const u = rng() * 2 - 1, phi = rng() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const r = SR + randn(rng) * shellThick;
      pushShell(r * s * Math.cos(phi), r * u, r * s * Math.sin(phi), shellCol, 0.34 + rng() * 0.42);
    }
    const shellGeo = new THREE.BufferGeometry();
    shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    shellGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
    const shellPts = new THREE.Points(shellGeo, new THREE.PointsMaterial({
      size: 2.6,                    // 固定屏幕尺寸：无论远近，「视界球」都清晰可见
      map: discTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: false,
      toneMapped: false,
    }));
    shellPts.userData.shell = true;  // main.js 缩放时跳过它，保持固定尺寸
    group.add(shellPts);

    // 半透明边界球：additive + BackSide，边缘(limb)自然增亮 = 可观测宇宙视界
    const bc = cfg.shellBubble ?? [0.50, 0.62, 1.0];
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(SR, 48, 32),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(bc[0], bc[1], bc[2]),
        transparent: true,
        opacity: 0.055,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    group.add(bubble);

    // 视界标注：球顶加一行「视界 / Horizon」文字，明确这层点壳是粒子视界示意，
    // 不是真实数据点（真实数据云只到 ~6 亿光年，远小于 465 亿光年视界球）。
    if (typeof document !== 'undefined') {
      const hl = makeTextSprite('视界 / Horizon', '#bcd2ff');
      const h = SR * 0.11;
      hl.scale.set(h * hl.userData.aspect, h, 1);
      hl.position.set(0, SR * 0.9, 0);
      hl.userData.shell = true; // 与视界球壳一样跳过相机缩放，保持固定尺寸
      group.add(hl);
    }
  }

  return group;
}
