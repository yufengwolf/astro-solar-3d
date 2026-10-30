# 开发者文档（内部细节）

对外展示用的精简版见仓库根目录 [README.md](README.md)。本文档面向想改代码 / 加系统的开发者，
讲清楚目录结构、数据怎么填、尺度与相机参数、多视角、真实性与已知限制。

---

## 目录结构

```
src/
  index.html / overview.html / earth-moon.html / mars.html / ...   页面入口（每系统一个）
  entries/         入口脚本：引入某系统配置并调用 start()
  systems/
    mk.js          用真实参数生成天体定义的辅助函数
    shared.js      共享的星空立方体贴图
    solar.js       太阳系总览配置
    earth-moon.js / mars.js / jupiter.js / ...     各子系统配置
  data/
    bodies-real.js 真实天体物理参数（唯一数据源）
  bodies.js        天体/轨道环构造 + 开普勒方程
  scale.js         尺度换算（纯函数，不依赖 three，自检脚本直接复用）
  main.js          场景编排：相机、光照、后处理、GUI、拾取、动画
  style.css
static/            publicDir：运行时按相对路径加载的 glb（火星卫星、小行星包）
scripts/sync.mjs         一键构建 + 复制 dist 到本地静态站目录（可选）
scripts/check-scale.mjs  尺度自检（改动 scale/camera 后务必跑）
vite.base.js      多入口构建配置生成器（ENTRIES 注册表在这里）
vite.config.js    全量构建
vite.*.config.js  单系统构建
```

构建产物全部落在 `dist/` 根目录（`index.html`、`overview.html`、`earth-moon.html`…），
共享同一个 `dist/assets/`，因此 three.js 公共块跨页面只下载一次。

---

## 数据怎么填（最重要）

**所有真实物理参数集中在 `src/data/bodies-real.js`**，各系统配置只负责「选哪些天体 + 贴图/配色/文案」。

```js
// src/data/bodies-real.js
moon: {
  radiusKm: 1737.4,          // 赤道半径 km
  rotationHours: 655.72,     // 自转周期，负数 = 逆行
  axialTilt: undefined,      // 自转轴倾角（度），卫星通常省略
  orbit: {
    aKm: 384400,             // 轨道半长轴（卫星用 km；行星用 aAU）
    e: 0.0549,               // 偏心率
    inc: 5.145,              // 轨道倾角（度）
    periodDays: 27.322,      // 公转周期，负数 = 逆行公转
  },
},
```

系统配置里用 `mk()` 生成天体：

```js
import { mk } from './mk.js';

// ⚠️ 子系统中心天体必须写 noOrbit: true
mk('earth', '地球', {
  noOrbit: true,                         // 关键！否则会带着绕日轨道飞出画面
  texture: earthDay,
});

mk('moon', '月球', {
  parent: 'earth',                       // 挂在谁下面
  texture: moonMap, bump: moonBump,      // 有贴图就用贴图
  // color: 0xa8a8a8,                    // 无贴图时用灰阶占位球
  orbit: { showLine: true, opacity: 0.35, color: 0xdddddd },
  info: { 赤道半径: '1,737.4 km', ... },  // 点击后弹出的资料卡
});
```

不规则卫星的 `a / e / i / node / 周期` 全部取自 NASA/JPL SSD 的
《Planetary Satellite Mean Elements》，规则卫星取自 PDS Ring-Moon Systems Node 的
Vital Statistics 表。卫星表面暂无贴图，统一用**真实反照率调制的灰阶占位球**。

子系统统一规则（可配置，非硬编码）：
- **不画太阳**，用一盏远方向光提供明暗过渡；
- **中心天体只自转、不公转**；
- **卫星自转 + 公转**，并画出各自的**椭圆轨道**；
- 点击天体 → 相机飞近 → 弹出资料卡，同时暂停时间便于观察。

---

## 尺度参数（`system.scale`）

| 字段 | 含义 |
| --- | --- |
| `radiusRef` | 参考天体 id |
| `radiusRefUnits` | 该天体的真实半径映射为多少场景单位（参考天体本身恒等于该值） |
| `radiusPower` | **半径压缩指数**：`1` = 真实相对大小；`<1` 压大放小。卫星半径常只有中心天体的 1/300，不压缩就是不足 1 像素的点 |
| `bodyExaggeration` | 半径统一放大倍数（默认 1），即页面上的「视觉放大 ×N」 |
| `minBodyUnits` | 半径下限（场景单位），兜住极端小的天体 |
| `distanceMode` | `linear` 真实比例（可乘 `distanceFactor`）/ `power` 幂律压缩 |
| `distanceFactor` | linear 模式下的距离倍数，**`1` = 完全真实比例**。它是整体倍数，**不改变各轨道之间的相对比例**，所以"轨道疏密"始终真实，只改变"天体大小 vs 轨道距离"的比值 |
| `distancePower` / `maxDistance` | power 模式的指数与最远距离 |
| `sunUnits` | 太阳单独指定半径（真实 109 倍地球半径会撑爆画面） |

