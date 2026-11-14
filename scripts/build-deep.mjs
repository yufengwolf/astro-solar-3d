/**
 * 由 data/raw/ 的六份原始星表生成 src/data/deep/*.js。
 *
 * 所有点统一为「银心原点的三维场景坐标（kpc）」，换算只走
 * src/coord/galactic.js 这一处真源；距离一律来自各星表的真实观测量：
 *   · Cosmicflows-4 : 距离模数 DM → d(Mpc) = 10^((DM-25)/5)
 *   · 2M++          : CMB 视向速度 Vcmb → d = Vcmb / H0（H0=74.6, CF4 标定）
 *   · Gaia GCNS     : 视差 Plx(mas) → d(pc) = 1000/Plx
 *   · HCBG GRB      : 光谱红移 z → 共动距离（Planck Ωm=0.308 / ΩΛ=0.692）
 *   · HyperLEDA PGC : 只有天球位置与 PGC 号，按 PGC 与 CF4 交叉补形态类型
 *   · NED-D         : 只有星系名与多次独立测距，按名称聚合为距离索引
 *
 * 原始数据全量解析、不截断；前端渲染时才按视场抽稀（见 main.js）。
 * 重建：node scripts/build-deep.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { galacticToScene, equatorialToGalactic } from '../src/coord/galactic.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = resolve(root, 'data/raw');
const OUT = resolve(root, 'src/data/deep');
mkdirSync(OUT, { recursive: true });

const raw = (name) => {
  const p = resolve(RAW, name);
  if (!existsSync(p)) throw new Error(`缺少原始数据 ${p}，请先运行 scripts/_fetch_*.sh`);
  return readFileSync(p, 'utf8');
};

// ── 编码工具 ──────────────────────────────────────────────────────────
const enc = (arr) => {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return Buffer.from(s, 'binary').toString('base64');
};
const lines = (text) => text.split(/\r?\n/).filter((l) => l && !l.startsWith('#') && !l.startsWith('-----'));
const num = (v) => { const n = Number(String(v).trim()); return Number.isFinite(n) ? n : NaN; };
const f32 = (values) => enc(new Float32Array(values));
const i32 = (values) => enc(new Int32Array(values));
const u8 = (values) => enc(new Uint8Array(values));

/** 生成一个独立可动态 import 的数据模块 */
function emit(name, header, body) {
  const file = resolve(OUT, `${name}.js`);
  const src = `// 由 scripts/build-deep.mjs 生成，请勿手改。\n${header}\n` +
    `const _dec = (s, Ctor) => {\n` +
    `  const bin = atob(s), u = new Uint8Array(bin.length);\n` +
    `  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);\n` +
    `  return new Ctor(u.buffer);\n` +
    `};\n\n${body}\n`;
  writeFileSync(file, src, 'utf8');
  console.log(`  ${name}.js  ${(src.length / 1024).toFixed(0)} KB`);
  return src.length;
}

// ── 红移 → 共动距离（Mpc），Planck 2015 宇宙学数值积分 ────────────────
const C_OVER_H0 = 299792.458 / 67.8;   // Mpc
const OM = 0.308, OL = 0.692;
function comovingMpc(z) {
  if (!(z > 0)) return 0;
  const n = 256, dz = z / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const zz = (i + 0.5) * dz;
    sum += dz / Math.sqrt(OM * (1 + zz) ** 3 + OL);
  }
  return C_OVER_H0 * sum;
}

