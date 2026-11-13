// scripts/build-openngc.mjs
// 把 OpenNGC 深空天体目录（mattiaverga/OpenNGC，CC BY-SA-4.0）转成银河系场景可用的
// 真实方向 + 壳层摆放点云。
//
// 关键取舍（为什么是"壳层摆放"）：
//  · OpenNGC 只给 RA/Dec（可靠）与 Redshift/RadVel（仅星系有，且是视向速度），
//    没有逐天体的真实距离列。深空天体真实距离从 ~0.1 kpc（近邻星云）到数百 Mpc
//    （遥远星系），远超本银河系场景 ±17 kpc 的尺度，无法按真实距离摆放。
//  · 因此：方向用真实 (l,b)（从 RA/Dec 经 src/coord/galactic.js 唯一真源换算）；
//    半径用"壳层"——星系按红移/视向速度经哈勃定律 d=cz/H0 推距离，再对数映射到
//    [3,16] kpc 壳层（近的在内、远的在外）；无距离者（多为银河系内星云/星团）按
//    类型分到内/外壳层。这样既能"看得到真实天区分布"，又不夸大尺度。
//
// 数据源：mattiaverga/OpenNGC 仓库 database_files/NGC.csv（与 addendum.csv 合并）。
// 坐标链路复用 src/coord/galactic.js（唯一真源），与运行时定位完全同源同尺度。
//
// 运行：node scripts/build-openngc.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { equatorialToGalactic, galacticToScene } from '../src/coord/galactic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ngcPath = resolve(__dirname, '../data/raw/NGC.csv');
const addPath = resolve(__dirname, '../data/raw/addendum.csv');
const outPath = resolve(__dirname, '../src/data/openngc.js');

// ---- 哈勃常数：km/s/Mpc（用于红移/视向速度推距离） ----
const H0 = 70;
const C = 299792.458; // 光速 km/s

// ---- 类别定义：index → { zh, color:[r,g,b] } ----
const CAT = [
  { zh: '星系', color: [0.78, 0.85, 1.0] },            // 0 GALAXY
  { zh: '发射星云', color: [1.0, 0.56, 0.75] },         // 1 EMISSION_NEBULA
  { zh: '行星状星云', color: [0.62, 0.91, 0.88] },      // 2 PLANETARY_NEBULA
  { zh: '超新星遗迹', color: [1.0, 0.69, 0.44] },       // 3 SNR
  { zh: '反射星云', color: [0.66, 0.78, 1.0] },         // 4 REFLECTION_NEBULA
  { zh: '暗星云', color: [0.60, 0.56, 0.75] },          // 5 DARK_NEBULA
  { zh: '疏散星团', color: [1.0, 0.89, 0.66] },         // 6 OPEN_CLUSTER
  { zh: '球状星团', color: [1.0, 0.90, 0.72] },         // 7 GLOBULAR_CLUSTER
  { zh: '星团', color: [1.0, 0.85, 0.63] },             // 8 CLUSTER
  { zh: '星宿 / 假星团', color: [0.87, 0.87, 0.87] },   // 9 ASTERISM
  { zh: '其他', color: [0.81, 0.84, 0.88] },            // 10 OTHER
];

function classifyType(t) {
  if (!t) return 10;
  const tokens = String(t).toUpperCase().split(/[;,\s]+/).map((s) => s.trim()).filter(Boolean);
  for (const tok of tokens) {
    if (['G', 'GX', 'I', 'IG', 'LIN', 'QSO', 'AGN', 'SBR', 'PEC', 'BLL', 'CG', 'DWARFG', 'DWARFGX'].includes(tok)) return 0;
    if (['NEB', 'BN', 'EMI', 'SFR', 'HII'].includes(tok)) return 1;
    if (tok === 'PN') return 2;
    if (tok === 'SNR') return 3;
    if (tok === 'RNE') return 4;
    if (tok === 'DNE') return 5;
    if (tok === 'OCL') return 6;
    if (tok === 'GCL') return 7;
    if (['GC', 'MOV', 'ASS'].includes(tok)) return 8; // 疏散/移动/星协 → 星团
    if (tok === 'AST') return 9;
  }
  return 10;
}