**相机不用手调**：`camera.position` 现在只表示**方向**（会被归一化），
距离由 `camera.frameTo` 指定的轨道自动算出。

| `camera` 字段 | 含义 |
| --- | --- |
| `position` | 相机方向向量（自动归一化），距离由取景半径决定 |
| `target` | 视点，默认 `[0,0,0]` |
| `frameTo` | `'auto'`(默认) = 框住最远轨道；也可填某颗天体 id，只框到它的轨道 |
| `fitMargin` | 取景留白倍数，默认 `1.25` |

各系统当前取值（`npm run check` 可直接看到换算结果）：

| 系统 | `radiusPower` | `distanceFactor` | `frameTo` | 说明 |
| --- | --- | --- | --- | --- |
| solar | 0.35 | power 0.45 / maxDistance 520 | auto | 必须压缩半径，否则木星会盖住土星轨道 |
| earth-moon | 0.6 | 0.22 | auto | 真实比例下月球轨道 = 60 倍地球半径，地球只剩几个像素 |
| mars | 0.6 | 1 | auto | 火卫二轨道仅 6.9 倍火星半径，可以 1:1 |
| jupiter | 0.35 | 1 | `callisto` | 内卫星到不规则卫星跨 185 倍，靠 `views` 分档 |
| saturn | 0.35 | 1 | `titan` | 土卫一在 3.19 倍半径处、环外径 2.35 倍；再压缩会陷进环里 |
| uranus | 0.35 | 0.6 | `oberon` | 需给 Puck 留出环外径(2.0 倍)之外的余量 |
| neptune | 0.35 | 0.7 | `triton` | 外圈不规则卫星在 1,660 万–4,990 万 km，只能靠切档看 |
| pluto | 0.4 | 0.7 | `charon` | |

---

## 多视角（`system.views`）

一颗行星的最内与最外卫星轨道可相差 **185 倍**（木星）到 **140 倍**（海王星），
任何单一镜头都不可能同时看清。所以每个系统定义若干"框到哪一层"的预设，
右上角面板会出现「取景范围」下拉：

```js
camera: { position: [0, 0.42, 1], frameTo: 'callisto' },   // frameTo = 默认档
views: [
  { id: 'inner',     label: '内卫星',           frameTo: 'thebe' },
  { id: 'galilean',  label: '伽利略卫星',       frameTo: 'callisto' },
  { id: 'regular',   label: '+希玛利亚群',      frameTo: 'elara' },
  { id: 'all',       label: '+远距不规则卫星',  frameTo: 'auto' },
],
```

- 默认档 = `camera.frameTo` 对应的那一档（不是 `views[0]`）。
- `frameTo: 'auto'` = 框住最远轨道。
- 切换时相机平滑飞过去，并把"返回基准点"一并更新。
- 拉远上限自动设为 `max(最远轨道 × 1.35, 相机距离 × 3)`，远端卫星不会被 `maxDistance` 卡住。

---

## 逆行怎么表达（易错）

**逆行 = `orbit.inc > 90°`，`periodDays` 必须保持正值。**

渲染时轨道面会绕 X 轴翻转，运动方向自然反转。如果再给 `periodDays` 取负，
会发生二次反转，实际渲染成**顺行**——历史上 Triton 就踩过这个坑。
`npm run check` 会直接把"周期取负"报出来。

---

## 时间参数

`system.timeScale` 单位是**天/秒**，页面上「时间流速(天/秒)」滑杆可实时调。
公转/自转都由真实周期推导，符合开普勒第三定律（越远越慢），不是手调常数。

---

