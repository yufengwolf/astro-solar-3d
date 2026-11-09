/**
 * 天体级直达外链的运行时注册表。
 *
 * 数据由 scripts/gen-deeplinks.mjs 从真实 system 配置生成，新增天体无需改这里。
 * 对外契约：
 *   solar.html?body=earth              规范链接（页面路径 + 天体 ID）
 *   jupiter.html?body=europa
 *   go.html?body=earth                 万能入口，只记 ID 自动落到正确页面
 *   #earth                            hash 别名，可在不刷新的情况下切换天体
 * 跨页同名（jupiter / sun / earth ...）裸 ID 归太阳系总览，
 * 其余页面用 `页面:ID`（如 jupiter:jupiter）消歧。
 */
import DATA from './data/deeplinks.js';

const BY_KEY = new Map();
const BY_SHORT = new Map();
const BY_NAME = new Map();
for (const b of DATA.bodies) {
  BY_KEY.set(b.key, b);
  if (b.short) BY_SHORT.set(b.short, b);
  if (!BY_NAME.has(b.name)) BY_NAME.set(b.name, []);
  BY_NAME.get(b.name).push(b);
}

export const allBodies = () => DATA.bodies.slice();
export const allPages = () => DATA.pages.slice();

function normalize(spec) {
  let s = String(spec ?? '').trim().replace(/^#/, '');
  if (!s) return '';
  try { s = decodeURIComponent(s); } catch { /* 非法转义按原样处理 */ }
  return s;
}

/** 解析任意写法的天体标识，返回注册项或 null */
export function resolveBody(spec) {
  const s = normalize(spec);
  if (!s) return null;
  if (s.includes(':')) return BY_KEY.get(s) ?? BY_KEY.get(s.toLowerCase()) ?? null;
  const hit = BY_SHORT.get(s) ?? BY_SHORT.get(s.toLowerCase());
  if (hit) return hit;
  const names = BY_NAME.get(s);
  if (names?.length) return names.find((b) => b.page === 'solar.html') ?? names[0];
  return null;
}

/** 生成规范深链；extra 可带 lang / embed / view / scale，embed=true 转成 1 */
export function bodyHref(spec, extra = {}) {
  const b = resolveBody(spec);
  if (!b) return null;
  const p = new URLSearchParams();
  p.set('body', b.short ?? b.key);
  for (const [k, v] of Object.entries(extra)) {
    if (v == null || v === '' || v === false) continue;
    p.set(k, v === true ? '1' : String(v));
  }
  return `${b.page}?${p.toString()}`;
}

/** 收集当前 URL 上需要透传的参数（go.html / 跨页纠正用） */
export function carryParams(drop = [], search = location.search) {
  const p = new URLSearchParams(search);
  for (const k of drop) p.delete(k);
  const out = {};
  for (const [k, v] of p) out[k] = v;
  return out;
}

/** 当前页面文件名；CF Pages 的 /solar 这类无扩展名地址会补成 solar.html */
export function currentPageFile() {
  let f = location.pathname.split('/').pop() || 'index.html';
  if (!f.includes('.')) f += '.html';
  return f;
}
