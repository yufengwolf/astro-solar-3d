import * as THREE from 'three';
import * as dat from 'dat.gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createBody, solveKepler, orbitPoint, setCurrentExaggeration } from './bodies.js';
import { applyScale, frameRadius, setBodyExaggeration } from './scale.js';
import { createCometParts, updateComet, updateCometViewport, cometGlobals } from './comet.js';

const DEG = Math.PI / 180;

/**
 * 算出某个"取景范围"下的相机位姿（不改动任何状态，纯计算，便于切换视角时复用）。
 * @param {object} system
 * @param {THREE.PerspectiveCamera} camera 只读用 fov
 * @param {string} [frameTo] 覆盖 system.camera.frameTo
 * @returns {{pos: THREE.Vector3, target: THREE.Vector3, maxDistance: number}}
 */
function cameraPose(system, camera, frameTo) {
  const cam = system.camera ?? {};
  const radius = frameRadius(system, frameTo);

  const dir = new THREE.Vector3(...(cam.position ?? [0, 0.45, 1]));
  if (dir.lengthSq() === 0) dir.set(0, 0.45, 1);
  dir.normalize();

  const dist = (radius / Math.tan((camera.fov * DEG) / 2)) * (cam.fitMargin ?? 1.25);

  // 拉远上限：至少能看到最外侧轨道，否则远距不规则卫星永远进不了画面
  let farthest = 0;
  for (const b of system.bodies) if (b.orbit?.a) farthest = Math.max(farthest, b.orbit.a);

  return {
    pos: dir.multiplyScalar(dist),
    target: new THREE.Vector3(...(cam.target ?? [0, 0, 0])),
    maxDistance: Math.max(cam.maxZoom ?? 0, farthest * 1.35, dist * 3),
  };
}

/**
 * 立即把相机摆到某个取景范围（不带动画）。
 */
function fitCamera(system, camera, controls, frameTo) {
  const pose = cameraPose(system, camera, frameTo);
  camera.position.copy(pose.pos);
  controls.target.copy(pose.target);
  controls.minDistance = Math.max(0.05, system.bodies[0].size * 0.3);
  controls.maxDistance = pose.maxDistance;
  return pose;
}

/**
 * 把当前放大倍数应用到已构建的天体节点（仅改 scale / 重建环几何体，不重建球几何体）。
 * 中心天体 def.size 未变，其 scale 也随之保持；仅次级天体变大。
 */
function applyExaggerationToNodes(nodes, factor) {
  for (const n of nodes) {
    const s = n.def.size;
    if (n.mesh) n.mesh.scale.setScalar(s);
    if (n.atmosphere) n.atmosphere.scale.setScalar((s + 0.1) / s);
    if (n.ring) {
      const inner = n.def.ring.innerRadius ?? s * (n.def.ring.innerScale ?? 1.24);
      const outer = n.def.ring.outerRadius ?? s * (n.def.ring.outerScale ?? 2.27);
      n.ring.geometry.dispose();
      n.ring.geometry = new THREE.RingGeometry(inner, outer, 64);
    }
    if (n.model && n._baseScale) n.model.scale.setScalar(n._baseScale * factor);
  }
}

/**
 * 统一的场景启动器。
 * system = {
 *   id, label, hasSun, background, camera, timeScale, scale,
 *   sun:{texture,intensity}, bodies:[...], asteroids:[...]
 * }
 */
