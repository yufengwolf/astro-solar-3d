/**
 * 2MRS 真实星系群成员自检（纯 Node，不加载 Three.js / DOM）。
 *
 * 固化「上层分支页必须有真实星表成员」这条约束，防止日后又退回空白页：
 *  1. src/data/2mrs.js 数据层字段合法、坐标有限、与原始 CSV 行数一致；
 *  2. 每个没有下级的上层结构（超星系团 / 星系团 / 群），在其真实三维
 *     中心的邻域里都能筛出足够多的 2MRS 群，供页面填充真实成员；
 *  3. systems/cosmos.js 确实接了 2MRS 数据层与「真实成员」分组。
 *
 * 说明：cosmos.js 依赖 Vite 的图片资源导入，Node 里无法直接 import，
 * 所以第 2 步在自检里复算同样筛选逻辑，第 3 步用源码文本断言。
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import {
  TWO_MRS_GROUPS, TWO_MRS_COUNT, TWO_MRS_SOURCE,
  TWO_MRS_MEMBER_COUNT, TWO_MRS_MEMBER_POS, TWO_MRS_MEMBER_GROUP,
  TWO_MRS_MEMBER_V, TWO_MRS_MEMBER_IDS,
} from '../src/data/2mrs.js';
import { NODES, childrenOf } from '../src/universe.js';
import { cosmicVec, COSMIC_LY_PER_KPC } from '../src/data/cosmic-structures.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const errors = [];
const fail = (m) => errors.push(m);
const ok = (cond, m) => { if (!cond) fail(m); };

// ---- 1. 数据层 ----
ok(TWO_MRS_COUNT === TWO_MRS_GROUPS.length, `TWO_MRS_COUNT(${TWO_MRS_COUNT}) 与数组长度不符`);
ok(TWO_MRS_COUNT >= 3000, `2MRS 群数量只有 ${TWO_MRS_COUNT} 个，疑似数据包未正确生成`);
ok(TWO_MRS_SOURCE.memberGalaxies >= 17000, '2MRS 成员星系数异常');
let bad = 0;
for (const g of TWO_MRS_GROUPS) {
  if (!Array.isArray(g.pos) || g.pos.length !== 3 || !g.pos.every(Number.isFinite)) { bad++; continue; }
  if (!(g.distMpc > 0 && g.distMpc < 400)) bad++;
  if (!(g.l >= 0 && g.l <= 360 && g.b >= -90 && g.b <= 90)) bad++;
  if (!(g.nmem >= 1)) bad++;
}
ok(bad === 0, `${bad} 个 2MRS 群字段/坐标非法`);

const rawGroups = resolve(root, 'data/raw/2mrs_groups.csv');
if (existsSync(rawGroups)) {
  const lines = readFileSync(rawGroups, 'utf8').trim().split(/\r?\n/).length - 1;
  ok(Math.abs(lines - TWO_MRS_COUNT) <= 2,
    `原始 CSV 有 ${lines} 行，生成数据只有 ${TWO_MRS_COUNT} 条（解析可能漏行）`);
}
const rawMembers = resolve(root, 'data/raw/2mrs_members.csv');
if (existsSync(rawMembers)) {
  const lines = readFileSync(rawMembers, 'utf8').trim().split(/\r?\n/).length - 1;
  ok(Math.abs(lines - TWO_MRS_MEMBER_COUNT) <= 2,
    `Table 3 原始 CSV 有 ${lines} 行，数据层只落库 ${TWO_MRS_MEMBER_COUNT} 颗（成员星系被丢弃）`);
}

// ---- 1b. Table 3 全量成员星系必须真正在数据层里，而不是只拿来数数 ----
ok(TWO_MRS_MEMBER_COUNT >= 17000, `成员星系只有 ${TWO_MRS_MEMBER_COUNT} 颗，疑似只导入了群表`);
ok(TWO_MRS_MEMBER_POS.length === TWO_MRS_MEMBER_COUNT * 3, '成员星系位置数组长度不符');
ok(TWO_MRS_MEMBER_GROUP.length === TWO_MRS_MEMBER_COUNT, '成员星系群索引数组长度不符');
ok(TWO_MRS_MEMBER_V.length === TWO_MRS_MEMBER_COUNT, '成员星系视向速度数组长度不符');
ok(TWO_MRS_MEMBER_IDS.length === TWO_MRS_MEMBER_COUNT, '成员星系 2MASS ID 数组长度不符');
let badMember = 0, badGroupRef = 0;
for (let i = 0; i < TWO_MRS_MEMBER_COUNT; i++) {
  const j = i * 3;
  if (![TWO_MRS_MEMBER_POS[j], TWO_MRS_MEMBER_POS[j + 1], TWO_MRS_MEMBER_POS[j + 2]]
    .every(Number.isFinite)) badMember++;
  if (!(TWO_MRS_MEMBER_GROUP[i] < TWO_MRS_COUNT)) badGroupRef++;
  if (!TWO_MRS_MEMBER_IDS[i]) badMember++;
}
ok(badMember === 0, `${badMember} 个成员星系坐标 / ID 非法`);
ok(badGroupRef === 0, `${badGroupRef} 个成员星系引用了不存在的群`);

// ---- 2. 每个上层结构页都能筛出真实成员（含主链！） ----
// 与 systems/cosmos.js 的 realMembersFor() 保持同一套筛选逻辑。
// 旧版只检查叶子页，结果主链 laniakea / virgo 被 `kids.length ? [] : ...`
// 一刀切排除，页面空荡荡却没人发现。这里把主链也纳入强制校验。
const REAL_MEMBER_LIMIT = 18;
const upperNodes = NODES.filter((n) =>
  ['supercluster', 'cluster', 'group'].includes(n.kind)
  && n.kind !== 'universe'
  && n.id !== 'localgroup'); // 本星系群页已有 galaxies.js 的 ~90 个真实星系
const mainChain = ['laniakea', 'virgo'];
ok(mainChain.every((id) => upperNodes.some((n) => n.id === id)), '主链上层节点未纳入校验');

let covered = 0;
let beyondSurvey = 0;
const report = [];
for (const n of upperNodes) {
  const c = cosmicVec(n.id);
  ok(c != null, `${n.id} 缺少真实坐标，无法筛选 2MRS 成员`);
  if (!c) continue;
  // 2MRS 巡天只到 z≈0.07（~283 Mpc）；超出范围的结构不该硬凑成员。
  if (Math.hypot(...c) > 400000) { beyondSurvey++; report.push(`${n.id}: 超出 2MRS 巡天范围`); continue; }
  const radius = Math.max(n.spanLy / COSMIC_LY_PER_KPC, 12000);
  let count = 0;
  for (const g of TWO_MRS_GROUPS) {
    const d = Math.hypot(g.pos[0] - c[0], g.pos[1] - c[1], g.pos[2] - c[2]);
    if (d > 1e-6 && d <= radius) count++;
  }
  report.push(`${n.id}: ${count}`);
  ok(count >= 3, `${n.id} 上层页邻域内只有 ${count} 个 2MRS 群，会退回空白页`);
  if (count >= 3) covered++;
}
ok(covered >= 17, `只有 ${covered} 个上层页有真实成员，疑似数据链路失效`);

// ---- 3. 源码接线 ----
const cosmosSrc = readFileSync(resolve(root, 'src/systems/cosmos.js'), 'utf8');
const mainSrc = readFileSync(resolve(root, 'src/main.js'), 'utf8');
ok(cosmosSrc.includes("from '../data/2mrs.js'"), 'cosmos.js 未导入 2MRS 数据层');
ok(cosmosSrc.includes('realMembersFor(node'), 'cosmos.js 未调用真实成员筛选');
ok(!/const\s+realMembers\s*=\s*kids\.length\s*\?/.test(cosmosSrc),
  'cosmos.js 又把主链上层页排除在真实成员之外了');
ok(cosmosSrc.includes('realMembersFor(node, kids.length > 0)'),
  'cosmos.js 未把所有上层页（含主链）交给真实成员筛选');
ok(cosmosSrc.includes("group: '真实成员'"), 'cosmos.js 缺少「真实成员」分组');
ok(cosmosSrc.includes('TWO_MRS_GROUPS'), 'cosmos.js 未遍历 2MRS 群表');
ok(cosmosSrc.includes('twoMrs: twoMrsCloud'), 'cosmos.js 未把全量成员星系点云配置传给渲染层');
ok(mainSrc.includes('TWO_MRS_MEMBER_POS'), 'main.js 未渲染 Table 3 全量成员星系');
ok(mainSrc.includes('TWO_MRS_MEMBER_GROUP'),
  'main.js 未按「本页选中的群」筛选成员，会退回把最近 N 个群围成球壳的点球');
ok(cosmosSrc.includes('groupIdx: picked.map'), 'cosmos.js 未把选中的群索引传给点云');
ok(mainSrc.includes('e.def?.distanceText != null'),
  'main.js 菜单仍只看 dLy>0，焦点节点（拉尼亚凯亚等）会没有光年数字');

// ---- 汇总 ----
if (errors.length) {
  console.error(`2MRS 真实成员校验失败（${errors.length} 项）：`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`2MRS 真实成员校验通过：${TWO_MRS_COUNT} 个星系群 / ${TWO_MRS_MEMBER_COUNT} 个成员星系（全量落库），`);
console.log(`  ${covered} 个上层页可填充真实成员（含主链 laniakea / virgo，每页最多 ${REAL_MEMBER_LIMIT} 个），${beyondSurvey} 个超出巡天范围。`);
console.log('  逐页候选数：' + report.join('、'));
