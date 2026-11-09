/**
 * 真实尺度缩放阶梯（纯数学，无 DOM / 无 Three.js，供 check:stars 直接断言）。
 *
 * 设计原则：**球体的大小、什么时候看得见、缩放该停在哪些尺度，全部由真实物理量决定**，
 * 不再用「示意球径」或「固定 10× 档位」硬凑。
 *
 *  · 1 场景单位 = 1 kpc = 3261.56 光年（与 systems/galaxy.js 的 LY_PER_KPC 一致）
 *  · 1 R☉ = 6.957×10⁸ m，1 光年 = 9.4607×10¹⁵ m ⇒ 1 R☉ = 7.3535×10⁻⁸ 光年
 *  · 于是恒星球半径是 10⁻⁸~10⁻⁵ 光年量级，而恒星彼此至少隔 0.21 光年。
 *    「大尺度上只能是一个点」「同一帧不可能看见两个球面」是物理推论，不是人为护栏。
 *
 * 显隐看**角尺寸**：相机到恒星距离 ÷ 该恒星真实半径。
 *    d/R > 60 → 纯点；d/R ≤ 12 → 球完全显形（视场 45° 下球占屏高约 20%）。
 * 聚焦时镜头落到 d = 9R，看到的是被照亮的球面而非针尖。
 *
 * 缩小时用 zoomStops() 生成「有内容的尺度」：只有**首次有其它天体进入视野**的距离
 * 才成为停靠点，空白数量级被跳过。太阳周围 4.24 / 5.96 / 8.6… 光年一串邻居，
 * 1 / 10 / 100 光年档都会出现新东西；心宿二最近的邻居在几百光年外，1 / 10 / 100
 * 光年这三档全部被合并掉，一缩就直接回到能看到其它天体的尺度。
 */

// ---------- 单位换算 ----------
export const LY_M = 9.4607304725808e15;
export const SUN_RADIUS_M = 6.957e8;
/** 1 太阳半径 = 多少光年 */
export const SUN_RADIUS_LY = SUN_RADIUS_M / LY_M;
/** 1 光年 = 多少场景单位（场景单位 = kpc） */
export const UNITS_PER_LY = 1 / 3261.56;

// ---------- 显隐 / 取景倍率（单位：恒星半径 R 的倍数） ----------
/** 聚焦特写：相机停在 9R 外，球占屏高约 1/4，细节清晰 */
export const CLOSEUP_FACTOR = 9;
/** 超过 60R 就退化成一个点（球角直径 < 2°） */
export const REVEAL_FACTOR = 60;
/** 12R 以内完全不透明 */
export const FULL_FACTOR = 12;
/** 上一轮的用户约定：只有视野跨度小于 1 光年的尺度才可能出现球体。
 *  真实半径下 60 × R_max ≈ 0.0034 光年 ≪ 1，这条护栏自动满足。 */
export const MAX_PORTRAIT_SPAN_LY = 1;

// ---------- 真实半径 ----------

/** 真实半径（太阳半径为单位）→ 光年 */
export function starRadiusLy(radiusSun = 1) {
  const r = Number(radiusSun);
  return Number.isFinite(r) && r > 0 ? r * SUN_RADIUS_LY : SUN_RADIUS_LY;
}

/** 真实半径 → 场景单位（球体的 group.scale） */
export function starRadiusUnits(radiusSun = 1, unitsPerLy = UNITS_PER_LY) {
  const u = Number.isFinite(unitsPerLy) && unitsPerLy > 0 ? unitsPerLy : UNITS_PER_LY;
  return starRadiusLy(radiusSun) * u;
}

/** 聚焦特写的相机距离（光年） */
export function closeupDistanceLy(radiusSun = 1) {
  return CLOSEUP_FACTOR * starRadiusLy(radiusSun);
}

/** 球体开始淡入的相机距离（光年） */
export function revealDistanceLy(radiusSun = 1) {
  return REVEAL_FACTOR * starRadiusLy(radiusSun);
}

/** 兼容旧调用的球径函数：现在就是真实半径，绝不随档位缩放。 */
export function portraitRadius(radiusSun = 1, cameraDistanceUnits = Infinity, unitsPerLy = UNITS_PER_LY) {
  const r = starRadiusUnits(radiusSun, unitsPerLy);
  const d = Number(cameraDistanceUnits);
  // 保险：相机真钻进球里时按距离收缩，而不是让球包住相机
  return Number.isFinite(d) && d > 0 ? Math.min(r, d * 0.42) : r;
}

// ---------- 视野 / 显隐 ----------

/** 相机距离（光年）→ 画面横向跨度（光年）。fov 为垂直视场角。 */
export function effectiveSpanLy(cameraDistanceLy, fovDeg = 45) {
  const d = Number(cameraDistanceLy);
  if (!Number.isFinite(d) || d < 0) return Infinity;
  return 2 * d * Math.tan((fovDeg * Math.PI) / 360);
}