export function start(system) {
  // 安全网：无太阳的子系统里，没有 parent 的天体就是中心天体，不该带公转轨道。
  // （REAL 里地球/木星等都存着绕日轨道，漏写 noOrbit 会让整个系统飞出画面。）
  for (const def of system.bodies) {
    if (!system.hasSun && !def.parent && def.orbit) {
      console.warn(`[start] ${def.id} 是子系统中心天体却带有轨道，已忽略；如需保留请显式配置`);
      delete def.orbit;
    }
  }

  applyScale(system);

  // ---------- 基础三件套 ----------
  // 远裁剪面必须随系统尺度变化：不规则卫星轨道可达上万场景单位，
  // 固定 20000 的 far 会让"+不规则卫星"取景档下整屏天体被裁掉。
  let farthestOrbit = 0;
  for (const b of system.bodies) if (b.orbit?.a) farthestOrbit = Math.max(farthestOrbit, b.orbit.a);
  const homeDistRaw =
    (frameRadius(system, system.camera?.frameTo ?? 'auto') / Math.tan((45 * DEG) / 2)) *
    (system.camera?.fitMargin ?? 1.25);
  const farPlane = Math.max(20000, (farthestOrbit + homeDistRaw) * 3);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45, window.innerWidth / window.innerHeight, farPlane * 1e-5, farPlane
  );

  const homeTarget = system.camera?.target ?? [0, 0, 0];

  // 对数深度缓冲：近裁剪面远小于 far 时避免 z-fighting
  const renderer = new THREE.WebGL1Renderer({ logarithmicDepthBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  // 彗尾是点云，点大小要按画布高度与 fov 换算成像素；窗口变化时必须重算
  updateCometViewport(camera, window.innerHeight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.75;
  controls.screenSpacePanning = false;

  // ---------- 取景范围（多视角）----------
  // 一颗行星的内层卫星与远距不规则卫星轨道可相差上百倍，同屏必然顾此失彼。
  // system.views 定义若干"框到哪一层"的预设，GUI 下拉切换。
  const views = system.views ?? [];
  fitCamera(system, camera, controls, system.camera?.frameTo ?? 'auto');
  let homePosition = camera.position.toArray();

  // ---------- 后处理 ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const outlinePass = new OutlinePass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    scene,
    camera
  );
  outlinePass.edgeStrength = 3;
  outlinePass.edgeGlow = 1;
  outlinePass.visibleEdgeColor.set(0xffffff);
  outlinePass.hiddenEdgeColor.set(0x190a05);
  composer.addPass(outlinePass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 1, 0.4, 0.85
  );
  bloomPass.threshold = 1;
  bloomPass.radius = 0.9;
  composer.addPass(bloomPass);

  // ---------- 光照 ----------
  scene.add(new THREE.AmbientLight(0x222222, 6));

  let sunMesh = null;
  let sunMat = null;
  if (system.hasSun) {
    const sunConf = system.sun ?? {};
    sunMat = new THREE.MeshStandardMaterial({
      emissive: 0xfff88f,
      emissiveMap: new THREE.TextureLoader().load(sunConf.texture),
      emissiveIntensity: sunConf.intensity ?? 1.9,
    });
    sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(system.scale?.sunUnits ?? 18, 32, 20),
      sunMat
    );
    sunMesh.userData.bodyId = 'sun';
    scene.add(sunMesh);

    const pointLight = new THREE.PointLight(0xfdffd3, 1200, 400, 1.4);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 1024;
    pointLight.shadow.mapSize.height = 1024;
    scene.add(pointLight);
  } else {
    const dir = new THREE.DirectionalLight(0xffffff, 2.6);
    dir.position.set(1, 0.45, 0.9).multiplyScalar(200);
    dir.castShadow = false; // 默认阴影相机仅 ±5，行星尺度下会出现接缝伪影
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x8899bb, 0.5);
    fill.position.set(-1, -0.3, -0.6).multiplyScalar(200);
    scene.add(fill);
  }

  if (system.background) {
    scene.background = new THREE.CubeTextureLoader().load(system.background);
  }

  // ---------- 构建天体 ----------
  const nodes = [];
  const byId = new Map();
  for (const def of system.bodies) {
    const node = createBody(def);
    // 彗星：彗发作为子节点挂在核上；两条尾巴必须挂到 scene 根——
    // 尾巴要在**世界坐标**里始终背离太阳，挂在随轨道面倾斜/旋转的 plane 下无法定向。
    if (def.comet && node.mesh) {
      node.comet = createCometParts(def, node.mesh);
      scene.add(node.comet.ion);
      scene.add(node.comet.dust);
    }
    if (def.parent && byId.has(def.parent)) {
      byId.get(def.parent).anchor.add(node.group);
    } else {
      scene.add(node.group);
    }
    nodes.push(node);
    byId.set(def.id, node);
  }

  // 太阳的世界坐标：彗尾要背离它。总览里太阳就在原点；无太阳的系统退回光照方向。
  const sunPos = new THREE.Vector3(...(system.camera?.target ?? [0, 0, 0]));

  // ---------- 小行星带 ----------
  const asteroids = [];
  for (const belt of system.asteroids ?? []) {
    const loader = new GLTFLoader();
    loader.load(
      belt.path,
      (gltf) => {
        gltf.scene.traverse((child) => {
          if (!child.isMesh) return;
          const per = Math.max(1, Math.round(belt.count / 12));
          for (let i = 0; i < per; i++) {
            const a = child.clone();
            const r = THREE.MathUtils.randFloat(belt.min, belt.max);
            const ang = Math.random() * Math.PI * 2;
            a.position.set(r * Math.cos(ang), THREE.MathUtils.randFloat(-3, 3), r * Math.sin(ang));
            a.scale.setScalar(THREE.MathUtils.randFloat(0.8, 1.2));
            scene.add(a);
            asteroids.push(a);
          }
        });
      },
      undefined,
      (err) => console.error('小行星加载失败:', belt.path, err)
    );
  }

  // ---------- 控制面板 ----------
  const settings = {
    timeScale: system.timeScale ?? 1, // 天 / 秒
    sunIntensity: system.sun?.intensity ?? 1.9,
  };
  const gui = new dat.GUI({ autoPlace: false });
  const guiContainer = document.getElementById('gui-container');
  if (guiContainer) guiContainer.appendChild(gui.domElement);
  gui.add(settings, 'timeScale', 0, 200).name('时间流速(天/秒)');

  // ---------- 视觉放大（仅放大天体尺寸，轨道比例不变）----------
  // 默认 1 = 物理推导尺寸（严谨模式）。调大可让原本不足 1 像素的小卫星清晰可见。
  // 中心天体（无轨道者）不参与放大，避免高倍率下膨胀到吞掉自家卫星轨道。
  settings.bodyExaggeration = system.scale?.bodyExaggeration ?? 1;
  gui.add(settings, 'bodyExaggeration', 1, 15, 0.5)
    .name('视觉放大 ×')
    .onChange((v) => {
      setBodyExaggeration(system, v);
      applyExaggerationToNodes(nodes, v);
      setCurrentExaggeration(v);
      updateBadge(v);
    });

  // 彗尾强度：彗星只在接近太阳时才活动，长周期彗星在远日点要"等很久"才亮起来。
  // 这个滑块只放大尾巴的长度与亮度，不改变活动规律（仍严格按 1/r² 随日心距变化）。
  if (system.bodies.some((b) => b.comet)) {
    settings.tailGain = 1;
    gui.add(settings, 'tailGain', 0.5, 3, 0.1).name('彗尾强度 ×');
  }

  // 角标：常驻显示当前放大倍数，明确"这是为了看清小天体而做的视觉放大"
  const badge = document.createElement('div');
  badge.id = 'exaggerationBadge';
  document.body.appendChild(badge);
  function updateBadge(f) {
    const txt = Number.isInteger(f) ? String(f) : f.toFixed(1);
    badge.textContent = `视觉放大 ×${txt}（仅放大天体尺寸，轨道比例不变）`;
  }
  updateBadge(settings.bodyExaggeration);
  if (views.length > 1) {
    const labels = views.map((v) => v.label);
    // 默认选中与 camera.frameTo 对应的那一档（views[0] 不一定就是默认视角）
    const defId = views.findIndex((v) => v.frameTo === (system.camera?.frameTo ?? 'auto'));
    settings.view = labels[Math.max(0, defId)];
    gui.add(settings, 'view', labels).name('取景范围').onChange((label) => {
      const i = labels.indexOf(label);
      if (i >= 0) applyView(i);
    });
  }
  if (system.hasSun) {
    gui.add(settings, 'sunIntensity', 1, 10).name('太阳亮度').onChange((v) => {
      sunMat.emissiveIntensity = v;
    });
  }

  // ---------- 拾取与信息卡 ----------
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let raycastTargets = [];
  function refreshTargets() {
    raycastTargets = [];
    for (const n of nodes) {
      if (n.mesh) raycastTargets.push(n.mesh);
      if (n.atmosphere) raycastTargets.push(n.atmosphere);
      if (n.ring) raycastTargets.push(n.ring);
      // 彗核只有几个像素，靠彗发提供可点击的面积；尾巴不参与拾取，
      // 否则巨大的锥体会挡住后面天体的点击，且描边效果会很怪
      if (n.comet) raycastTargets.push(n.comet.coma);
      if (n.model) n.model.traverse((c) => { if (c.isMesh) raycastTargets.push(c); });
    }
    if (sunMesh) raycastTargets.push(sunMesh);
  }
  refreshTargets();
  setTimeout(refreshTargets, 1500); // glb 异步加载完成后再刷新

  const infoById = new Map();
  for (const def of system.bodies) infoById.set(def.id, def);

  let selected = null;
  let isMoving = false;
  let isZoomingOut = false;
  let paused = false;
  const targetCameraPosition = new THREE.Vector3();
  const homeVec = new THREE.Vector3(...homePosition);

  // 视角切换：飞向新位姿，同时更新"返回基准点"，保证关闭信息卡后回到当前视角
  const flyPos = new THREE.Vector3();
  const flyTarget = new THREE.Vector3();
  let flying = false;
  function applyView(idx) {
    const pose = cameraPose(system, camera, views[idx].frameTo);
    controls.minDistance = Math.max(0.05, system.bodies[0].size * 0.3);
    controls.maxDistance = pose.maxDistance;
    homePosition = pose.pos.toArray();
    homeVec.copy(pose.pos);
    flyPos.copy(pose.pos);
    flyTarget.copy(pose.target);
    flying = true;
    selected = null;
    isMoving = false;
    isZoomingOut = false;
    const box = document.getElementById('planetInfo');
    if (box) box.style.display = 'none';
  }

  function showInfo(def) {
    const box = document.getElementById('planetInfo');
    const nameEl = document.getElementById('planetName');
    const detailEl = document.getElementById('planetDetails');
    if (!box || !nameEl || !detailEl) return;
    nameEl.innerText = def.name;
    let detail = Object.entries(def.info ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    if (settings.bodyExaggeration > 1) {
      detail += `\n视觉放大: ×${settings.bodyExaggeration}（天体尺寸已放大，轨道比例不变）`;
    }
    detailEl.innerText = detail;
    box.style.display = 'block';
  }
  function closeInfo() {
    const box = document.getElementById('planetInfo');
    if (box) box.style.display = 'none';
    paused = false;
    isZoomingOut = true;
    controls.target.set(...homeTarget);
  }
  window.closeInfo = closeInfo;

  function focusOn(def, object) {
    const box = document.getElementById('planetInfo');
    if (box) box.style.display = 'none';
    paused = false;

    const worldPos = new THREE.Vector3();
    object.getWorldPosition(worldPos);
    controls.target.copy(worldPos);
    camera.lookAt(worldPos);

    // 小卫星按自身半径取景，否则飞过去了还是看不见
    const offset = def.cameraOffset ?? Math.max(def.size * 8, 2);
    targetCameraPosition
      .copy(worldPos)
      .add(camera.position.clone().sub(worldPos).normalize().multiplyScalar(offset));
    isMoving = true;
  }

  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('mousedown', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(raycastTargets, false);
    if (!hits.length) return;
    const id = hits[0].object.userData.bodyId;
    const def = infoById.get(id) ?? (id === 'sun' ? { name: '太阳', size: system.scale?.sunUnits ?? 18 } : null);
    if (!def) return;
    selected = def;
    focusOn(def, hits[0].object);
  });

  // ---------- 动画：真实时间驱动的开普勒运动 ----------
  let elapsedDays = 0;
  let last = performance.now();

  function animate() {
    const now = performance.now();
    const dtSec = Math.min((now - last) / 1000, 0.1);
    last = now;
    const dtDays = paused ? 0 : dtSec * settings.timeScale; // 本帧推进的真实天数
    elapsedDays += dtDays;

    for (const n of nodes) {
      const d = n.def;

      // 公转：解开普勒方程，近日点快、远日点慢
      if (d.orbit) {
        const T = d.orbit.periodDays;
        const M = (2 * Math.PI * elapsedDays) / T + (d.orbit.M0 ?? 0);
        const E = solveKepler(M, d.orbit.e ?? 0);
        const p = orbitPoint(d.orbit.a, d.orbit.e ?? 0, E);
        n._E = E; // 彗尾要用偏近点角算真实日心距
        if (n.mesh) n.mesh.position.set(p.x, 0, p.z);
        else if (n.model) n.model.position.set(p.x, 0, p.z);
        n.anchor.position.set(p.x, 0, p.z);
      }

      // 自转：周期取负即逆行（金星、天王星）
      if (n.mesh && d.rotationHours) {
        n.mesh.rotateY(((2 * Math.PI) / (d.rotationHours / 24)) * dtDays);
      }
      if (n.model && d.rotationHours) {
        n.model.rotateY(((2 * Math.PI) / (d.rotationHours / 24)) * dtDays);
      }
      // 大气层单独周期：云层相对地表缓慢漂移；金星大气"超级旋转"仅约 4 天
      if (n.atmosphere && d.atmosphereRotateHours) {
        n.atmosphere.rotateY(((2 * Math.PI) / (d.atmosphereRotateHours / 24)) * dtDays);
      }
    }
    // 彗发 / 彗尾：依赖本帧刚写好的位置与偏近点角，必须排在公转更新之后
    cometGlobals.uTime.value = performance.now() / 1000; // 驱动彗尾湍流缓慢漂移
    for (const n of nodes) {
      if (n.comet) updateComet(n, sunPos, settings.tailGain ?? 1);
    }

    if (sunMesh) sunMesh.rotateY(((2 * Math.PI) / (609.12 / 24)) * dtDays);

    for (const a of asteroids) {
      a.rotation.y += 0.0001;
      const c = Math.cos(0.0001 * settings.timeScale * 0.02);
      const s = Math.sin(0.0001 * settings.timeScale * 0.02);
      const x = a.position.x, z = a.position.z;
      a.position.x = x * c + z * s;
      a.position.z = z * c - x * s;
    }

    // 悬停描边
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(raycastTargets, false);
    outlinePass.selectedObjects = hits.length ? [hits[0].object] : [];

    // 相机飞行：视角切换 > 点击聚焦 > 返回基准点
    if (flying) {
      camera.position.lerp(flyPos, 0.05);
      controls.target.lerp(flyTarget, 0.05);
      if (camera.position.distanceTo(flyPos) < Math.max(0.5, flyPos.length() * 0.004)) flying = false;
    } else if (isMoving) {
      camera.position.lerp(targetCameraPosition, 0.03);
      if (camera.position.distanceTo(targetCameraPosition) < 1) {
        isMoving = false;
        paused = true; // 飞抵后暂停时间，便于观察
        showInfo(selected);
      }
    } else if (isZoomingOut) {
      camera.position.lerp(homeVec, 0.05);
      if (camera.position.distanceTo(homeVec) < 1) isZoomingOut = false;
    }

    controls.update();
    requestAnimationFrame(animate);
    composer.render();
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    updateCometViewport(camera, window.innerHeight);
  });

  return { scene, camera, renderer, nodes, settings };
}
