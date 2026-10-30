import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loadTexture = new THREE.TextureLoader();
const DEG = Math.PI / 180;

/**
 * 当前视觉放大倍数，由 main.js 在滑块变化时同步。
 * 仅用于 GLB 模型天体（火星卫星等）在异步加载完成后按当前倍数初始化尺寸。
 */
let currentExaggeration = 1;
export function setCurrentExaggeration(v) {
  currentExaggeration = v;
}

/**
 * 椭圆轨道线。
 * 关键：椭圆中心在 (-a*e, 0)，因此原点（中心天体）落在椭圆的**焦点**上，
 * 而不是圆心——这才是真实的开普勒轨道。
 */
export function makeOrbitLine(a, e, color = 0xffffff, opacity = 0.12) {
  const b = a * Math.sqrt(1 - e * e);
  const curve = new THREE.EllipseCurve(-a * e, 0, a, b, 0, 2 * Math.PI, false, 0);
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(160));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const line = new THREE.LineLoop(geometry, material);
  line.rotation.x = Math.PI / 2; // XY 平面 -> XZ 平面
  return line;
}

/** 解开普勒方程 M = E - e·sin E（牛顿迭代） */
export function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 4; i++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

/** 由偏近点角求焦点坐标系下的位置（近日点快、远日点慢，符合面积定律） */
export function orbitPoint(a, e, E) {
  const b = a * Math.sqrt(1 - e * e);
  return { x: a * (Math.cos(E) - e), z: b * Math.sin(E) };
}

/**
 * 构建天体节点。
 *
 * 层级（无 orbitPivot：椭圆运动每帧直接写位置，不再靠绕轴旋转）：
 *   group  —— rotation.y = 升交点经度 node
 *     plane —— rotation.x = 轨道倾角 inc（轨道面）
 *       orbitLine —— 椭圆环
 *       mesh      —— 本体，每帧按开普勒方程设 position；自转让 mesh 自己转
 *       anchor    —— 子天体挂点，与 mesh 同位置（跟随公转，不继承本体自转）
 */
export function createBody(def) {
  let mesh = null;
  let atmosphere = null;
  let ring = null;

  if (!def.model) {
    let material;
    if (def.texture instanceof THREE.Material) {
      material = def.texture;
    } else if (def.texture) {
      const opts = { map: loadTexture.load(def.texture) };
      if (def.bump) {
        opts.bumpMap = loadTexture.load(def.bump);
        opts.bumpScale = def.bumpScale ?? 0.7;
      }
      material = new THREE.MeshPhongMaterial(opts);
    } else {
      // 无贴图素材时的占位球：用真实反照率调制的灰阶
      material = new THREE.MeshPhongMaterial({
        color: def.color ?? 0x9a9a9a,
        specular: 0x111111,
        shininess: 4,
      });
    }
    // 单位球几何体 + 按 def.size 缩放：运行时改尺寸只需改 mesh.scale，无需重建几何体
    mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), material);
    mesh.scale.setScalar(def.size);
    mesh.userData.bodyId = def.id;
    if (def.tilt) mesh.rotation.z = def.tilt * DEG;

    if (def.atmosphere) {
      const atmMat = new THREE.MeshPhongMaterial({
        map: loadTexture.load(def.atmosphere),
        transparent: true,
        opacity: 0.4,
        depthTest: true,
        depthWrite: false,
      });
      // 大气层挂在 mesh 下，会继承 mesh 的 scale（=def.size），
      // 故本地 scale 要除以 def.size，使净半径恒为 def.size + 0.1
      atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), atmMat);
      atmosphere.scale.setScalar((def.size + 0.1) / def.size);
      atmosphere.rotation.z = 0.41;
      atmosphere.userData.bodyId = def.id;
      mesh.add(atmosphere);
    }
  }

  const group = new THREE.Group();
  const plane = new THREE.Group();
  const anchor = new THREE.Object3D();

  if (def.orbit) {
    group.rotation.y = (def.orbit.node ?? 0) * DEG;
    plane.rotation.x = (def.orbit.inc ?? 0) * DEG;
    group.add(plane);
    plane.add(anchor);
    if (mesh) plane.add(mesh);
    if (def.orbit.showLine !== false) {
      plane.add(makeOrbitLine(def.orbit.a, def.orbit.e ?? 0, def.orbit.color, def.orbit.opacity));
    }
  } else {
    group.add(anchor);
    if (mesh) group.add(mesh);
  }

  // 行星环挂在 anchor 上：跟随本体位置，但不随本体自转
  if (def.ring) {
    const ringMat = new THREE.MeshStandardMaterial({
      map: loadTexture.load(def.ring.texture),
      side: THREE.DoubleSide,
    });
    // 支持按本体半径给比例（内/外环半径 ≈ 1.24 / 2.27 倍土星半径为真实值）
    const inner = def.ring.innerRadius ?? def.size * (def.ring.innerScale ?? 1.24);
    const outer = def.ring.outerRadius ?? def.size * (def.ring.outerScale ?? 2.27);
    ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 64), ringMat);
    ring.rotation.x = -0.5 * Math.PI;
    ring.rotation.y = (-def.tilt ?? 0) * DEG;
    ring.userData.bodyId = def.id;
    anchor.add(ring);
  }

  const node = {
    def,
    mesh,
    group,
    plane,
    anchor,
    atmosphere,
    ring,
    model: null,
  };

  // glb 模型天体（火卫一/火卫二）
  if (def.model) {
    const loader = new GLTFLoader();
    loader.load(
      def.model.path,
      (gltf) => {
        const obj = gltf.scene;
        // 按包围球把模型缩放到"想要的场景半径"，避免 glb 自带尺寸不可控
        const sphere = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
        const native = sphere.radius || 1;
        const wanted = def.model.radiusUnits ?? def.size * 4;
        const s = wanted / native;
        obj.scale.setScalar(s * currentExaggeration);
        node._baseScale = s; // 记录基准缩放，供运行时放大倍数调整
        obj.position.copy(sphere.center).multiplyScalar(-s); // 居中
        obj.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.userData.bodyId = def.id;
          }
        });
        (def.orbit ? plane : group).add(obj);
        node.model = obj;
      },
      undefined,
      (err) => console.error('模型加载失败:', def.model.path, err)
    );
  }

  return node;
}
