import { makeConfig } from './vite.base.js';

// 单独构建太阳系总览：只重建 dist/overview.html 及其所需资源，不影响其他页
export default makeConfig('overview');
