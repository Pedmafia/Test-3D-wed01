import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  cityTexture, codeTexture, cadTexture, phoneTexture, outdoorTexture,
  floorTexture, rugTexture, boxUV,
} from './textures.js';
import { createInteractions } from './interactions.js';
import './style.css';

RectAreaLightUniformsLib.init();

// ---------------------------------------------------------------- renderer
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const DAY_BG = new THREE.Color('#8d8f95');
const NIGHT_BG = new THREE.Color('#1b1c22');
scene.background = DAY_BG.clone();

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;

// ---------------------------------------------------------------- camera
// Same isometric-ish angle as the Blender camera (Blender XYZ → three X, Z, -Y)
const HOME_TARGET = new THREE.Vector3(1.95, 1.0, -1.95);
const HOME_DIR = new THREE.Vector3(0.579, 0.574, -0.579).normalize();
const camera = new THREE.PerspectiveCamera(26, viewAspect(), 0.1, 100);

function viewAspect() {
  const w = window.innerWidth, h = window.innerHeight;
  // The page can load while hidden (0×0) — fall back to a sane aspect
  return w > 0 && h > 0 ? w / h : 16 / 9;
}
function homeDistance() {
  return 13.5 * Math.max(1, 1.15 / viewAspect());
}
camera.position.copy(HOME_TARGET).addScaledVector(HOME_DIR, homeDistance());

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 2.5;
controls.maxDistance = 24;
controls.minPolarAngle = 0.25;
controls.maxPolarAngle = 1.38;
// Only look in through the two open sides of the cut-away room
controls.minAzimuthAngle = Math.PI / 2 + 0.06;
controls.maxAzimuthAngle = Math.PI - 0.06;
controls.autoRotateSpeed = 0.6;
const ROOM_MIN = new THREE.Vector3(-0.5, 0, -4.5);
const ROOM_MAX = new THREE.Vector3(4.5, 2.8, 0.5);
controls.addEventListener('change', () => controls.target.clamp(ROOM_MIN, ROOM_MAX));
controls.update();

// ---------------------------------------------------------------- lights
const lights = {};
lights.hemi = new THREE.HemisphereLight(0xffffff, 0x8a8580, 0.7);
scene.add(lights.hemi);

lights.sun = new THREE.DirectionalLight(0xfff1e2, 1.5);
lights.sun.position.set(6.5, 9, -4.5);
lights.sun.target.position.copy(HOME_TARGET);
lights.sun.castShadow = true;
lights.sun.shadow.mapSize.set(2048, 2048);
Object.assign(lights.sun.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 1, far: 25 });
lights.sun.shadow.bias = -0.0004;
lights.sun.shadow.normalBias = 0.02;
lights.sun.shadow.radius = 4;
scene.add(lights.sun, lights.sun.target);

lights.ceiling = new THREE.PointLight(0xffe2c0, 0, 7, 1.6);
lights.ceiling.position.set(2, 2.6, -2);
scene.add(lights.ceiling);

lights.window = new THREE.RectAreaLight(0xe8f2ff, 5, 1.6, 1.1);
lights.window.position.set(2.55, 1.5, -0.12);
lights.window.lookAt(2.55, 1.5, -3);
scene.add(lights.window);

const LED_COLOR = 0xffd6a5;
lights.ledA = new THREE.RectAreaLight(LED_COLOR, 7, 0.05, 2.6);
lights.ledA.position.set(0.06, 1.4, -0.78);
lights.ledA.lookAt(3, 1.4, -0.78);
lights.ledB = new THREE.RectAreaLight(LED_COLOR, 7, 0.05, 2.6);
lights.ledB.position.set(0.06, 1.4, -3.27);
lights.ledB.lookAt(3, 1.4, -3.27);
lights.ledBase = new THREE.RectAreaLight(LED_COLOR, 5, 3.6, 0.05);
lights.ledBase.position.set(2.1, 0.12, -0.06);
lights.ledBase.lookAt(2.1, 0.12, -3);
scene.add(lights.ledA, lights.ledB, lights.ledBase);

lights.logo = new THREE.PointLight(0xffd2a0, 1.6, 2.4, 2);
lights.logo.position.set(0.28, 2.15, -2.05);
scene.add(lights.logo);

lights.pc = new THREE.PointLight(0xff1f3d, 1.4, 1.6, 2);
lights.pc.position.set(0.5, 0.3, -3.0);
scene.add(lights.pc);

lights.softbox = new THREE.SpotLight(0xffffff, 9, 7, 0.75, 0.85, 2);
lights.softbox.position.set(0.78, 1.72, -0.7);
lights.softbox.target.position.set(1.9, 0.8, -1.9);
scene.add(lights.softbox, lights.softbox.target);