/** 档位护栏：视野跨度超过 1 光年就不可能出现球面。 */
export function tierAllowsPortrait(spanLy) {
  return Number.isFinite(spanLy) && spanLy <= MAX_PORTRAIT_SPAN_LY;
}

/** 相机距离 / 恒星真实半径 ≤ 60 才可能显形。 */
export function starWithinPortrait(dLy, radiusLy) {
  const d = Number(dLy), r = Number(radiusLy);
  return Number.isFinite(d) && d >= 0 && Number.isFinite(r) && r > 0
    && d <= REVEAL_FACTOR * r;
}

/** 淡入：60R 处 0，12R 处 1。参数是光年。 */
export function portraitOpacity(dLy, radiusLy) {
  const d = Number(dLy), r = Number(radiusLy);
  if (!Number.isFinite(d) || !Number.isFinite(r) || r <= 0 || d < 0) return 0;
  const ratio = d / r;
  if (ratio >= REVEAL_FACTOR) return 0;
  if (ratio <= FULL_FACTOR) return 1;
  return (REVEAL_FACTOR - ratio) / (REVEAL_FACTOR - FULL_FACTOR);
}

/**
 * 唯一候选：每帧只留角尺寸最大（d/R 最小）的一颗。
 * 真实半径下这几乎必然只有一颗，唯一性是防止极端相机位置出现两个球面的保险。
 * @param candidates [{ id, dLy, radiusLy, visible }]
 * @param spanLy 当前有效视野跨度（光年）
 */
export function selectStarPortrait(candidates, spanLy) {
  if (!tierAllowsPortrait(spanLy)) return null;
  let best = null, bestRatio = Infinity;
  for (const c of candidates) {
    if (!c || !c.visible || !starWithinPortrait(c.dLy, c.radiusLy)) continue;
    const ratio = c.dLy / c.radiusLy;
    if (ratio < bestRatio) { bestRatio = ratio; best = c; }
  }
  return best ? best.id : null;
}

// ---------- 内容驱动的缩放阶梯 ----------

/**
 * 生成「有内容的尺度」停靠点（单位：光年，含义为相机到焦点的距离，升序）。
 *
 *  @param closeLy    特写距离（光年）
 *  @param neighborLy 其它天体到焦点的真实三维距离（光年）
 *  @param options.entryFactor 邻居进入视野的判据 D ≈ d × entryFactor（默认 0.4，
 *                             按 45° 视场的**垂直**半视野取保守值，保证邻居真的落在
 *                             画面里而不只是被标记为可见）；停靠点 d = D / 0.4
 *  @param options.mergeRatio  相邻停靠点小于这个倍数就合并，避免滚轮过碎
 *  @param options.outerLy     最外兜底尺度
 *  @param options.waypoints   额外过渡点（例如「球刚淡成一个点」的 60R 距离），
 *                             让特写往外缩时不必连滚十几格才跨过淡出阈值
 *
 * 停靠点只来自「特写 / 过渡点 / 首次有邻居入画」，**不补 10 的整数次幂**：
 * 补了就等于把用户抱怨的空白档（心宿二周围的 1 / 10 / 100 光年）又塞回来。
 * 最后加一个宏观兜底，保证能一路缩回全景；未聚焦时的 6 档比例条不受影响。
 */
export function zoomStops(closeLy, neighborLy = [], options = {}) {
  const entry = options.entryFactor ?? 0.4;
  const merge = options.mergeRatio ?? 1.8;
  const outer = options.outerLy ?? 1e5;
  const base = Math.max(1e-12, Number(closeLy) || 1e-7);
  const stops = [];
  const push = (ly) => {
    const v = Math.max(base, Number(ly));
    if (!Number.isFinite(v) || v <= 0) return;
    if (stops.length && v / stops[stops.length - 1] < merge) return;
    stops.push(v);
  };

  push(base);
  for (const w of (options.waypoints ?? [])) push(w);
  const ds = [...new Set((neighborLy ?? [])
    .map(Number)
    .filter((d) => Number.isFinite(d) && d > 0)
    .map((d) => d / entry))].sort((a, b) => a - b);
  for (const d of ds) if (d > base * merge) push(d);

  // 只留一个最外兜底：即使某颗恒星周围一片空旷，也能退回全景看银河系。
  // 中间的空白数量级一概不补 —— 这正是「缩小时不该盯着一个天体发呆」的关键。
  push(Math.max(outer, stops[stops.length - 1] * merge));
  return stops;
}

/** 沿阶梯找下一个停靠点。direction > 0 往外缩，< 0 往内放大；到顶返回 null。 */
export function nextZoomStop(stops, currentLy, direction) {
  if (!Array.isArray(stops) || !stops.length || !Number.isFinite(currentLy)) return null;
  if (direction > 0) {
    for (const s of stops) if (s > currentLy * 1.15) return s;
    return null;
  }
  for (let i = stops.length - 1; i >= 0; i--) {
    if (stops[i] < currentLy * 0.87) return stops[i];
  }
  return null;
}
