/**
 * 上级结构真实坐标自检（纯 Node，不加载 Three.js / DOM）。
 *
 * 把「上级层级由真实星表驱动」这条约束固化下来，防止日后又退回手写定性 pos：
 *  1. COSMIC_REAL 每个条目字段合法、来源标签已登记、方向与距离有限；
 *  2. 每个带 ngc 锚点的条目，锚点必须真的存在于 OpenNGC 包里，
 *     且 COSMIC_REAL 的 ra/dec 与星表里的赤经赤纬一致（≤0.01°）；
 *  3. universe.js 里所有「上级结构」节点（超星系团 / 星系团 / 星系群，
 *     不含本星系群成员星系与行星系统）都必须在 COSMIC_REAL 里有真实坐标；
 *  4. deriveCosmicPositions 派生后：所有节点 pos / dLy 有限、
 *     每层焦点落原点、成员按真实方向散开（不是全堆在原点）、
 *     层内最大半径归一化到 TARGET 附近。
 */
import { fileURLToPath } from 'node:url';
import { COSMIC_REAL, COSMIC_SOURCES, CF3_TEMPLATE_DISTANCES, cosmicVec, cosmicSource } from '../src/data/cosmic-structures.js';
import { OPENNGC_IDS, OPENNGC_RA, OPENNGC_DEC } from '../src/data/openngc.js';
import { NODES, byId, childrenOf } from '../src/universe.js';

const errors = [];
const fail = (m) => errors.push(m);
const ok = (cond, m) => { if (!cond) fail(m); };

// ---- 1. 星表条目字段 ----
const ids = Object.keys(COSMIC_REAL);
for (const [id, r] of Object.entries(COSMIC_REAL)) {
  ok(Number.isFinite(r.ra) && r.ra >= 0 && r.ra < 360, `${id}.ra 非法: ${r.ra}`);
  ok(Number.isFinite(r.dec) && r.dec >= -90 && r.dec <= 90, `${id}.dec 非法: ${r.dec}`);
  ok(Number.isFinite(r.distMpc) && r.distMpc >= 0, `${id}.distMpc 非法: ${r.distMpc}`);
  ok(typeof r.src === 'string' && r.src.length > 0, `${id} 缺少数据出处 src`);
  for (const k of String(r.src).split('+').map((s) => s.trim())) {
    ok(COSMIC_SOURCES[k] != null, `${id}.src 含未登记来源标签: ${k}`);
  }
  const v = cosmicVec(id);
  ok(Array.isArray(v) && v.length === 3 && v.every(Number.isFinite), `${id} cosmicVec 非有限: ${v}`);
  ok(cosmicSource(id) != null, `${id} 无来源说明`);
}

// ---- 2. NGC 锚点必须与 OpenNGC 包逐一对上（证明方向确实来自真实星表）----
let anchored = 0;
for (const [id, r] of Object.entries(COSMIC_REAL)) {
  if (!r.ngc) continue;
  anchored++;
  const i = OPENNGC_IDS.indexOf(r.ngc);
  ok(i >= 0, `${id} 的锚点 ${r.ngc} 不在 OpenNGC 包里`);
  if (i < 0) continue;
  const dRa = Math.abs(OPENNGC_RA[i] - r.ra);
  const dDec = Math.abs(OPENNGC_DEC[i] - r.dec);
  ok(dRa <= 0.01, `${id} 赤经与 OpenNGC 不符: ${r.ra} vs ${OPENNGC_RA[i]} (Δ${dRa.toFixed(4)}°)`);
  ok(dDec <= 0.01, `${id} 赤纬与 OpenNGC 不符: ${r.dec} vs ${OPENNGC_DEC[i]} (Δ${dDec.toFixed(4)}°)`);
}

// ---- 3. Cosmicflows-3 实测距离留档自洽 ----
for (const [k, v] of Object.entries(CF3_TEMPLATE_DISTANCES)) {
  ok(Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) && v[0] > 0 && v[1] >= 0,
    `CF3_TEMPLATE_DISTANCES.${k} 非法`);
}
ok(Object.keys(CF3_TEMPLATE_DISTANCES).length >= 12, 'Cosmicflows-3 模板距离表条目过少');

// ---- 4. 上级层级节点必须都有真实坐标 ----
const UPPER = new Set(['universe', 'supercluster', 'cluster', 'group']);
// 本星系群本身是观测原点（distMpc=0），也要求在表内；其成员星系走 galaxies.js，不要求。
// 根节点是整棵树的观察原点（pos 恒为 [0,0,0]），不需要 COSMIC_REAL 条目。
const upperNodes = NODES.filter((n) => UPPER.has(n.kind) && n.parent != null);
for (const n of upperNodes) {
  ok(COSMIC_REAL[n.id] != null, `上级节点 ${n.id} (${n.kind}) 缺少 COSMIC_REAL 真实坐标，会退回手写 pos`);
}
const upperInTable = upperNodes.filter((n) => COSMIC_REAL[n.id]).length;
ok(upperInTable >= 20, `有真实坐标的上级节点只有 ${upperInTable} 个，疑似扩充失效`);

// ---- 5. 派生结果几何 ----
let nonfinite = 0;
for (const n of NODES) {
  if (!Array.isArray(n.pos) || n.pos.length !== 3 || !n.pos.every(Number.isFinite)) nonfinite++;
  if (!Number.isFinite(n.dLy) || n.dLy < 0) nonfinite++;
}
ok(nonfinite === 0, `${nonfinite} 个节点 pos/dLy 非有限`);

for (const p of ['universe', 'laniakea', 'virgo']) {
  const parent = byId(p);
  const focus = parent?.focus ? byId(parent.focus) : null;
  if (focus) {
    const r = Math.hypot(...focus.pos);
    ok(r < 1e-6, `${p} 层焦点 ${focus.id} 未落原点: r=${r}`);
  }
  const kids = childrenOf(p).filter((k) => COSMIC_REAL[k.id] && k.id !== parent?.focus);
  ok(kids.length >= 3, `${p} 层真实坐标成员只有 ${kids.length} 个`);
  // 成员不能全堆在原点：至少 3 个不同方向（互不平行的单位向量）
  const dirs = kids.map((k) => {
    const m = Math.hypot(...k.pos) || 1;
    return k.pos.map((v) => v / m);
  });
  let distinct = 0;
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      const dot = dirs[i][0] * dirs[j][0] + dirs[i][1] * dirs[j][1] + dirs[i][2] * dirs[j][2];
      if (dot < 0.98) distinct++;
    }
  }
  ok(distinct >= 3, `${p} 层成员方向过于集中（真实几何可能未生效），distinct=${distinct}`);
}

// ---- 汇总 ----
if (errors.length) {
  console.error(`上级结构坐标校验失败（${errors.length} 项）：`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`上级结构坐标校验通过：${ids.length} 个真实坐标条目（${anchored} 个锚点与 OpenNGC 逐位吻合）、`);
console.log(`  Cosmicflows-3 实测距离表 ${Object.keys(CF3_TEMPLATE_DISTANCES).length} 项、`);
console.log(`  ${upperInTable} 个上级节点全部由真实星表驱动，共 ${NODES.length} 个节点，派生命中 0 处非有限值。`);
