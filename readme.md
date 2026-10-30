# 🪐 太阳系 3D 交互可视化

基于 Three.js 的太阳系实时可视化。轨道参数取自 NASA/JPL、PDS 真实数据，包含
**「太阳系总览 + 7 个行星子系统」共 8 个独立页面**，可一键部署为静态站点，也可 `iframe` 嵌入任意博客 / 文档站。

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-0.160-ff69b4.svg)](https://threejs.org/)
[![Live Demo](https://img.shields.io/badge/在线演示-astro--solar--3d.pages.dev-brightgreen?logo=cloudflare)](https://astro-solar-3d.pages.dev)

---

## 🌐 在线演示

**https://astro-solar-3d.pages.dev**

打开即进入导航主页，点击卡片即可进入对应系统。每个系统都是独立页面，可直接分享链接：

| 页面 | 地址 |
| --- | --- |
| 导航主页 | `https://astro-solar-3d.pages.dev/` |
| 太阳系总览 | `https://astro-solar-3d.pages.dev/overview` |
| 木星系统 | `https://astro-solar-3d.pages.dev/jupiter` |
| 土星系统 | `https://astro-solar-3d.pages.dev/saturn` |
| 地月系统 | `https://astro-solar-3d.pages.dev/earth-moon` |

---

## ✨ 预览

![导航主页](docs/screenshots/hub.png)

| 太阳系总览 | 地月系统 |
| --- | --- |
| ![太阳系总览](docs/screenshots/overview.png) | ![地月系统](docs/screenshots/earth-moon.png) |

| 木星系统 | 土星系统 |
| --- | --- |
| ![木星系统](docs/screenshots/jupiter.png) | ![土星系统](docs/screenshots/saturn.png) |

> 轨道比例 100% 真实；天体半径经压缩以便同屏可见，面板里拖「视觉放大 ×N」即可把小卫星放大观察（左下角角标会标注放大倍数）。

---

## 🌟 特性

- **真实轨道**：真椭圆、中心天体位于焦点；偏心率、倾角取自 JPL / PDS。水星、冥王星明显椭圆；海卫一及部分不规则卫星逆行公转。
- **8 个独立系统**：太阳系总览 + 地月 / 火星 / 木星 / 土星 / 天王星 / 海王星 / 冥王星子系统。每个可单独打开、单独构建，互不覆盖。
- **视觉放大**：卫星太小看不见？拖「视觉放大 ×N」只放大天体尺寸、轨道比例不变，角标实时标注倍数。
- **交互探索**：拖拽旋转、滚轮缩放；点击天体相机飞近并弹出资料卡；巨行星卫星太多时用「取景范围」分档查看。
- **全屏 / 移动端**：支持全屏，移动端横屏体验更佳。
- **易嵌入**：纯静态产物、相对路径构建，可直接 `iframe` 嵌入 MkDocs 等站点。

---

## 🪐 包含的系统

| 系统 | 中心天体 | 卫星数 |
| --- | --- | --- |
| 太阳系总览 | 太阳 | 八大行星（不显示卫星） |
| 地月 | 地球 | 1 |
| 火星 | 火星 | 2 |
| 木星 | 木星 | 17（内卫星 4 + 伽利略 4 + 不规则 9） |
| 土星 | 土星 | 16 |
| 天王星 | 天王星 | 15 |
| 海王星 | 海王星 | 14 |
| 冥王星 | 冥王星 | 5 |

---

## 🚀 本地运行

```bash
npm install
npm run dev       # 开发服务器，默认打开导航主页
npm run build     # 构建全部 8 个页面到 dist/
```

> 需要 Node.js 18+。单系统构建：`npm run build:jupiter` 等（不会覆盖其他系统产物）。

构建产物在 `dist/`，用任意静态服务器预览即可，例如：

```bash
npx vite preview --port 4173
```

---

## ☁️ 部署到 Cloudflare Pages

| 配置项 | 值 |
| --- | --- |
| Framework preset | `None` |
| Build command | `npm ci && npm run build` |
| Build output | `dist` |
| 环境变量 | `NODE_VERSION` = `20` |

push 后自动构建上线，根路径即为导航主页。**务必设置 `NODE_VERSION=20`**，否则默认 Node 可能不满足 Vite 要求而在 `npm ci` 阶段报错。

---

## 🧩 技术栈

Three.js · Vite（多入口）· dat.GUI · 开普勒轨道方程 · WebGL

---

## 📜 来源与许可

代码基于 [N3rson/Solar-System-3D](https://github.com/N3rson/Solar-System-3D)（MIT）重构，
原始版权见 [LICENSE](LICENSE)，改动清单与素材许可见 [NOTICE](NOTICE)。

- **代码**：MIT
- **贴图 / 模型**：来自第三方（NASA 3D Resources 公共领域、Solar System Scope CC BY 4.0 等），再分发需保留署名，详见 NOTICE。
- **天文数据**：NASA/JPL SSD、PDS Ring-Moon Systems Node、NASA Planetary Fact Sheet。

---

> 想了解数据填写、尺度参数、相机取景等内部细节，见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。