## 真实性说明（哪些真、哪些做了美化）

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 轨道形状 | ✅ 真实 | 真椭圆，中心天体位于**焦点**（不是圆心） |
| 轨道偏心率 | ✅ 真实 | 水星 0.206、冥王星 0.249 会明显看出是椭圆 |
| 轨道倾角 | ✅ 真实 | 水星 7.0°、冥王星 17.2°、土卫八 15.5°、海卫一 156.865°、木卫十一 164.6°、天卫二十四 169.2° |
| 公转周期 | ✅ 真实 | 由真实周期算，近日点快、远日点慢（开普勒第二定律） |
| 自转周期 / 方向 | ✅ 真实 | 金星、天王星逆向自转；海卫一、土卫九、木卫八/九/十一/十二、天/海的不规则卫星逆行公转 |
| 自转轴倾角 | ✅ 真实 | 天王星 97.77° 是"躺着转"的 |
| 天体半径比例 | ⚠️ 压缩 | 用 `radiusPower` 压缩（0.35~0.6）+ `minBodyUnits` 下限。真实比例下卫星只有中心天体的 1/300，屏幕上不足 1 像素 |
| 轨道距离（相对疏密） | ✅ 真实 | `distanceFactor` 是整体倍数，各轨道之间的比例 100% 真实 |
| 轨道距离（vs 天体大小） | ⚠️ 整体缩放 | `distanceFactor` 0.22~1，只改这一个比值（巨行星子系统现在基本用 1） |
| 轨道距离（总览） | ⚠️ 幂律压缩 | 用 `a^0.45`：真实 0.39–39.5 AU 跨度太大无法同屏 |
| 太阳半径 | ⚠️ 单独指定 | 真实是地球的 109 倍，总览里固定为 26 单位 |
| 升交点经度 | ✅ 真实（不规则卫星）／⚠️ 缺省 0（规则卫星） | 不规则卫星取自 JPL mean elements；规则卫星的 node 对观感几乎无影响，统一写 0 |
| 卫星表面 | ⚠️ 占位 | 土/天/海/冥的卫星暂无贴图，用真实反照率调制的灰阶球 |
| 内卫星拥挤度 | ⚠️ 看起来更挤 | 海王星 7 颗内卫星真实轨道只差几千 km；为了让它们可见半径被放大，观感比真实更挤 |
| 火卫一/二 | ⚠️ 放大 | 真实半径仅 11 km / 6 km，按比例是看不见的点。glb 模型按 `model.radiusUnits`（1.2 / 0.9）缩放（轨道半径仍真实） |

**为什么"好圆好正在一个平面"看起来像假的？**
因为对行星和规则卫星来说它**基本就是真的**——八大行星相对黄道倾角最大才 7°（冥王星 17° 除外），
偏心率除水星/冥王星外都小于 0.1；木星四大卫星倾角都小于 0.5°。
真正失真的是**正圆而非椭圆**、**圆心而非焦点**，这两点已经修正。

数据来源（按优先级）：
1. NASA/JPL SSD《Planetary Satellite Mean Elements》(ssd.jpl.nasa.gov/sats/elem/sep.html) —— 不规则卫星的 a / e / i / node / 周期
2. PDS Ring-Moon Systems Node 的 Vital Statistics 表 (pds-rings.seti.org) —— 规则卫星
3. NASA Planetary Fact Sheet —— 行星本体的半径 / 自转 / 轴倾角

---

## 新增一个系统的完整步骤

1. **加数据**：在 `src/data/bodies-real.js` 里补上天体的真实参数。
2. **写配置**：新建 `src/systems/xxx.js`，用 `mk()` 列出天体，设好 `scale` / `camera` / `views` / `timeScale`。
   **中心天体务必加 `noOrbit: true`**（否则它会带着 `bodies-real.js` 里的绕日轨道飞出画面）。
3. **建入口**：新建 `src/entries/xxx.js`（三行：import 配置 + `start(system)`）。
4. **建页面**：复制任一 `src/*.html`，改 title 与入口脚本路径。
5. **注册构建**：在 `vite.base.js` 的 `ENTRIES` 里加一行；新建 `vite.xxx.config.js`。
6. **加脚本**：在 `package.json` 的 `scripts` 里加 `build:xxx`。
7. `npm run check` 跑尺度自检（穿插 / 过小 / 中心天体误公转都会报出来），再 `npm run build` 验证出包。

---

## 已知限制 / 待办

- 土星、天王星、海王星、冥王星的卫星**贴图缺失**，目前用灰阶占位球；可从 NASA 3D Resources / Solar System Scope 补真实贴图。
- 没有实现轨道进动（月球交点进动、近地点进动）与潮汐加速。
- 太阳系总览不再显示卫星（真实比例下它们在总览尺度里不可见），要看卫星请进对应子系统。
- 相机距离自动算，但一屏放不下全部卫星：巨行星子系统默认只框到"主要卫星"，更远的不规则卫星要切「取景范围」档或滚轮拉远。
- 远距不规则卫星在最宽那一档里只有几个像素——这是真实的（它们只有几十公里大、却在上千万公里外），想看清请切窄档或滚轮拉近。
- 只画了轨道在环外的土星/天王星卫星：Pan / Daphnis / Atlas / Cordelia…Belinda 等真实轨道埋在环内，会被环贴图遮住。

---

## 本地同步到另一个仓库（可选）

如果想把产物拷进某个本地静态站目录，编辑 `sync.config.json` 的 `dest`（默认 `./_export`）：

```json
{ "dest": "./_export" }
```

```bash
npm run sync                                # 只同步现有 dist/
npm run sync -- --build                     # 全量构建 + 整体替换目标目录
npm run sync -- --build --system=jupiter    # 只构建木星系统 + 增量覆盖（不影响其他页面）
```
