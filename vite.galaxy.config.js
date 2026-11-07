import { makeConfig } from './vite.base.js';

// 单独构建银河系：只重建 dist/galaxy.html 及其所需资源，不影响其他页
export default makeConfig('galaxy');
