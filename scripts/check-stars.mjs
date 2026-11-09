/**
 * 恒星近景 LOD 自检。
 *
 * 两部分：
 *  1) 真实执行 src/star-portrait.js（Node 里用最小 canvas 桩），验证程序化贴图、
 *     球体 / 色球 / 日冕结构，以及「远景是点、贴近才显形」的距离数学；
 *  2) 静态断言 main.js / galaxy.js：所有普通恒星都挂了 radiusSun、疏散星团与
 *     黑洞走各自展示物、近景更新挂在 animate 里、外链直达会推进到特写距离。
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const SRC = resolve(ROOT, 'src');
const TMP = resolve(SRC, '.check-stars-tmp');

// ---- 最小 canvas 桩：让程序化贴图在 Node 里也能真实跑一遍 ----
globalThis.document = {
  createElement: (tag) => {
    if (tag !== 'canvas') return { style: {} };
    return {
      width: 0, height: 0,
      getContext: () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        putImageData: () => {},
        createRadialGradient: () => ({ addColorStop() {} }),
        fillRect: () => {},
        fillStyle: null,
      }),
    };
  },
};

const {
  starSizeFactor, portraitRadius, portraitOpacity, tierFactorOf, createStarPortrait,
} = await import('../src/star-portrait.js');

// ---- 距离驱动的 LOD 数学 ----
assert.equal(portraitOpacity(1, 1), 0, '档位取景距离处必须是纯点，不能出现球体');
assert.equal(portraitOpacity(2, 1), 0, '比取景距离更远时必须隐藏');
assert.ok(portraitOpacity(0.45, 1) > 0.9, '缩到 0.45× 取景距离时球体应完全显形');
assert.ok(portraitOpacity(0.7, 1) > 0 && portraitOpacity(0.7, 1) < 0.9, '中间距离应处于淡入过程');
assert.equal(portraitOpacity(0.1, 0), 0, '非法档位距离不能产生 NaN');
assert.ok(starSizeFactor(764) > starSizeFactor(1) * 2, '红超巨星应明显大于太阳');
assert.ok(starSizeFactor(0.154) < starSizeFactor(1), '红矮星应小于太阳');
assert.ok(starSizeFactor(1e6) <= 3, '半径系数必须封顶，防止撑爆画面');
assert.ok(Math.abs(tierFactorOf(5) - 1e-4) < 1e-12, '档位系数必须与 applyTierScale 一致');

const baseR = portraitRadius(0.07, 1, 1, 10);
assert.ok(baseR > 0 && Number.isFinite(baseR), '近景球半径必须是有限正数');
assert.ok(portraitRadius(0.07, 1, 764, 10) > baseR, '超巨星的球应更大');
assert.ok(portraitRadius(0.07, 1e-4, 1, 10) < baseR, '档位越细，同一颗球的场景半径应越小');
assert.ok(portraitRadius(0.07, 1, 1, 0.01) <= 0.01 * 0.42,
  '相机贴到球边时必须按距离封顶，不能让镜头钻进球内');

// ---- 真实构建一颗恒星特写 ----
const p = createStarPortrait({ id: 'proxima', color: 0xff8a6a, radiusSun: 0.154, size: 0.07 });
assert.equal(p.group.visible, false, '近景球默认必须隐藏');
assert.equal(p.group.children.length, 3, '应包含光球 + 色球亮环 + 日冕');
assert.ok(p.sphere.isMesh && p.sphere.geometry.type === 'SphereGeometry', '光球必须是球体');
assert.ok(p.sphere.material.map, '光球必须有程序化米粒组织贴图');
assert.equal(p.sphere.material.toneMapped, false, '恒星自发光不应被曝光压暗');
assert.equal(p.sphere.userData.bodyId, 'proxima', '光球要带 bodyId 便于调试');
p.group.scale.setScalar(0.5);
assert.ok(Number.isFinite(p.group.scale.x));

// ---- 生产配置：恒星 / 星团 / 黑洞的分类必须自洽 ----
function toNodeModule(code) {
  return code
    .replace(/^import\s+\w+\s+from\s+'\/?images\/[^']+';\s*$/gm, (m) =>
      `const ${m.match(/import\s+(\w+)/)[1]} = '${m.match(/images\/[^']+/)[0]}';`)
    .replace(/^import\s+\{\s*starfield\s*\}\s+from\s+'\.\/shared\.js';\s*$/gm,
      "const starfield = ['1','2','3','4','5','6'];");
}
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
for (const f of readdirSync(resolve(SRC, 'systems'))) {
  if (f.endsWith('.js') && f !== 'shared.js' && f !== 'cosmos.js') {
    writeFileSync(resolve(TMP, f), toNodeModule(readFileSync(resolve(SRC, 'systems', f), 'utf8')));
  }
}
const galaxy = (await import(pathToFileURL(resolve(TMP, 'galaxy.js')).href)).default;
rmSync(TMP, { recursive: true, force: true });

// 与 main.js 的挂球条件必须完全一致：star && !deepSky && radiusSun 是数字
const main = readFileSync(resolve(SRC, 'main.js'), 'utf8');
assert.ok(main.includes('def.star && !def.deepSky && Number.isFinite(def.radiusSun)'),
  'main.js 必须只给带真实半径的恒星挂近景球，否则 cosmos 页的星系锚点会被画成恒星');
const stars = galaxy.bodies.filter((b) => b.star && !b.deepSky);
const showpieces = galaxy.bodies.filter((b) => b.deepSky);
// 22 个邻近条目里 4 个是疏散星团，剩下 18 颗恒星 + 银河系页的太阳 = 19 颗
assert.ok(stars.length >= 19, `恒星近景球覆盖不足：只有 ${stars.length} 颗`);
for (const b of stars) {
  assert.ok(Number.isFinite(b.radiusSun) && b.radiusSun > 0,
    `恒星 ${b.id} 缺少真实半径 radiusSun，近景球无法按真实比例缩放`);
  assert.equal(b.fixedSize, 0.07, `恒星 ${b.id} 在银河系尺度上仍必须是一个 0.07 的点`);
}
for (const b of showpieces) {
  assert.ok(['nebula', 'remnant', 'blackhole', 'cluster'].includes(b.deepSky.kind),
    `${b.id} 的展示物类型未知: ${b.deepSky.kind}`);
}
assert.ok(showpieces.some((b) => b.deepSky.kind === 'cluster'), '疏散星团应有点云星团展示物');
assert.ok(showpieces.some((b) => b.id === 'sagA' && b.deepSky.kind === 'blackhole'),
  '人马座 A* 放大后应是黑洞而非恒星球体');
assert.equal(stars.find((b) => b.id === 'sun')?.radiusSun, 1, '太阳必须是近景球的大小基准');

// ---- main.js 接线 ----
for (const needle of [
  "from './star-portrait.js'", 'createStarPortrait(def)', 'updateStarPortraits(dtSec)',
  'setStarCloseup(def, obj)', 'portraitOpacity(d, base)', 'portraitRadius(',
  'closeups: [...starPortraits.entries()]',
]) {
  assert.ok(main.includes(needle), `main.js 缺少恒星近景接线: ${needle}`);
}
assert.ok(!/p\.sphere\.material\.opacity\s*=\s*NaN/.test(main), '不能出现 NaN 透明度');
// 近景更新必须排在 controls.update() 之后（相机位姿定下来才判距离）
const updateAt = main.indexOf('controls.update();');
const portraitAt = main.indexOf('updateStarPortraits(dtSec);', updateAt + 1);
assert.ok(updateAt > 0 && portraitAt > updateAt && portraitAt - updateAt < 120,
  '近景 LOD 必须紧跟在 controls.update() 之后执行');

console.log(`恒星近景 LOD 校验通过：${stars.length} 颗恒星球 / ${showpieces.length} 个非恒星展示物，`
  + '远景为点、贴近显形，外链直达落到特写距离。');
