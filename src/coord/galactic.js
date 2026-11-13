// src/coord/galactic.js
// 银河系坐标的「唯一真源」：所有天体目录（HYG / OpenNGC / Gaia…）、运行时定位、
// 以及构建脚本（scripts/build-*.mjs）都从这里取坐标换算，杜绝各文件各抄一份后漂移。
//
// 约定（与既有渲染一致）：
//  · 1 场景单位 = 1 千秒差距(kpc)；银心为原点；盘面在 X–Z 平面，+Y 为北银极。
//  · 银道坐标 (l, b, d)：l/b 单位度，d 单位 kpc。l=0 指向银心，b=+90° 为北银极。
//  · 太阳位于本地（猎户）支臂，距银心约 8.2 kpc（详见 SUN_GALACTIC_POS）。

export const LY_PER_KPC = 3261.56;          // 1 kpc = 3261.56 光年
export const KPC_PER_LY = 1 / LY_PER_KPC;   // 1 光年 = 1/3261.56 kpc

// 太阳在「银心为原点」场景坐标中的位置（kpc）。
// 取自 IAU 推荐的太阳距银心 ≈ 8.2 kpc，并置于猎户（本地）支臂——
// 位于人马臂与英仙臂之间，而非叠在某条主旋臂亮带上（原先「主旋臂 A 中心线」的
// 摆放会让人误以为太阳在主臂上，与真实几何不符）。
export const SUN_GALACTIC_POS = [-7.73, 0.02, 2.74];

// J2000 赤道坐标(raDeg, decDeg) → 银道坐标(l, b)，单位度。
// 标准球面三角，常数取 IAU 1958 银道极：北银极 RA=192.85948°, Dec=+27.12825°，
// 银心方向 l_NCP=122.93192°。
// 自检：Sgr A* (266.4168°, −29.0078°) → l=359.944°, b=−0.046°；北银极 → b=90°。
export function equatorialToGalactic(raDeg, decDeg) {
  const a = raDeg * Math.PI / 180, d = decDeg * Math.PI / 180;
  const ap = 192.85948 * Math.PI / 180, dp = 27.12825 * Math.PI / 180;
  const lNCP = 122.93192 * Math.PI / 180;
  const sinB = Math.sin(d) * Math.sin(dp) + Math.cos(d) * Math.cos(dp) * Math.cos(a - ap);
  const b = Math.asin(Math.max(-1, Math.min(1, sinB)));
  const y = Math.cos(d) * Math.sin(a - ap);
  const x = Math.sin(d) * Math.cos(dp) - Math.cos(d) * Math.sin(dp) * Math.cos(a - ap);
  const l = ((lNCP - Math.atan2(y, x)) * 180 / Math.PI % 360 + 360) % 360;
  return [l, b * 180 / Math.PI];
}

// 银道坐标 (l, b, d)（度, 度, kpc）→ 场景坐标 (x, y, z)（kpc）。
// 基向量：X = 太阳→银心方向；Y = 北银极；Z = 与之正交的盘面方向。
// 自洽性检验：l=0,b=0,d=8.2 应回到银心 (0,0,0)。
// 精度到 1e-9 kpc（≈0.003 光年）：原先的 toFixed(3) 是 3.26 光年，会把 4~10 光年的
// 邻近恒星全部舍入成「和太阳同一个点」，比例尺小档就失效了。
export function galacticToScene(l, b, d) {
  const S = SUN_GALACTIC_POS;
  const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
  const norm = (v) => { const m = Math.hypot(...v); return v.map((x) => x / m); };
  const X = norm(S.map((v) => -v));           // l=0：太阳 → 银心
  const Y = norm(cross([0, 1, 0], X));        // l=90
  const Z = norm(cross(X, Y));                // b=+90：北银极
  const L = l * Math.PI / 180, B = b * Math.PI / 180;
  const u = d * Math.cos(B) * Math.cos(L);
  const v = d * Math.cos(B) * Math.sin(L);
  const w = d * Math.sin(B);
  return [
    +(S[0] + u * X[0] + v * Y[0] + w * Z[0]).toFixed(9),
    +(S[1] + u * X[1] + v * Y[1] + w * Z[1]).toFixed(9),
    +(S[2] + u * X[2] + v * Y[2] + w * Z[2]).toFixed(9),
  ];
}