// ── 1. Cosmicflows-4 (J/ApJ/944/94/table2) ───────────────────────────
function buildCF4() {
  const rows = lines(raw('cf4_table2.tsv'));
  const pos = [], aux = [], ids = [];
  let bad = 0;
  for (const l of rows) {
    const c = l.split('\t').map((s) => s.trim());
    if (c.length < 9) continue;
    const pgc = num(c[0]), dm = num(c[3]), edm = num(c[4]);
    const glon = num(c[7]), glat = num(c[8]);
    if (!Number.isFinite(dm) || !Number.isFinite(glon) || !Number.isFinite(glat) || !(dm > 0)) { bad++; continue; }
    const dMpc = 10 ** ((dm - 25) / 5);
    const p = galacticToScene(glon, glat, dMpc * 1000);
    if (!p.every(Number.isFinite)) { bad++; continue; }
    pos.push(...p);
    aux.push(dm, Number.isFinite(edm) ? edm : 0, num(c[2]) || 0);
    ids.push(Number.isFinite(pgc) ? pgc : 0);
  }
  const count = ids.length;
  emit('cf4',
    `// Cosmicflows-4: Tully et al. 2023, ApJ 944, 94 (VizieR J/ApJ/944/94/table2)\n` +
    `// ${count} 个星系，距离为实测距离模数；POS 单位 kpc（银心原点）。\n` +
    `// AUX stride=3: [DM(mag), e_DM(mag), Vcmb(km/s)]；IDS 为 PGC 编号。`,
    `export const META = ${JSON.stringify({
      id: 'cf4', label: 'Cosmicflows-4', rows: count,
      text: 'Tully et al. 2023, ApJ 944, 94 — 55,877 星系的实测距离（VizieR J/ApJ/944/94）',
      url: 'https://vizier.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94',
      distance: '距离模数 DM（TF / FP / SNIa / TRGB / Cepheid / SBF / SNII / maser 加权）',
    })};\n` +
    `export const COUNT = ${count};\n` +
    `export const POS = _dec("${f32(pos)}", Float32Array);\n` +
    `export const AUX = _dec("${f32(aux)}", Float32Array);\n` +
    `export const IDS = _dec("${i32(ids)}", Int32Array);\n`);
  return { count, bad, ids };
}

// ── 2. 2M++ (J/MNRAS/416/2840/catalog) ───────────────────────────────
const H0 = 74.6; // km/s/Mpc，CF4 标定值
function build2MPP() {
  const rows = lines(raw('2mpp_catalog.tsv'));
  const pos = [], aux = [], ids = [];
  let bad = 0, fake = 0, blue = 0;
  for (const l of rows) {
    const c = l.split('\t').map((s) => s.trim());
    if (c.length < 8) continue;
    // Ref = "zoa" 是银道遮掩带里人为补的假星系，不是真实观测天体
    if (String(c[7]).toLowerCase().startsWith('zoa')) { fake++; continue; }
    const ra = num(c[1]), de = num(c[2]), ksmag = num(c[3]), vcmb = num(c[5]);
    if (!Number.isFinite(ra) || !Number.isFinite(de) || !Number.isFinite(vcmb)) { bad++; continue; }
    // 本星系群近邻的蓝移星系 Vcmb ≤ 0（本动速度压过哈勃流）。它们仍是真实
    // 观测天体，不能丢；红移距离此时不成立，改用 80 km/s ≈ 1.07 Mpc 的下限，
    // 并把真实（负的）Vcmb 原样留在 AUX 里供信息卡识别。
    if (vcmb <= 0) blue++;
    const dMpc = Math.max(vcmb, 80) / H0;
    const [glon, glat] = equatorialToGalactic(ra, de);
    const p = galacticToScene(glon, glat, dMpc * 1000);
    if (!p.every(Number.isFinite)) { bad++; continue; }
    pos.push(...p);
    aux.push(vcmb, Number.isFinite(ksmag) ? ksmag : 0);
    ids.push(String(c[0]));
  }
  const count = ids.length;
  emit('2mpp',
    `// 2M++ galaxy redshift catalogue: Lavaux & Hudson 2011 (VizieR J/MNRAS/416/2840)\n` +
    `// ${count} 个真实星系（已剔除 ${fake} 个银道遮掩带假源）；距离为 Vcmb/H0 红移距离。\n` +
    `// AUX stride=2: [Vcmb(km/s), Ksmag]；IDS 为 2MASS-XSC 名称。`,
    `export const META = ${JSON.stringify({
      id: '2mpp', label: '2M++', rows: count, fakeExcluded: fake, blueShiftNearby: blue,
      text: 'Lavaux & Hudson 2011, MNRAS 416, 2840 — 69,160 个真实星系红移（VizieR J/MNRAS/416/2840）',
      url: 'https://vizier.cds.unistra.fr/viz-bin/cat/J/MNRAS/416/2840',
      distance: `Vcmb / H0（H0 = ${H0} km/s/Mpc），红移距离非实测距离；${blue} 个近邻蓝移星系用 80 km/s 距离下限`,
    })};\n` +
    `export const COUNT = ${count};\n` +
    `export const POS = _dec("${f32(pos)}", Float32Array);\n` +
    `export const AUX = _dec("${f32(aux)}", Float32Array);\n` +
    `export const IDS = ${JSON.stringify(ids)};\n`);
  return { count, bad, fake };
}