// RA "hh:mm:ss.s"（小时制）→ 十进制度
function parseRA(s) {
  if (!s || !s.trim()) return NaN;
  const p = s.trim().split(':').map(Number);
  if (p.some((x) => !isFinite(x))) return NaN;
  return (p[0] + (p[1] || 0) / 60 + (p[2] || 0) / 3600) * 15;
}
// Dec "+dd:mm:ss.s" → 十进制度
function parseDec(s) {
  if (!s || !s.trim()) return NaN;
  const neg = s.trim().startsWith('-');
  const p = s.trim().replace(/^[+-]/, '').split(':').map(Number);
  if (p.some((x) => !isFinite(x))) return NaN;
  const v = (p[0] + (p[1] || 0) / 60 + (p[2] || 0) / 3600) * (neg ? -1 : 1);
  return v;
}

// 由红移/视向速度推算距离（Mpc）；都没有返回 null
function deriveDistMpc(zStr, vStr) {
  const z = parseFloat(zStr);
  if (isFinite(z) && z > 0) return (C * z) / H0;
  const v = parseFloat(vStr);
  if (isFinite(v) && v > 50) return v / H0; // 视向速度太小（本地/不确定）不采用
  return null;
}

// 把真实距离（Mpc）对数映射到壳层半径 [3,16] kpc
function shellFromDist(dMpc) {
  const lo = 0.0008, hi = 300; // 0.8 kpc ~ 300 Mpc
  const d = Math.min(hi, Math.max(lo, dMpc));
  const t = (Math.log10(d) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
  return 3 + t * (16 - 3);
}
// 无距离：按类型分壳层（银河系内天体在内壳、星系在外壳）+ 名称哈希抖动，避免全叠一层
function shellFromType(cat, name) {
  let base;
  if (cat === 0) base = 11 + (hashStr(name) % 5) * 1.0;        // 星系：11~15 kpc
  else if (cat >= 6 && cat <= 8) base = 6 + (hashStr(name) % 4) * 0.8; // 星团：6~8.4
  else base = 3.5 + (hashStr(name) % 4) * 0.8;                  // 星云/其他：3.5~5.7
  return base;
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

// 亮度：亮星等突出、暗的压暗（地板 0.35），无星等取 0.7
function magBright(mag) {
  if (!isFinite(mag)) return 0.7;
  return Math.max(0.35, Math.min(1, 1.1 - (mag + 5) / 15));
}

// ---- 读 CSV（分号分隔） ----
function readRows(path) {
  let raw = '';
  try { raw = readFileSync(path, 'utf8'); } catch { return []; }
  const lines = raw.split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(';').map((h) => h.trim());
  const idx = (n) => header.indexOf(n);
  const iName = idx('Name'), iType = idx('Type'), iRA = idx('RA'), iDec = idx('Dec'),
    iVMag = idx('V-Mag'), iBMag = idx('B-Mag'), iZ = idx('Redshift'), iV = idx('RadVel'),
    iCommon = idx('Common names');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const f = lines[i].split(';');
    rows.push({
      name: f[iName]?.trim() || '',
      type: f[iType]?.trim() || '',
      ra: parseRA(f[iRA]),
      dec: parseDec(f[iDec]),
      vMag: parseFloat(f[iVMag]),
      bMag: parseFloat(f[iBMag]),
      z: f[iZ]?.trim() || '',
      v: f[iV]?.trim() || '',
      common: (f[iCommon]?.trim() || '').replace(/\s*\|\s*/g, ', '),
    });
  }
  return rows;
}

const allRows = [...readRows(ngcPath), ...readRows(addPath)];
// 按 Name 去重（addendum 优先于主表时保留后者；这里保留首次出现）
const seen = new Set();
const rows = [];
for (const r of allRows) {
  const key = r.name || `row${rows.length}`;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push(r);
}

// ---- 生成场景坐标与元数据 ----
const pos = [];
const col = [];
const ids = [];
const cats = [];
const mags = [];
const dists = [];
const ras = [];
const decs = [];
const lbs = [];
const commons = [];
let used = 0, skipped = 0, withDist = 0;

for (const r of rows) {
  if (!isFinite(r.ra) || !isFinite(r.dec)) { skipped++; continue; }
  const [l, b] = equatorialToGalactic(r.ra, r.dec);
  if (!isFinite(l) || !isFinite(b)) { skipped++; continue; }
  const cat = classifyType(r.type);
  const dMpc = deriveDistMpc(r.z, r.v);
  const shellKpc = dMpc != null ? shellFromDist(dMpc) : shellFromType(cat, r.name);
  const [x, y, z] = galacticToScene(l, b, shellKpc);
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) { skipped++; continue; }

  const mag = isFinite(r.vMag) ? r.vMag : (isFinite(r.bMag) ? r.bMag : NaN);
  const br = magBright(mag);
  const [cr, cg, cb] = CAT[cat].color;

  pos.push(x, y, z);
  col.push(cr * br, cg * br, cb * br);
  ids.push(r.name);
  cats.push(cat);
  mags.push(isFinite(mag) ? mag : -99);
  dists.push(dMpc != null ? dMpc : -1);
  ras.push(r.ra);
  decs.push(r.dec);
  lbs.push(l, b);
  commons.push(r.common);
  if (dMpc != null) withDist++;
  used++;
}

