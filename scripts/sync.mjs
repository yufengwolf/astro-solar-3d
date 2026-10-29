#!/usr/bin/env node
/**
 * 把构建产物拷到某个本地静态站目录（可选能力）。
 * 主部署路径是 Cloudflare Pages（push 即自动构建），本脚本只在需要本地拷贝时才用。
 *
 * 用法：
 *   npm run sync                              只同步（用现有 dist/）
 *   npm run sync -- --build                   先全量构建，再同步
 *   npm run sync -- --build --system=jupiter   只构建木星系统，再同步（不清空目标，其他系统不受影响）
 *   npm run sync -- <目标目录>                 指定同步目标
 *
 * 目标目录默认读 sync.config.json 的 dest 字段。
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, readFileSync, cpSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const positional = args.filter((a) => !a.startsWith('--'));

const doBuild = flags.includes('--build');
const systemArg = flags.find((a) => a.startsWith('--system='))?.split('=')[1];

function resolveDest() {
  if (positional.length) return resolve(process.cwd(), positional[0]);
  const cfgPath = resolve(root, 'sync.config.json');
  if (existsSync(cfgPath)) {
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8'));
    if (cfg.dest) return resolve(root, cfg.dest);
  }
  return null;
}

const dest = resolveDest();
if (!dest) {
  console.error('[sync] 未指定目标目录。请写 sync.config.json 的 dest，或直接传路径：npm run sync -- <目录>');
  process.exit(1);
}

// 1) 构建
if (doBuild) {
  const cmd = systemArg
    ? `npm run build:${systemArg.replace(/([A-Z])/g, '-$1').toLowerCase()}`
    : 'npm run build';
  console.log(`[sync] 构建: ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

if (!existsSync(dist)) {
  console.error('[sync] dist/ 不存在，请先构建。');
  process.exit(1);
}

// 2) 同步：单系统构建时做增量覆盖（不清空）；全量构建时整体替换
const incremental = Boolean(systemArg);
if (!incremental) {
  console.log(`[sync] 清空并同步 -> ${dest}`);
  rmSync(dest, { recursive: true, force: true });
}
mkdirSync(dest, { recursive: true });
for (const entry of readdirSync(dist)) {
  cpSync(resolve(dist, entry), resolve(dest, entry), { recursive: true });
}

console.log(`[sync] 已同步：${readdirSync(dist).join(', ')}`);
console.log(`[sync] 目标目录：${dest}`);