// ── 3. Gaia GCNS (J/A+A/649/A6/table1c) ──────────────────────────────
function buildGCNS() {
  const rows = lines(raw('gcns.tsv'));
  const pos = [], aux = [];
  let bad = 0;
  for (const l of rows) {
    const c = l.split('\t').map((s) => s.trim());
    if (c.length < 5) continue;
    const ra = num(c[1]), de = num(c[2]), plx = num(c[3]), gmag = num(c[4]);
    if (!Number.isFinite(ra) || !Number.isFinite(de) || !Number.isFinite(plx) || plx <= 0) { bad++; continue; }
    const [glon, glat] = equatorialToGalactic(ra, de);
    const p = galacticToScene(glon, glat, 1 / plx); // 1000/Plx pc = 1/Plx kpc
    if (!p.every(Number.isFinite)) { bad++; continue; }
    pos.push(...p);
    aux.push(plx, Number.isFinite(gmag) ? gmag : 0);
  }
  const count = aux.length / 2;
  emit('gcns',
    `// Gaia Catalogue of Nearby Stars (GCNS): Gaia Collaboration, Smart et al. 2021\n` +
    `// ${count} 颗 100 pc 内恒星全量；距离 = 三角视差。POS 单位 kpc（银心原点）。\n` +
    `// AUX stride=2: [Plx(mas), Gmag]。`,
    `export const META = ${JSON.stringify({
      id: 'gcns', label: 'Gaia GCNS (100 pc)', rows: count,
      text: 'Gaia EDR3 GCNS — 太阳 100 pc 内 331,312 颗恒星全量（VizieR J/A+A/649/A6）',
      url: 'https://vizier.cds.unistra.fr/viz-bin/cat/J/A+A/649/A6',
      distance: '三角视差 d(pc) = 1000 / Plx(mas)',
    })};\n` +
    `export const COUNT = ${count};\n` +
    `export const POS = _dec("${f32(pos)}", Float32Array);\n` +
    `export const AUX = _dec("${f32(aux)}", Float32Array);\n`);
  return { count, bad };
}

