// scripts/check-openngc.mjs
// 校验 src/data/openngc.js 生成的深空点云：数量、坐标有限、元数据自洽。
// 运行：npm run check:openngc

import { OPENNGC_COUNT, OPENNGC_POS, OPENNGC_COL, OPENNGC_META } from '../src/data/openngc.js';

let fail = 0;
const failIf = (cond, msg) => { if (cond) { console.error('  ✗ ' + msg); fail++; } else { console.log('  ✓ ' + msg); } };

const n = OPENNGC_COUNT;
console.log(`OpenNGC 自检：count=${n}`);

failIf(!(n > 10000), `天体数量应 > 10000（实际 ${n}）`);

// 位置/颜色无 NaN、范围合理（壳层在太阳附近 ±~24 kpc）
let posNaN = 0, colNaN = 0, minR = 1e9, maxR = -1e9;
for (let i = 0; i < n; i++) {
  const x = OPENNGC_POS[i * 3], y = OPENNGC_POS[i * 3 + 1], z = OPENNGC_POS[i * 3 + 2];
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) posNaN++;
  const r = Math.hypot(x, y, z);
  minR = Math.min(minR, r); maxR = Math.max(maxR, r);
  const cr = OPENNGC_COL[i * 3], cg = OPENNGC_COL[i * 3 + 1], cb = OPENNGC_COL[i * 3 + 2];
  if (!isFinite(cr) || !isFinite(cg) || !isFinite(cb)) colNaN++;
}
failIf(posNaN > 0, `位置非有限：${posNaN}`);
failIf(colNaN > 0, `颜色非有限：${colNaN}`);
console.log(`  离银心半径范围：${minR.toFixed(2)} ~ ${maxR.toFixed(2)} kpc（太阳距银心 ~8.7 kpc，壳层 3~16 kpc 环绕太阳，故离银心可在 0~24 附近）`);
failIf(!(maxR < 60), '离银心最大半径超出预期范围（应 < 60 kpc）');

// 元数据自洽
const m = OPENNGC_META;
failIf(!m, 'OPENNGC_META 缺失');
if (m) {
  failIf(m.ids.length !== n, `ids 长度 ${m.ids.length} ≠ count ${n}`);
  failIf(m.cat.length !== n, `cat 长度 ${m.cat.length} ≠ count ${n}`);
  failIf(m.mag.length !== n, `mag 长度 ${m.mag.length} ≠ count ${n}`);
  failIf(m.dist.length !== n, `dist 长度 ${m.dist.length} ≠ count ${n}`);
  failIf(m.ra.length !== n, `ra 长度 ${m.ra.length} ≠ count ${n}`);
  failIf(m.dec.length !== n, `dec 长度 ${m.dec.length} ≠ count ${n}`);
  failIf(m.lb.length !== n * 2, `lb 长度 ${m.lb.length} ≠ count*2 ${n * 2}`);
  // 类别索引范围
  let catBad = 0;
  for (let i = 0; i < n; i++) if (!(m.cat[i] >= 0 && m.cat[i] < m.catZh.length)) catBad++;
  failIf(catBad > 0, `类别索引越界：${catBad}`);
  // 距离：要么 >0（推算），要么 -1（缺）
  let distBad = 0;
  for (let i = 0; i < n; i++) if (!(m.dist[i] > 0 || m.dist[i] === -1)) distBad++;
  failIf(distBad > 0, `距离值异常：${distBad}`);
  let withDist = 0;
  for (let i = 0; i < n; i++) if (m.dist[i] > 0) withDist++;
  console.log(`  含推算距离 ${withDist} / ${n}`);
}

if (fail > 0) { console.error(`\nOpenNGC 自检失败：${fail} 项`); process.exit(1); }
console.log('\nOpenNGC 自检通过 ✓');
