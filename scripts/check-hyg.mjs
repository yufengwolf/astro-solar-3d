// scripts/check-hyg.mjs — 验证 HYG 星场数据完整性（坐标范围 / NaN / 近太阳点）
import { HYG_POS, HYG_COL, HYG_COUNT } from '../src/data/hyg-stars.js';

const S = [-7.73, 0.02, 2.74]; // 太阳相对银心的位置（kpc）
let nan = 0;
const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
let nearSun = 0, farOut = 0;
for (let i = 0; i < HYG_COUNT; i++) {
  const x = HYG_POS[i * 3], y = HYG_POS[i * 3 + 1], z = HYG_POS[i * 3 + 2];
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) { nan++; continue; }
  mn[0] = Math.min(mn[0], x); mx[0] = Math.max(mx[0], x);
  mn[1] = Math.min(mn[1], y); mx[1] = Math.max(mx[1], y);
  mn[2] = Math.min(mn[2], z); mx[2] = Math.max(mx[2], z);
  const d = Math.hypot(x - S[0], y - S[1], z - S[2]);
  if (d < 0.1) nearSun++;        // 距太阳 < 0.1 kpc (326 ly)
  if (d > 50) farOut++;          // 异常远（>50 kpc）
}
let colMin = 1e9, colMax = -1e9;
for (let i = 0; i < HYG_COL.length; i++) {
  const c = HYG_COL[i];
  if (!isFinite(c)) { nan++; continue; }
  colMin = Math.min(colMin, c); colMax = Math.max(colMax, c);
}

const ok = nan === 0 && HYG_COUNT > 50000 && farOut === 0 && colMin >= 0 && colMax <= 1.0001;
console.log('count            :', HYG_COUNT);
console.log('NaN/Inf          :', nan);
console.log('x range (kpc)    :', mn[0].toFixed(2), '→', mx[0].toFixed(2));
console.log('y range (kpc)    :', mn[1].toFixed(2), '→', mx[1].toFixed(2));
console.log('z range (kpc)    :', mn[2].toFixed(2), '→', mx[2].toFixed(2));
console.log('near Sun (<0.1kpc):', nearSun);
console.log('far out (>50kpc)  :', farOut);
console.log('color range       :', colMin.toFixed(3), '→', colMax.toFixed(3));
console.log(ok ? 'HYG SELF-CHECK: PASS' : 'HYG SELF-CHECK: FAIL');
process.exit(ok ? 0 : 1);