// ── 4. HCBG 的 GRB 示踪样本 (J/A+A/584/A48/tablea1) ─────────────────
function buildHCBG() {
  const all = raw('hcbg_grbs.tsv').split(/\r?\n/);
  const start = all.findIndex((l) => /^-{4,}/.test(l));
  const pos = [], aux = [], ids = [], members = [];
  let bad = 0, inWall = 0;
  for (let i = start + 1; i < all.length; i++) {
    const l = all[i];
    if (!l || l.startsWith('#')) continue;
    const c = l.split('\t').map((s) => s.trim());
    if (c.length < 6) continue;
    const name = c[1], t90 = num(c[2]), ra = num(c[3]), de = num(c[4]), z = num(c[5]);
    if (!Number.isFinite(ra) || !Number.isFinite(de) || !Number.isFinite(z) || z <= 0) { bad++; continue; }
    const [glon, glat] = equatorialToGalactic(ra, de);
    const dMpc = comovingMpc(z);
    const p = galacticToScene(glon, glat, dMpc * 1000);
    if (!p.every(Number.isFinite)) { bad++; continue; }
    pos.push(...p);
    aux.push(z, Number.isFinite(t90) ? t90 : 0);
    ids.push(name || `GRB-${ids.length}`);
    members.push({ id: name, z, ra, de, t90: Number.isFinite(t90) ? t90 : 0, dMpc, glon, glat, pos: p });
    if (z >= 1.6 && z < 2.1) inWall++;
  }
  const count = ids.length;
  emit('hcbg',
    `// Hercules–Corona Borealis Great Wall 的 GRB 示踪样本：\n` +
    `// Horváth, Bagoly, Hakkila & Tóth 2015, A&A 584, A48 (VizieR J/A+A/584/A48/tablea1)\n` +
    `// ${count} 个带实测光谱红移的 GRB，其中 ${inWall} 个落在 1.6 ≤ z < 2.1 的长城红移切片。\n` +
    `// 距离为 Planck 宇宙学共动距离；AUX stride=2: [z, T90(s)]。`,
    `export const META = ${JSON.stringify({
      id: 'hcbg', label: 'HCBG GRB tracers', rows: count, inRedshiftSlice: inWall,
      text: 'Horváth et al. 2015, A&A 584, A48 — 357 个带红移的 GRB（发现武仙－北冕座长城所用样本）',
      url: 'https://vizier.cds.unistra.fr/viz-bin/cat/J/A+A/584/A48',
      distance: '光谱红移 → 共动距离（H0=67.8, Ωm=0.308, ΩΛ=0.692）',
      caveat: '该结构的存在性在天文学界仍有争议；GRB 是示踪天体，不是长城本身的星系。',
    })};\n` +
    `export const COUNT = ${count};\n` +
    `export const POS = _dec("${f32(pos)}", Float32Array);\n` +
    `export const AUX = _dec("${f32(aux)}", Float32Array);\n` +
    `export const IDS = ${JSON.stringify(ids)};\n`);
  return { count, inWall, bad, pos, aux, ids, members };
}

// ── 5. HyperLEDA PGC（全量解析，按 PGC 与 CF4 交叉） ─────────────────
function sexagesimalToDeg(ra, de) {
  // VII/237 的 RAJ2000 = "HH MM SS.s"，DEJ2000 = "+DD MM SS"
  const m = String(ra).trim().match(/^(\d{1,2})[\s:]+(\d{1,2})[\s:]+(\d+(?:\.\d+)?)$/);
  const d = String(de).trim().match(/^([+-])(\d{1,2})[\s:]+(\d{1,2})[\s:]+(\d+(?:\.\d+)?)$/);
  if (m && d) {
    const R = (+m[1] + +m[2] / 60 + +m[3] / 3600) * 15;
    const D = (+d[2] + +d[3] / 60 + +d[4] / 3600) * (d[1] === '-' ? -1 : 1);
    return [R, D];
  }
  return [num(ra), num(de)];
}
function buildHyperLEDA(cf4) {
  const rows = lines(raw('hyperleda_pgc.tsv'));
  const byPgc = new Map();
  let parsed = 0, bad = 0;
  for (const l of rows) {
    const c = l.split('\t').map((s) => s.trim());
    if (c.length < 3) continue;
    const pgc = num(c[0]);
    const [ra, de] = sexagesimalToDeg(c[1], c[2]);
    if (!Number.isFinite(pgc) || !Number.isFinite(ra) || !Number.isFinite(de)) { bad++; continue; }
    parsed++;
    byPgc.set(pgc, { ra, de, morph: c[3] || '', logD25: num(c[4]) || 0 });
  }
  // 与 CF4 交叉：给 CF4 的每个 PGC 补 HyperLEDA 形态类型
  const morph = [], matched = new Set();
  for (let i = 0; i < cf4.ids.length; i++) {
    const h = byPgc.get(cf4.ids[i]);
    morph.push(h?.morph ?? '');
    if (h) matched.add(cf4.ids[i]);
  }
  emit('hyperleda',
    `// HYPERLEDA. I. Catalog of galaxies: Paturel et al. 2003 (VizieR VII/237/pgc)\n` +
    `// 全量 ${parsed} 个 PGC 星系已解析；其中 ${matched.size} 个与 Cosmicflows-4 按 PGC 号匹配，\n` +
    `// 形态类型写入 MORPH（与 cf4.IDS 同序）。VII/237 只有天球位置、没有距离，\n` +
    `// 因此不生成独立三维点云：三维位置一律由 CF4 的实测距离提供。`,
    `export const META = ${JSON.stringify({
      id: 'hyperleda', label: 'HyperLEDA PGC', rows: parsed, matchedCF4: matched.size,
      text: 'Paturel et al. 2003, A&A 412, 45 — PGC2003 全量 983,261 个星系（VizieR VII/237）',
      url: 'https://vizier.cds.unistra.fr/viz-bin/cat/VII/237',
      note: '该表只有赤道坐标与形态，无距离；按 PGC 与 CF4 交叉后补形态，不生成独立点云。',
    })};\n` +
    `export const COUNT = ${parsed};\n` +
    `export const MORPH = ${JSON.stringify(morph)};\n`);
  return { parsed, matched: matched.size, bad };
}

