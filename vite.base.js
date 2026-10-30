import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * 各系统入口：key = 构建键名，value = src/ 下的 html 文件名
 * 所有入口产物都落在 dist/ 根目录，因此 base:'./' 对每页都成立，
 * 且共享 dist/assets/（three.js 等公共块跨页只下载一次）。
 */
export const ENTRIES = {
  home: 'index.html',
  overview: 'overview.html',
  earthMoon: 'earth-moon.html',
  mars: 'mars.html',
  jupiter: 'jupiter.html',
  saturn: 'saturn.html',
  uranus: 'uranus.html',
  neptune: 'neptune.html',
  pluto: 'pluto.html',
};

/**
 * @param {string} [only] 只构建指定系统；不传则全量构建
 */
export function makeConfig(only) {
  const input = {};
  for (const [key, file] of Object.entries(ENTRIES)) {
    if (only && key !== only) continue;
    input[key] = resolve(here, 'src', file);
  }

  return {
    root: resolve(here, 'src'),
    publicDir: resolve(here, 'static'),
    base: './',
    server: { host: true },
    build: {
      outDir: resolve(here, 'dist'),
      // 单系统构建时不清空 dist，避免覆盖掉其他系统 / 太阳系的产物
      emptyOutDir: !only,
      // 关闭 sourcemap：产物面向公众访问，map 文件纯属冗余（实测省 2.6MB）
      sourcemap: false,
      rollupOptions: { input },
    },
  };
}
