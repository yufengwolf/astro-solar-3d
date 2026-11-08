/**
 * 全站统一的「宇宙层级导航」。
 *
 * 三件套：
 *  1. 顶部面包屑 —— 一眼看清「宇宙 › … › 银河系 › 太阳系」，点任一级直达；
 *  2. 上一级 / 下一级 / 宇宙地图按钮 —— 上浮、下钻、跨层级跳转都只需一次点击；
 *  3. 宇宙地图抽屉 —— 注册表整棵树铺开，未来新增星系自动出现在里面。
 *
 * 组件本身完全由 universe.js 驱动，不认识任何具体页面；
 * 首页与所有 3D 页面都挂载同一个组件，因此不存在「某页能上去、某页上不去」。
 */
import { t, isEn } from './i18n.js';
import {
  ROOT_ID, byId, label, href, levelName, detailName, resolveCurrentId,
  chainOf, childrenOf, parentOf, focusChildOf, tree, isEnglish,
} from './universe.js';

const homeHref = () => (isEnglish() ? 'index.html?lang=en' : 'index.html');

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function button(text, title) {
  const b = el('button', 'un-btn', text);
  b.type = 'button';
  if (title) b.title = title;
  return b;
}

/** 下一级有多个候选时的小下拉 */
function childDropdown(children, anchor, onPick) {
  const box = el('div', 'un-dropdown');
  for (const c of children) {
    const row = el('button', 'un-dd-item');
    row.type = 'button';
    row.append(
      el('span', 'un-dd-dot'),
      el('span', 'un-dd-name', label(c)),
      el('span', 'un-dd-meta', levelName(c.kind)),
    );
    row.style.setProperty('--dot', c.accent);
    row.onclick = (e) => { e.stopPropagation(); onPick(c); };
    box.appendChild(row);
  }
  let open = false;
  const toggle = (e) => {
    e.stopPropagation();
    open = !open;
    box.classList.toggle('open', open);
  };
  const close = () => { open = false; box.classList.remove('open'); };
  document.addEventListener('click', close);
  return { box, toggle, close, anchor };
}

/** 宇宙地图：注册表整棵树的只读视图 + 任意节点直达 */
function buildMap(currentId) {
  const overlay = el('div', 'universe-map');
  overlay.id = 'universeMap';
  const panel = el('div', 'um-panel');

  const head = el('div', 'um-head');
  const titles = el('div');
  titles.append(el('h2', 'um-title', t('mapTitle')), el('p', 'um-desc', t('mapDesc')));
  head.appendChild(titles);
  const close = button('×', t('navClose'));
  close.className = 'um-close';
  close.onclick = () => overlay.classList.remove('open');
  head.appendChild(close);
  panel.appendChild(head);

  const legend = el('div', 'um-legend');
  legend.append(
    el('span', 'um-lg', t('mapLegendFull')),
    el('span', 'um-lg', t('mapLegendGeneric')),
    el('span', 'um-lg', t('mapLegendPlanned')),
  );
  panel.appendChild(legend);

  const list = el('div', 'um-tree');
  const add = (entry, depth) => {
    const n = entry.node;
    const row = el('a', 'um-row' + (n.id === currentId ? ' here' : ''));
    row.href = href(n) ?? '#';
    row.style.setProperty('--depth', String(depth));
    row.style.setProperty('--accent', n.accent);
    const dot = el('span', 'um-dot');
    row.appendChild(dot);
    const main = el('span', 'um-main');
    main.append(el('span', 'um-name', label(n)));
    if (n.id === currentId) main.append(el('span', 'um-here', t('mapHere')));
    main.append(el('span', 'um-sub', `${levelName(n.kind)} · ${isEnglish() ? n.scaleEn : n.scaleZh}`));
    row.appendChild(main);
    row.append(
      el('span', 'um-kind', levelName(n.kind)),
      el('span', 'um-detail detail-' + n.detail, detailName(n.detail)),
    );
    list.appendChild(row);
    for (const c of entry.children ?? []) add(c, depth + 1);
  };
  for (const root of tree()) add(root, 0);
  panel.appendChild(list);

  const foot = el('div', 'um-foot', t('navHint'));
  panel.appendChild(foot);
  overlay.appendChild(panel);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove('open'); };
  return overlay;
}

/**
 * 挂载顶部导航条。
 * @param {{currentId?: string|null}} [opts] 不传则从当前 URL 反查
 */
