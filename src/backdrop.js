/**
 * 三维背景方位 / 视锥可见性 / 连续缩放（纯数学，无 Three.js、无 DOM）。
 *
 * 为什么要这个文件：空间是三维的，**一个天体看不看得见与「当前比例尺」无关**。
 * 相机贴在心宿二 9 倍半径处时，550 光年外的太阳依然在视线里 —— 透视投影只
 * 关心「方向是否落在视锥内」和「角尺寸够不够一个像素」，不关心它离得多远。
 * 上一版把可见性写成「到焦点的距离 <= 视野跨度」，等于把三维星空削成一个
 * 以焦点为球心的空壳，于是小尺度永远只剩孤零零一颗球；再靠「按邻居距离
 * 自动跳档」去补背景，是拿二维的补救掩盖三维的错误。
 *
 * 现在：
 *  · 可见性 = 视锥（projectToNdc），百光年外的天体照样是背景里的一个点；
 *  · 点的世界尺寸按各自到相机的距离反算（pointWorldSize），远近都是同样大小
 *    的屏幕像素，不用示意半径，也不会因为远而消失；
 *  · 聚焦时自动挑一个「让最多远处天体落在视锥内」的视线方向（backdropOptions），
 *    这就是所谓「把背景角度设计好」——心宿二特写的背景里能远远看到太阳；
 *  · 缩放是固定倍率的连续对数缩放（continuousZoom），不按内容挑停靠点，
 *    1 / 10 / 100 光年想停就停，背景靠三维方位提供内容，而不是靠跳档。
 *
 * 单位约定：位置可以是任意一致单位（场景里是 kpc，测试里也用 kpc）；
 * 缩放距离用光年，由 main.js 乘 UNITS_PER_LY 换算。
 */

/** 每格滚轮的缩放倍率：与天体内容无关的固定几何倍率。 */
export const DEFAULT_ZOOM_RATIO = 2.4;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = len(a);
  return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1];
};

/**
 * 把世界坐标点投影到 NDC（[-1,1] 为画面内）。
 * 用显式相机基向量而不是 Three 的矩阵，避免依赖「渲染前 matrixWorld 是否刷新」，
 * 也让 check 脚本能在 Node 里用同一套数学断言真实三维几何。
 *
 * @returns {{x:number,y:number,z:number,inFront:boolean,inFrame:boolean}}
 */
export function projectToNdc(cam, lookAt, up, point, fovDeg = 45, aspect = 16 / 9, margin = 1) {
  const fwd = norm(sub(lookAt, cam));
  let right = cross(fwd, up);
  if (len(right) < 1e-12) right = cross(fwd, [0, 0, 1]);
  right = norm(right);
  const up2 = norm(cross(right, fwd));
  const rel = sub(point, cam);
  const z = dot(rel, fwd);                 // 相机前方深度
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360);
  const inFront = z > 0;
  if (!inFront) return { x: 0, y: 0, z, inFront, inFrame: false };
  const x = dot(rel, right) / (z * tanHalf * aspect);
  const y = dot(rel, up2) / (z * tanHalf);
  return { x, y, z, inFront: true, inFrame: Math.abs(x) <= margin && Math.abs(y) <= margin };
}

/** 视锥判定的简写。 */
export function inView(point, cam, lookAt, up, fovDeg = 45, aspect = 16 / 9, margin = 1) {
  return projectToNdc(cam, lookAt, up, point, fovDeg, aspect, margin).inFrame;
}

/**
 * 让一个 sprite / mesh 在距离 D 处占 pixels 个屏幕像素所需的世界尺寸。
 * 透视下每像素对应的世界长度 ∝ D，所以远处天体必须按**自己的** D 放大，
 * 而不是统一按焦点距离缩放（那会让 550 光年外的太阳缩成 1/550 像素）。
 */
export function pointWorldSize(distance, fovDeg = 45, viewportH = 900, pixels = 2) {
  const d = Number(distance);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return (2 * d * Math.tan((fovDeg * Math.PI) / 360) * pixels) / Math.max(1, viewportH);
}

