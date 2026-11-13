/**
 * 由 2MRS 星系群表生成本地宇宙「真实成员」数据层 src/data/2mrs.js。
 *
 * ── 数据源（真实包，非手抄）────────────────────────────────────────────
 *  Lambert, T. S. et al. (2020), "2MRS Galaxy Group Catalog"
 *  Table 1（群表，3022 群）与 Table 3（成员星系，17262 颗）
 *  仓库：https://github.com/TrystanScottLambert/2MRS_GroupCatalog_Dash
 *
 *  本机可直连的下载通道（沙箱里 raw.githubusercontent.com 的 schannel 握手不稳，
 *  jsDelivr 镜像稳定返回完整文件；两个地址内容完全相同）：
 *    curl -L -o data/raw/2mrs_groups.csv \
 *      https://cdn.jsdelivr.net/gh/TrystanScottLambert/2MRS_GroupCatalog_Dash@master/Table1.csv
 *    curl -L -o data/raw/2mrs_members.csv \
 *      https://cdn.jsdelivr.net/gh/TrystanScottLambert/2MRS_GroupCatalog_Dash@master/Table3.csv
 *  原始地址（本机浏览器可直连）：
 *    https://raw.githubusercontent.com/TrystanScottLambert/2MRS_GroupCatalog_Dash/master/Table1.csv
 *    https://raw.githubusercontent.com/TrystanScottLambert/2MRS_GroupCatalog_Dash/master/Table3.csv
 *
 *  Table 1 字段：Group_ID, Other Names, Ra, Dec, l, b, Nmem, Nmem_Corrected,
 *    Richness, V_cmb, Co_Moving_Distance(Mpc), Luminosity_Distance(Mpc),
 *    Dispersion, Standard_Deviation, R200(Mpc), M200(1e12 Msun), Number_of_Subs
 *
 * 坐标：与 cosmic-structures.js / galaxies.js 同源的银道系场景帧，
 *   galacticToScene(l, b, distMpc * 1000) → kpc，银心为原点、太阳在 SUN_GALACTIC_POS。
 *   两结构相减时太阳偏移抵消，差值即真实三维相对位置。
 *
 * 用法：node scripts/build-2mrs.mjs   （缺原始 CSV 时自动尝试下载）
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { galacticToScene } from '../src/coord/galactic.js';

const ROOT = resolve(import.meta.dirname, '..');
const RAW = resolve(ROOT, 'data/raw');
const GROUPS = resolve(RAW, '2mrs_groups.csv');
const MEMBERS = resolve(RAW, '2mrs_members.csv');
const OUT = resolve(ROOT, 'src/data/2mrs.js');

const MIRROR = 'https://cdn.jsdelivr.net/gh/TrystanScottLambert/2MRS_GroupCatalog_Dash@master';
const URLS = [
  [GROUPS, `${MIRROR}/Table1.csv`],
  [MEMBERS, `${MIRROR}/Table3.csv`],
];

mkdirSync(RAW, { recursive: true });
for (const [file, url] of URLS) {
  if (existsSync(file)) continue;
  console.log(`下载 ${url} ...`);
  try {
    execFileSync('curl', ['-sSL', '-k', '--max-time', '120', '-o', file, url], { stdio: 'inherit' });
  } catch (e) {
    throw new Error(`原始星表缺失且自动下载失败，请手动执行：curl -L -o "${file}" "${url}"\n${e.message}`);
  }
}

/** 轻量 CSV 解析（支持引号包裹的逗号） */
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const split = (line) => {
    const out = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
      else if (c === ',' && !quoted) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const head = split(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = split(line);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}

const num = (v) => { const n = Number(String(v).replace(/[^\d.eE+-]/g, '')); return Number.isFinite(n) ? n : 0; };

const rows = parseCsv(readFileSync(GROUPS, 'utf8'));
const members = parseCsv(readFileSync(MEMBERS, 'utf8'));
const memberCountByGroup = new Map();
for (const m of members) {
  const k = String(m['Group ID'] ?? '').trim();
  if (k) memberCountByGroup.set(k, (memberCountByGroup.get(k) ?? 0) + 1);
}

const groups = [];
for (const r of rows) {
  const id = String(r.Group_ID ?? '').trim();
  const l = num(r.l), b = num(r.b), distMpc = num(r['Co_Moving_Distance']);
  if (!id || !Number.isFinite(l) || !Number.isFinite(b) || distMpc <= 0) continue;
  const pos = galacticToScene(l, b, distMpc * 1000); // kpc，银心原点
  if (!pos.every(Number.isFinite)) continue;
  const aliasRaw = String(r['Other Names'] ?? '').trim();
  const alias = aliasRaw && aliasRaw !== '-' ? aliasRaw.replace(/_/g, ' ') : '';
  groups.push({
    id,
    alias,
    l: +l.toFixed(3), b: +b.toFixed(3),
    distMpc: +distMpc.toFixed(3),
    nmem: num(r.Nmem),
    ncat: memberCountByGroup.get(id) ?? 0,
    v: num(r.V_cmb),
    r200: num(r.R200),
    m200: num(r.M200),
    pos: pos.map((v) => +v.toFixed(2)),
  });
}

groups.sort((a, b) => a.distMpc - b.distMpc);

const header = `// 由 scripts/build-2mrs.mjs 生成，请勿手改。
// 数据源：2MRS Galaxy Group Catalog, Lambert et al. (2020), Table 1 / Table 3
//   https://github.com/TrystanScottLambert/2MRS_GroupCatalog_Dash
// 坐标为真实银道系三维位置（kpc，银心原点），由 l/b + 实测共动距离派生。
// 原始 CSV 存于 data/raw/（.gitignore 忽略），重建：node scripts/build-2mrs.mjs
`;

const body = `export const TWO_MRS_SOURCE = {
  label: '2MRS 星系群表',
  text: '2MRS Galaxy Group Catalog — Lambert et al. (2020), Table 1（群）/ Table 3（成员星系）',
  url: 'https://github.com/TrystanScottLambert/2MRS_GroupCatalog_Dash',
  groups: ${groups.length},
  memberGalaxies: ${members.length},
};

/** 每个条目：id / alias / l,b(度) / distMpc / nmem / ncat / v(km/s) / r200(Mpc) / m200(1e12 Msun) / pos(kpc) */
export const TWO_MRS_GROUPS = ${JSON.stringify(groups, null, 0)};
export const TWO_MRS_COUNT = ${groups.length};
`;

writeFileSync(OUT, header + body, 'utf8');
console.log(`已生成 ${OUT}`);
console.log(`  ${groups.length} 个真实星系群 / ${members.length} 个成员星系`);
console.log(`  距离范围 ${groups[0].distMpc} ~ ${groups.at(-1).distMpc} Mpc`);
console.log(`  文件体积 ${(readFileSync(OUT).length / 1024).toFixed(0)} KB`);
