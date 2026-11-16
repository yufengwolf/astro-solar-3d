/**
 * 万能外链入口 —— 四种粒度都只记 ID：
 *   go.html?body=<ID>                    天体直达，落到该天体所在页面并聚焦
 *   go.html?node=<ID>                    宇宙层级节点（银河系 / 本星系群…）
 *   go.html?node=<ID>&body=<成员ID>      指定层级页 + 动态成员（2MRS / GRB / 矮星系）
 *   go.html?page=<key>                   3D 页面本身（solar / galaxy / jupiter…）
 * 只加载注册表，不加载 Three.js，因此跳转几乎没有额外开销。动态成员的裸 ID
 * 按需 fetch links.json 反查规范节点（仅在 go.html 上发生一次）。
 */
import { bodyHref, carryParams, allPages } from '../deeplinks.js';
import { byId, href } from '../universe.js';

const p = new URLSearchParams(location.search);
const rawBody = p.get('body') || p.get('focus') || location.hash.slice(1) || '';
const rawNode = p.get('node');
const pageKey = p.get('page');
const extra = carryParams(['body', 'focus', 'node', 'page']);

function cleanId(s) {
  let v = String(s ?? '').replace(/^#/, '');
  try { v = decodeURIComponent(v); } catch { /* 非法转义按原样处理 */ }
  return v;
}
const id = cleanId(rawBody);

const target = bodyHref(id, extra);
const node = rawNode ? byId(cleanId(rawNode)) : null;
const page = pageKey ? allPages().find((x) => x.key === pageKey || x.file === pageKey) : null;

/** 把 extra 参数透传到落地页（lang / embed / scale / debug…） */
function toDest(rel) {
  const u = new URL(rel, location.href);
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
  return u.pathname.split('/').pop() + u.search + u.hash;
}

/**
 * 裸 ID 的动态成员：lg- 前缀可以直接推出层级，其余查公开清单。
 * 查表失败只影响 go.html 的「极简链接」形式；清单给出的 node+body
 * 组合链接不依赖任何网络请求。
 */
async function memberDest(memberId) {
  if (!memberId) return null;
  if (memberId.startsWith('lg-')) {
    return `cosmos.html?node=localgroup&body=${encodeURIComponent(memberId)}`;
  }
  if (!/^(2mrs|grb)-/.test(memberId)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(new URL('./links.json', location.href), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const m = (data.members ?? []).find((x) => x.id === memberId);
    return m?.url ?? null;
  } catch {
    return null;
  }
}

async function main() {
  let dest = target ?? (node ? href(node) : null) ?? page?.url ?? null;

  // node+body 组合：body 不是常规天体时，直接落到指定层级页并让页面聚焦该成员。
  // 这是动态成员的规范写法，不需要查表，也不会与同名节点混淆。
  if (!target && node && id) {
    dest = `cosmos.html?node=${encodeURIComponent(node.id)}&body=${encodeURIComponent(id)}`;
  }
  if (!dest) dest = await memberDest(id);

  if (dest) {
    location.replace(toDest(dest));
    return;
  }

  const wrap = document.getElementById('goWrap');
  wrap.innerHTML = `
    <h1>没有找到这个目标</h1>
    <p>标识 <code></code> 不在直达清单里。</p>
    <p>天体用 <code>go.html?body=earth</code>，跨页同名写成 <code>页面:ID</code>（如 <code>jupiter:jupiter</code>）；
       层级节点用 <code>go.html?node=milkyway</code>；整页用 <code>go.html?page=galaxy</code>。
       星表成员用 <code>go.html?node=laniakea&amp;body=2mrs-1519</code>。</p>
    <a href="./links.html">打开外链直达清单</a>`;
  wrap.querySelector('code').textContent = String(id || rawNode || pageKey || '（空）');
  document.title = '没有找到这个目标';
}

main();
