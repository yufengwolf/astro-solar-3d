import { makeConfig } from './vite.base.js';

// 单独构建导航主页：只重建 dist/index.html（纯 HTML/CSS，无 Three.js 依赖）
export default makeConfig('home');