export function mountUniverseNav(opts = {}) {
  if (document.getElementById('universeNav')) return;
  // 3D 页面由 main.js 传入 currentId；首页用 null 表示「星图入口」；
  // 其它情况（直接打开某页）按 URL 反查，保证导航条永远知道自己在哪。
  const file = location.pathname.split('/').pop() || 'index.html';
  const currentId = opts.currentId !== undefined
    ? opts.currentId
    : (file === 'index.html' ? null : resolveCurrentId());

  const bar = el('div', 'universe-nav');
  bar.id = 'universeNav';

  const crumbs = el('div', 'un-crumbs');
  crumbs.setAttribute('aria-label', t('navCurrent'));
  const home = el('a', 'un-crumb un-home', t('navHome'));
  home.href = homeHref();
  crumbs.appendChild(home);

  const chain = currentId ? chainOf(currentId) : [];
  chain.forEach((n, i) => {
    crumbs.appendChild(el('span', 'un-sep', '›'));
    const last = i === chain.length - 1;
    const c = el(last ? 'span' : 'a', 'un-crumb' + (last ? ' current' : ''), label(n));
    if (!last) c.href = href(n);
    if (last) c.title = t('navCurrent');
    crumbs.appendChild(c);
  });
  // 首页没有「当前层级」，补一个可点的根节点作为进入宇宙的入口
  if (!chain.length) {
    crumbs.appendChild(el('span', 'un-sep', '›'));
    const rootLink = el('a', 'un-crumb', label(byId(ROOT_ID)));
    rootLink.href = href(ROOT_ID);
    rootLink.title = t('navRoot');
    crumbs.appendChild(rootLink);
  }
  bar.appendChild(crumbs);

  const actions = el('div', 'un-actions');
  const up = parentOf(currentId);
  const kids = currentId ? childrenOf(currentId) : [byId(ROOT_ID)].filter(Boolean);
  const focusChild = currentId ? focusChildOf(currentId) : byId(ROOT_ID);

  const upBtn = button(`↑ ${t('navUp')}`, up ? label(up) : t('navAtRoot'));
  if (up) upBtn.onclick = () => { location.href = href(up); };
  else { upBtn.disabled = true; upBtn.classList.add('disabled'); }
  actions.appendChild(upBtn);

  const downBtn = button(`↓ ${t('navDown')}`, focusChild ? label(focusChild) : t('navNoChild'));
  let dd = null;
  if (kids.length > 1) {
    dd = childDropdown(kids, downBtn, (c) => { location.href = href(c); });
    downBtn.onclick = dd.toggle;
    actions.appendChild(downBtn);
    actions.appendChild(dd.box);
  } else if (kids.length === 1) {
    downBtn.onclick = () => { location.href = href(kids[0]); };
    actions.appendChild(downBtn);
  } else {
    downBtn.disabled = true;
    downBtn.classList.add('disabled');
    actions.appendChild(downBtn);
  }

  const mapBtn = button(`☰ ${t('navMap')}`, t('navMapTitle'));
  const overlay = buildMap(currentId);
  mapBtn.onclick = () => overlay.classList.add('open');
  actions.appendChild(mapBtn);
  bar.appendChild(actions);

  document.body.appendChild(bar);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      overlay.classList.remove('open');
      dd?.close();
    }
  });
}

/**
 * 首页的「层级路线图」：把从宇宙到太阳系的主链铺成可点的一排，
 * 让用户一进站就知道这套系统不是「太阳系 + 一个银河系彩蛋」，而是一条完整链路。
 */
export function mountLadder() {
  if (document.querySelector('.home-ladder')) return;
  const grid = document.querySelector('.home-grid');
  if (!grid) return;
  const chainIds = ['universe', 'laniakea', 'virgo', 'localgroup', 'milkyway', 'solar'];
  const section = el('section', 'home-ladder');
  section.append(
    el('h2', 'hl-title', t('ladderTitle')),
    el('p', 'hl-desc', t('ladderDesc')),
  );
  const rail = el('div', 'hl-rail');
  chainIds.forEach((id, i) => {
    const n = byId(id);
    if (!n) return;
    if (i) rail.appendChild(el('span', 'hl-arrow', '›'));
    const card = el('a', 'hl-step');
    card.href = href(n);
    card.style.setProperty('--accent', n.accent);
    card.append(
      el('span', 'hl-step-level', levelName(n.kind)),
      el('span', 'hl-step-name', label(n)),
      el('span', 'hl-step-scale', isEnglish() ? n.scaleEn : n.scaleZh),
    );
    rail.appendChild(card);
  });
  section.appendChild(rail);
  grid.parentNode.insertBefore(section, grid);
}
