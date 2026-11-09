/**
 * 跟随镜头自检：共转数学的数值断言 + 源码契约断言。
 * 运行：npm run check:follow
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  orbitAngle, angleDelta, rotateY, coRotate, MAX_CO_ROTATE_STEP,
} from '../src/follow.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, '..', p), 'utf8');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

// ---------- 1) 角度差跨 ±π 归一化 ----------
near(angleDelta(0.1, -0.1), 0.2);
near(angleDelta(-0.1, 0.1), -0.2);
near(angleDelta(0.1, Math.PI * 2 - 0.1), 0.2, 1e-12);
near(angleDelta(Math.PI * 2 - 0.1, 0.1), -0.2, 1e-12);
near(angleDelta(1, 1 + Math.PI * 4), 0, 1e-12);

// ---------- 2) 共转：地球从 (1,0,0) 转到 (0,0,1)（+90°）----------
// 原本位于轨道外侧的相机偏移 (1,0,0) 应跟到 (0,0,1)，仍在同一个受光侧。
const a0 = orbitAngle({ x: 1, z: 0 });
const a1 = orbitAngle({ x: 0, z: 1 });
near(a0, 0);
near(a1, Math.PI / 2);
const r = coRotate({ x: 1, y: 0.4, z: 0 }, a0, a1, Math.PI);
near(r.x, 0);
near(r.y, 0.4);
near(r.z, 1);

// 长度不变 + 逆行轨道也成立
const r2 = coRotate({ x: 3, y: 0, z: 4 }, a1, a0, Math.PI);
near(Math.hypot(r2.x, r2.z), 5);
near(r2.x, 4, 1e-12);
near(r2.z, -3, 1e-12);

// 单帧突变（切档瞬移 / NaN）不允许把镜头甩飞
const jump = coRotate({ x: 2, y: 0, z: 0 }, 0, MAX_CO_ROTATE_STEP + 0.5);
near(jump.x, 2);
near(jump.z, 0);
const nan = coRotate({ x: 2, y: 0, z: 0 }, 0, NaN);
near(nan.x, 2);
near(nan.z, 0);

// rotateY 方向校验：rotateY(-π/2) 使方位角 +π/2
const ry = rotateY({ x: 1, y: 0, z: 0 }, -Math.PI / 2);
near(orbitAngle(ry), Math.PI / 2, 1e-12);

// ---------- 3) 源码契约：聚焦不再冻结全场，所有入口都接上跟随 ----------
const main = read('src/main.js');
for (const needle of [
  "from './follow.js'", 'function beginFollow(', 'function updateFollow(',
  'function stopFollow(', 'function refreshPause(', 'updateFollow(dtSec);',
  'Math.exp(-', 'settings.followMotion', 'coRotate(', 'orbitAngle(',
  'beginFollow(def, object', 'beginFollow(def, obj', 'stopFollow();',
  'window.__astro',
]) {
  assert.ok(main.includes(needle), `main.js 缺少：${needle}`);
}
assert.ok(!/paused\s*=\s*true\b/.test(main), 'main.js 仍有「聚焦即冻结」的残留');
assert.ok(!/targetCameraPosition/.test(main), '旧的固定落点相机飞行未清理干净');
const focusOnBody = main.slice(
  main.indexOf('function focusOn('),
  main.indexOf("window.addEventListener('mousemove'"),
);
assert.ok(focusOnBody.includes('beginFollow('), 'focusOn 未启动跟随');
assert.ok(!focusOnBody.includes('paused'), 'focusOn 仍在冻结时间');
assert.ok(main.includes('currentTier === 0 || follow'), '银河系小档在跟随中仍冻结银盘自转');
// 用户拖拽 / 缩放的判定阈值必须随取景尺度收缩：固定 0.01 会让银河系最小档
// （整段相机偏移 ~4e-4）的每一次缩放都被判成「没动」，镜头每帧弹回，
// 恒星近景球也就永远等不到放大的那一刻。
const epsLine = main.match(/const eps = (.+);\s*\n\s*const userMoved/);
assert.ok(epsLine, '跟随里找不到用户操作判定阈值');
assert.ok(/Math\.min\(0\.01,\s*before\.length\(\)/.test(epsLine[1]),
  '用户操作阈值必须按 before.length() 收缩，不能用固定 0.01 兜底');
assert.ok(!/Math\.max\(0\.01,\s*before\.length\(\)/.test(epsLine[1]),
  'Math.max(0.01, …) 会在银河系小档吞掉所有用户缩放');

// ---------- 4) 双语 / 样式 / 脚本 / 文档一致 ----------
const i18n = read('src/i18n.js');
for (const key of ['followMotion:', 'following:', 'followingNote:']) {
  const n = (i18n.match(new RegExp(key, 'g')) ?? []).length;
  assert.equal(n, 2, `${key} 需要中英各一份，实际 ${n} 份`);
}
assert.ok(read('src/style.css').includes('#followBadge'), '缺少跟随状态徽标样式');
assert.ok(read('package.json').includes('check:follow'), 'package.json 未登记 check:follow');
assert.ok(!read('readme.md').includes('冻结公转'), 'readme 仍在描述冻结公转');
assert.ok(!read('docs/DEVELOPMENT.md').includes('暂停时间便于观察'), '开发文档仍在描述冻结时间');

console.log('跟随镜头校验通过：共转数学、聚焦不再冻结、全入口接入、双语与文档一致。');