// ── 6. NED-D（按星系名聚合的独立测距索引） ───────────────────────────
function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}
function buildNEDD() {
  const text = raw('ned_d.csv');
  const all = text.split(/\r?\n/);
  const map = new Map();
  let rows = 0, skipped = 0;
  for (let i = 0; i < all.length; i++) {
    const l = all[i];
    if (!l || l.startsWith('"FRN"')) continue;
    const c = parseCsvLine(l);
    if (c.length < 9) continue;
    const rec = String(c[1]).trim();
    // D = 999999 是同一星系测距的冗余汇总行，排除以免重复计数
    if (rec === '999999') { skipped++; continue; }
    // 表头：0 Exclusion / 1 D / 2 G / 3 Galaxy ID / 4 m-M / 5 err /
    //       6 D(Mpc) / 7 Method / 8 REFCODE …
    const name = String(c[3] || '').trim();
    const dMpc = num(c[6]);
    const method = String(c[7] || '').trim();
    if (!name || !Number.isFinite(dMpc) || dMpc <= 0) continue;
    rows++;
    let e = map.get(name);
    if (!e) { e = { n: 0, sum: 0, methods: new Set(), min: Infinity, max: 0 }; map.set(name, e); }
    e.n++; e.sum += dMpc; e.min = Math.min(e.min, dMpc); e.max = Math.max(e.max, dMpc);
    if (method) e.methods.add(method);
  }
  const names = [...map.keys()];
  const count = names.length;
  const nArr = [], dArr = [], methods = [];
  for (const name of names) {
    const e = map.get(name);
    nArr.push(Math.min(65535, e.n));
    dArr.push(e.sum / e.n);
    methods.push([...e.methods].slice(0, 4).join('|'));
  }
  emit('ned-d',
    `// NED Redshift-Independent Distances: Steer, Madore & NED Team, v17.1.0 (2020-05)\n` +
    `// 全量 ${rows} 条独立测距记录聚合为 ${count} 个星系；NAMES 与三个数组同序。\n` +
    `// NED-D 不含天球坐标，因此只作信息卡的「独立测距次数 / 方法 / 中位距离」索引。`,
    `export const META = ${JSON.stringify({
      id: 'ned-d', label: 'NED-D v17.1.0', rows, galaxies: count, skippedSummaryRows: skipped,
      text: 'NED Redshift-Independent Distances v17.1.0 — 272,573 条距离测量（2020-05）',
      url: 'https://ned.ipac.caltech.edu/Library/Distances/',
      note: 'NED-D 是距离汇编，不含坐标；按 Galaxy ID 聚合后供信息卡交叉查询，不生成独立点云。',
    })};\n` +
    `export const COUNT = ${count};\n` +
    `export const NAMES = ${JSON.stringify(names)};\n` +
    `export const N_MEASURES = _dec("${enc(new Uint16Array(nArr))}", Uint16Array);\n` +
    `export const D_MEDIAN = _dec("${f32(dArr)}", Float32Array);\n` +
    `export const METHODS = ${JSON.stringify(methods)};\n`);
  return { rows, count, skipped };
}