// ---------------------------------------------------------------- post FX
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const outline = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
Object.assign(outline, { edgeStrength: 4, edgeGlow: 0.4, edgeThickness: 1.5, pulsePeriod: 0 });
outline.visibleEdgeColor.set('#ffffff');
outline.hiddenEdgeColor.set('#ff6680');
composer.addPass(outline);
// Threshold is in linear HDR units: keep sunlit white walls (≈1–1.5) out of the bloom,
// only the emissive LEDs / screens / softbox (≥2) should glow.
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.4, 1.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- textures
const tex = {
  city: cityTexture(),
  code: codeTexture(),
  cad: cadTexture(),
  phone: phoneTexture(),
  outdoorDay: outdoorTexture(false),
  outdoorNight: outdoorTexture(true),
  floor: floorTexture(),
  rug: rugTexture(),
};

function screenMaterial(map, intensity = 1.1) {
  return new THREE.MeshStandardMaterial({
    color: 0x050507, roughness: 0.25, metalness: 0,
    emissive: 0xffffff, emissiveMap: map, emissiveIntensity: intensity,
  });
}

// ---------------------------------------------------------------- loading
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderText = document.getElementById('loader-text');
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => {
  const p = Math.round((loaded / total) * 100);
  loaderFill.style.width = `${p}%`;
  loaderText.textContent = `กำลังโหลดห้อง… ${p}%`;
};

const NO_SHADOW = /^(LED_|Win_Glass|Win_Outdoor|PC_Glass|Softbox_Diffuser|Logo_|Deck_Btn|MonA_Screen|MonB_Screen|Phone_Screen)/;

new GLTFLoader(manager).load(
  `${import.meta.env.BASE_URL}models/room.glb`,
  (gltf) => {
    const room = gltf.scene;
    const mats = {};

    room.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = !NO_SHADOW.test(o.name);
      o.receiveShadow = true;
      const m = o.material;
      mats[m.name] = m;

      // Blender emission strengths are tuned for EEVEE; tame them for bloom
      if (m.emissiveIntensity > 4) m.emissiveIntensity = 4;

      switch (o.name) {
        case 'Floor_Wood':
          boxUV(o.geometry, 'metre', 2);
          m.map = tex.floor; m.color.set(0xe2e2e2); m.roughness = 0.45; m.needsUpdate = true;
          break;
        case 'Rug':
          boxUV(o.geometry, 'metre', 0.6);
          m.map = tex.rug; m.color.set(0xb4b4b8); m.roughness = 1; m.needsUpdate = true;
          break;
        case 'Win_Outdoor':
          o.material = new THREE.MeshBasicMaterial({ map: tex.outdoorDay });
          boxUV(o.geometry, 'fit');
          break;
        case 'MonA_Screen':
          boxUV(o.geometry, 'fit');
          o.material = screenMaterial(tex.city);
          break;
        case 'MonB_Screen':
          boxUV(o.geometry, 'fit');
          o.material = screenMaterial(tex.cad, 0.9);
          break;
        case 'Phone_Screen':
          boxUV(o.geometry, 'fit');
          o.material = screenMaterial(tex.phone, 0);
          break;
        case 'KB_Key':
        case 'Deck_Btn_0':
        case 'Deck_Btn_1':
        case 'Deck_Btn_2':
          o.material = m.clone();
          break;
        default:
      }
      if (m.name === 'Glass_Dark') {
        m.transparent = true; m.opacity = 0.22; m.depthWrite = false; m.roughness = 0.05;
      }
      if (m.name === 'Softbox_White') m.emissiveIntensity = 2.2;
      if (m.name === 'LED_Warm') m.emissiveIntensity = 3;
      if (m.name === 'LED_Red') m.emissiveIntensity = 3.2;
    });

    scene.add(room);

    createInteractions({
      THREE, scene, room, camera, controls, renderer, composer, outline, bloom,
      lights, mats, tex, DAY_BG, NIGHT_BG, HOME_TARGET, HOME_DIR, homeDistance,
      onFrame: (fn) => frameCallbacks.push(fn),
    });

    loaderEl.classList.add('done');
  },
  undefined,
  (err) => {
    loaderText.textContent = 'โหลดโมเดลไม่สำเร็จ: ' + err.message;
    console.error(err);
  },
);

// ---------------------------------------------------------------- loop
const frameCallbacks = [];
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  for (const fn of frameCallbacks) fn(dt, t);
  controls.update();
  composer.render();
});

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});
