/**
 * 万能外链入口：go.html?body=<ID> → 自动落到该天体所在页面并聚焦。
 * 只加载注册表，不加载 Three.js，因此跳转几乎没有额外开销。
 */
import { resolveBody, bodyHref, carryParams } from '../deeplinks.js';

const p = new URLSearchParams(location.search);
const raw = p.get('body') || p.get('focus') || location.hash.slice(1);
const extra = carryParams(['body', 'focus']);
const target = bodyHref(raw, extra);

if (target) {
  location.replace(target);
} else {
  const wrap = document.getElementById('goWrap');
  wrap.innerHTML = `
    <h1>没有找到这个天体</h1>
    <p>标识 <code></code> 不在直达清单里。</p>
    <p>跨页同名请写成 <code>页面:ID</code>，例如 <code>jupiter:jupiter</code>；
       也可以在清单里直接按中文名或 ID 搜索。</p>
    <a href="./links.html">打开天体直达外链清单</a>`;
  wrap.querySelector('code').textContent = String(raw || '（空）');
  document.title = '没有找到这个天体';
}
