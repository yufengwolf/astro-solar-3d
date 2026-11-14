/** 一次性验证：真实 Chrome + CDP，逐页检查深度星表点云、菜单来源与 JS 异常。 */
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:8123';
const CDP = 'http://127.0.0.1:9222';
const PAGES = [
  ['universe', 'cosmos.html?node=universe&debug=1'],
  ['laniakea', 'cosmos.html?node=laniakea&debug=1'],
  ['virgo', 'cosmos.html?node=virgo&debug=1'],
  ['localgroup', 'cosmos.html?node=localgroup&debug=1'],
  ['perseuspisces', 'cosmos.html?node=perseuspisces&debug=1'],
  ['hcbg', 'cosmos.html?node=hcbg&debug=1'],
  ['galaxy', 'galaxy.html?debug=1'],
];
mkdirSync('.tmp', { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newTab(url) {
  const r = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return r.json();
}
async function closeTab(id) { try { await fetch(`${CDP}/json/close/${id}`); } catch {} }

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    const errors = [];
    let seq = 0;
    ws.addEventListener('open', () => resolve(api));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails?.text
          + ' ' + (msg.params.exceptionDetails?.exception?.description ?? ''));
      } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        errors.push(msg.params.entry.text);
      }
    });
    const send = (method, params = {}) => new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const api = { send, errors, close: () => ws.close() };
  });
}

for (const [name, path] of PAGES) {
  const tab = await newTab(`${BASE}/${path}`);
  let c;
  try {
    c = await connect(tab.webSocketDebuggerUrl);
    await c.send('Runtime.enable');
    await c.send('Log.enable');
    await c.send('Page.enable');
    await sleep(7000);
    const evalRes = await c.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        state: window.__astro?.state ? {
          selected: window.__astro.state.selected,
          deepClouds: window.__astro.state.deepClouds,
          twoMrsPoints: window.__astro.state.twoMrsPoints,
          catalogClouds: window.__astro.state.catalogClouds,
          tierIndex: window.__astro.state.tierIndex,
        } : null,
        captions: [...document.querySelectorAll('.bn-caption')].map(e => e.textContent),
        groups: [...document.querySelectorAll('.bn-group')].map(e => e.textContent),
        names: [...document.querySelectorAll('.bn-name')].map(e => e.textContent),
        dists: [...document.querySelectorAll('.bn-dist')].map(e => e.textContent),
      })`,
      returnByValue: true,
    });
    const data = JSON.parse(evalRes.result.value ?? '{}');
    const counts = (data.state?.deepClouds ?? []).map((d) => `${d.name}:${d.count}`).join(',');
    console.log(`=== ${name} ===`);
    console.log(`  deepClouds: ${counts || '(none)'}`);
    console.log(`  2MRS points: ${data.state?.twoMrsPoints ?? 0}`);
    console.log(`  catalogClouds: ${JSON.stringify(data.state?.catalogClouds ?? [])}`);
    console.log(`  真实成员分组: ${data.groups.filter((g) => /成员|Catalog/.test(g)).length}`);
    console.log(`  数据来源: ${data.captions.filter((c) => /数据来源|Catalogs/.test(c)).join(' | ') || '(none)'}`);
    console.log(`  距离标注: ${data.dists.slice(0, 6).join(' / ') || '(none)'}`);
    console.log(`  GRB 成员: ${data.names.filter((n) => /GRB|伽马/.test(n)).length}`);
    console.log(`  JS 异常: ${c.errors.length ? c.errors.slice(0, 3).join(' | ') : '0'}`);
    const shot = await c.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`.tmp/deep-${name}.png`, Buffer.from(shot.data, 'base64'));
  } catch (e) {
    console.log(`=== ${name} === ERROR ${e.message}`);
  } finally {
    c?.close();
    await closeTab(tab.id);
  }
}
