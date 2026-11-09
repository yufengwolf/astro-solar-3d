/**
 * 万能外链入口 —— 三种粒度都只记一个 ID：
 *   go.html?body=<ID>   天体直达，落到该天体所在页面并聚焦
 *   go.html?node=<ID>   宇宙层级节点（银河系 / 本星系群 / 仙女座…）
 *   go.html?page=<key>  3D 页面本身（solar / galaxy / jupiter…）
 * 只加载注册表，不加载 Three.js，因此跳转几乎没有额外开销。
 */
import { bodyHref, carryParams, allPages } from '../deeplinks.js';
import { byId, href } from '../universe.js';

const p = new URLSearchParams(location.search);
const raw = p.get('body') || p.get('focus') || location.hash.slice(1);
const extra = carryParams(['body', 'focus', 'node', 'page']);

const target = bodyHref(raw, extra);
const node = p.get('node') ? byId(p.get('node')) : null;
const pageKey = p.get('page');
const page = pageKey ? allPages().find((x) => x.key === pageKey || x.file === pageKey) : null;

const dest = target ?? (node ? href(node) : null) ?? page?.url ?? null;

// lang / embed / scale / debug 等参数原样透传到落地页
if (dest) {
  const u = new URL(dest, location.href);
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
  location.replace(u.pathname.split('/').pop() + u.search + u.hash);
} else {
  const wrap = document.getElementById('goWrap');
  wrap.innerHTML = `
    <h1>没有找到这个目标</h1>
    <p>标识 <code></code> 不在直达清单里。</p>
    <p>天体用 <code>go.html?body=earth</code>，跨页同名写成 <code>页面:ID</code>（如 <code>jupiter:jupiter</code>）；
       层级节点用 <code>go.html?node=milkyway</code>；整页用 <code>go.html?page=galaxy</code>。</p>
    <a href="./links.html">打开外链直达清单</a>`;
  wrap.querySelector('code').textContent = String(raw || p.get('node') || pageKey || '（空）');
  document.title = '没有找到这个目标';
}