// ── 主流程 ────────────────────────────────────────────────────────────
console.log('由 data/raw/ 生成深度星表数据层…');
const cf4 = buildCF4();
const mpp = build2MPP();
const gcns = buildGCNS();
const hcbg = buildHCBG();
const leda = buildHyperLEDA(cf4);
const nedd = buildNEDD();

// 注册表：轻量、静态 import；各源数据靠动态 import 分包，只有需要的页面才下载
const registry = `// 由 scripts/build-deep.mjs 生成，请勿手改。
// 深度星表注册表：轻量元数据 + 显式动态 import 映射（Vite 需要静态字面量才能分包）。
// 每个 loader 返回 { META, COUNT, POS, AUX, IDS? }；POS 为银心原点 kpc 三维坐标。
export const DEEP_SOURCES = ${JSON.stringify({
  cf4: { label: 'Cosmicflows-4', role: 'cosmos', color: 0x7fb2ff, kind: 'galaxy', auxStride: 3, auxMax: 40, auxLabel: '距离模数 DM' },
  '2mpp': { label: '2M++', role: 'cosmos', color: 0xffc98a, kind: 'galaxy', auxStride: 2, auxMax: 20000, auxLabel: 'Vcmb (km/s)' },
  gcns: { label: 'Gaia GCNS', role: 'galaxy', color: 0xcfe4ff, kind: 'star', auxStride: 2, auxMax: 100, auxLabel: '视差 Plx (mas)' },
  hcbg: { label: 'HCBG GRB', role: 'hcbg', color: 0xff8fa8, kind: 'grb', auxStride: 2, auxMax: 4, auxLabel: '红移 z' },
  hyperleda: { label: 'HyperLEDA PGC', role: 'metadata', color: 0xa8d8c0, kind: 'metadata' },
  'ned-d': { label: 'NED-D', role: 'metadata', color: 0xd8c0ff, kind: 'metadata' },
}, null, 2)};

// HCBG 页的菜单成员：357 个 GRB 的真实元数据（轻量，随注册表静态加载）。
// 三维位置已含在每项 pos 中，页面据此生成「真实成员」锚点与信息卡。
export const HCBG_MEMBERS = ${JSON.stringify(hcbg.members.map((m) => ({
  id: m.id, z: m.z, ra: m.ra, de: m.de, t90: m.t90, dMpc: m.dMpc, glon: m.glon, glat: m.glat, pos: m.pos,
})))};

export const DEEP_LOADERS = {
  cf4: () => import('./cf4.js'),
  '2mpp': () => import('./2mpp.js'),
  gcns: () => import('./gcns.js'),
  hcbg: () => import('./hcbg.js'),
  hyperleda: () => import('./hyperleda.js'),
  'ned-d': () => import('./ned-d.js'),
};

export const DEEP_BUILD_STATS = ${JSON.stringify({
  cf4: { rows: cf4.count, bad: cf4.bad },
  '2mpp': { rows: mpp.count, bad: mpp.bad, fakeExcluded: mpp.fake },
  gcns: { rows: gcns.count, bad: gcns.bad },
  hcbg: { rows: hcbg.count, inRedshiftSlice: hcbg.inWall, bad: hcbg.bad },
  hyperleda: { rows: leda.parsed, matchedCF4: leda.matched, bad: leda.bad },
  'ned-d': { measurements: nedd.rows, galaxies: nedd.count, skippedSummaryRows: nedd.skipped },
}, null, 2)};
`;
writeFileSync(resolve(OUT, 'registry.js'), registry, 'utf8');
console.log(`  registry.js  ${(registry.length / 1024).toFixed(0)} KB`);
console.log('\n汇总:', JSON.stringify({
  cf4: cf4.count, '2mpp': mpp.count, gcns: gcns.count, hcbg: hcbg.count,
  hcbgInSlice: hcbg.inWall, hyperleda: leda.parsed, hyperledaMatchedCF4: leda.matched,
  nedDMeasurements: nedd.rows, nedDGalaxies: nedd.count,
}, null, 2));