/**
 * 挑「背景方位」：返回若干条视线方向，按「该方向视锥内的远处天体权重和」排序。
 * 相机站在焦点 - dir*d 处看向焦点，则 dir 方向上的天体正好落在焦点背后入画。
 *
 * @param focus   焦点世界坐标 [x,y,z]
 * @param bodies  [{ id, pos:[x,y,z], weight? }]（weight 越大越想让它进背景）
 * @param options { fovDeg, aspect, limit, minAngleDeg, coreId, coreBias, center }
 * @returns [{ dir:[x,y,z], ids:string[], score:number, core:boolean }]
 */
export function backdropOptions(focus, bodies = [], options = {}) {
  const fovDeg = options.fovDeg ?? 45;
  const aspect = options.aspect ?? 16 / 9;
  const limit = options.limit ?? 6;
  const minCos = Math.cos(((options.minAngleDeg ?? 18) * Math.PI) / 180);
  const coreId = options.coreId ?? 'sun';
  const coreBias = options.coreBias ?? 5;
  // 保守取垂直半视场的 80% 当作「舒适入画」圆锥：宽屏下水平视野更大，
  // 用这个值算出来的方向在任何 aspect 下都真的能看见，而不是贴着画面边缘。
  const half = (fovDeg * Math.PI) / 360;
  const cosLimit = Math.cos(half * 0.8);

  const dirs = [];
  let sum = [0, 0, 0];
  for (const b of bodies) {
    if (!b || !Array.isArray(b.pos)) continue;
    const v = norm(sub(b.pos, focus));
    if (len(sub(b.pos, focus)) < 1e-15) continue;
    const w = Math.max(0.0001, Number(b.weight) || 1) * (b.id === coreId ? coreBias : 1);
    dirs.push({ id: b.id, v, w });
    sum = [sum[0] + v[0] * w, sum[1] + v[1] * w, sum[2] + v[2] * w];
  }
  if (!dirs.length) return [];

  const candidates = dirs.map((d) => d.v);
  if (len(sum) > 1e-12) candidates.push(norm(sum));
  // 从焦点看向银心（世界原点）永远是一个值得一试的方向：绝大多数深空天体
  // 与太阳都集中在那半个天区，能保证背景不是空的。
  if (len(focus) > 1e-12) candidates.push(norm(focus.map((x) => -x)));

  const scored = candidates.map((dir) => {
    let score = 0;
    const ids = [];
    for (const d of dirs) {
      const c = clamp(dot(d.v, dir), -1, 1);
      if (c <= cosLimit) continue;
      // 越靠近画面中心贡献越大；软权重让方向选择连续、不因一颗星而抖动
      score += d.w * Math.sqrt((c - cosLimit) / (1 - cosLimit));
      ids.push(d.id);
    }
    return { dir, ids, score, core: ids.includes(coreId) };
  }).sort((a, b) => b.score - a.score);

  const picked = [];
  for (const s of scored) {
    if (!s.ids.length) continue;
    if (picked.some((p) => dot(p.dir, s.dir) > minCos)) continue;
    picked.push(s);
    if (picked.length >= limit) break;
  }
  // 太阳这类核心锚点优先：即便它的方位分数略低，也让默认背景里有它
  picked.sort((a, b) => (b.core ? 1 : 0) - (a.core ? 1 : 0) || b.score - a.score);
  return picked;
}

/**
 * 连续对数缩放：每格固定倍率，与周围有没有天体完全无关。
 * deltaY 为正往外缩（视野变大），为负往内放大；用指数保证不同尺度手感一致，
 * 也保证 9R → 10 万光年这 11 个数量级用三十来格就能走完。
 */
export function continuousZoom(currentLy, deltaY, options = {}) {
  const ratio = Math.max(1.01, Number(options.ratio) || DEFAULT_ZOOM_RATIO);
  const unit = Math.max(1, Number(options.deltaUnit) || 100);
  const step = clamp((Number(deltaY) || 0) / unit, -1, 1);
  const minLy = Math.max(0, Number(options.minLy) || 0);
  const maxLy = Math.max(minLy, Number(options.maxLy) || 1e5);
  const cur = clamp(Number(currentLy) || minLy, minLy, maxLy);
  return clamp(cur * Math.pow(ratio, step), minLy, maxLy);
}