const posArr = new Float32Array(pos);
const colArr = new Float32Array(col);
// 类别索引也用 Float32 存储，复用下方 _b64 的 Float32 解码器（避免单独写 Int8 解码路径）
const catArr = new Float32Array(cats);
const magArr = new Float32Array(mags);
const distArr = new Float32Array(dists);
const raArr = new Float32Array(ras);
const decArr = new Float32Array(decs);
const lbArr = new Float32Array(lbs);

function b64(buf) { return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString('base64'); }

const out = `// AUTO-GENERATED by scripts/build-openngc.mjs — do not edit by hand.
// 数据源：OpenNGC (mattiaverga/OpenNGC, CC BY-SA-4.0)
// ${used} 个深空天体（NGC/IC/其他），方向用真实银道坐标 (l,b)，半径用壳层摆放
// （星系按红移/视向速度推距离对数映射到 3–16 kpc 壳层；无距离按类型分壳层）。
// 位置/颜色/数值元数据为 Float32 的 base64，运行时 atob/解码；仅供银河系深空点云使用。
const _b64 = (s) => {
  const bin = atob(s), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Float32Array(u.buffer);
};
export const OPENNGC_COUNT = ${used};
export const OPENNGC_POS = _b64("${b64(posArr)}");
export const OPENNGC_COL = _b64("${b64(colArr)}");
export const OPENNGC_CAT = _b64("${b64(catArr)}");   // Int8 类别索引（见 CAT_META）
export const OPENNGC_MAG = _b64("${b64(magArr)}");   // V 星等，-99 表示缺失
export const OPENNGC_DIST = _b64("${b64(distArr)}"); // 推算距离（Mpc），-1 表示无
export const OPENNGC_RA = _b64("${b64(raArr)}");    // 赤经（度）
export const OPENNGC_DEC = _b64("${b64(decArr)}");  // 赤纬（度）
export const OPENNGC_LB = _b64("${b64(lbArr)}");    // 银经/银纬（度，每体两条）
// 类别索引 → 中文名（与构建脚本 CAT 顺序一致）
export const OPENNGC_CAT_ZH = ${JSON.stringify(CAT.map((c) => c.zh))};
// 字符串元数据（按索引对应上面的数组）
export const OPENNGC_IDS = ${JSON.stringify(ids)};
export const OPENNGC_COMMON = ${JSON.stringify(commons)};
export const OPENNGC_META = {
  ids: OPENNGC_IDS, cat: OPENNGC_CAT, catZh: OPENNGC_CAT_ZH, mag: OPENNGC_MAG,
  dist: OPENNGC_DIST, ra: OPENNGC_RA, dec: OPENNGC_DEC, lb: OPENNGC_LB, common: OPENNGC_COMMON,
};
`;
writeFileSync(outPath, out);
console.log(`OpenNGC: used=${used} skipped=${skipped} withDist=${withDist} / total rows=${rows.length}`);
console.log('Wrote -> ' + outPath);
