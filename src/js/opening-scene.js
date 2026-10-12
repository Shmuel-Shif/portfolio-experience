import { createImageCast, getSessionSeed } from './objects/image-cast.js';
import { applyBackground } from './animation/background-motion.js';
import { applyCamera } from './animation/camera-motion.js';
import { applyObjects } from './animation/object-motion.js';
import { createLifeField } from './animation/life-field.js';
import { createSpiral } from './animation/spiral.js';
import { clamp01 } from './animation/timeline.js';

const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

export function mountOpeningScene(opening, mount, quality, hooks = {}) {
  import(THREE_MODULE_URL).then((THREE) => {
    const cast = createImageCast(THREE, quality.level);
    mount.dataset.mixSeed = String(getSessionSeed());
    let attached = false;
    const attach = () => {
      if (attached) return null;
      attached = true;
      const scene = createOpeningScene(THREE, mount, quality, cast);
      opening.attachScene(scene);
      mount.dataset.loadedImages = String(cast.loaded);
      mount.dataset.failedImages = String(cast.failed);
      mount.dispatchEvent(new CustomEvent('scene-ready'));
      return scene;
    };
    return cast.load((ratio) => {
      if (hooks.onProgress) hooks.onProgress(ratio);
    }, attach).then(() => {
      mount.dataset.loadedImages = String(cast.loaded);
      mount.dataset.failedImages = String(cast.failed);
      return attach();
    });
  }).catch((error) => {
    console.error(error);
    mount.dispatchEvent(new CustomEvent('scene-failed'));
  });
}

function createOpeningScene(THREE, mount, quality, cast) {
  const reduced = Boolean(quality.reducedMotion);
  const level = quality.level;
  const backdrop = mount.querySelector('[data-scene-backdrop]');
  const finale = mount.querySelector('[data-finale]');
  const line = mount.querySelector('[data-finale-line]');
  const nextLine = mount.querySelector('[data-finale-next]');
  const brand = null;
  const flash = mount.querySelector('[data-finale-flash]');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: level === 'high' && !reduced,
      alpha: true,
      powerPreference: level === 'low' ? 'low-power' : 'high-performance',
    });
  } catch (error) {
    disposeCast(cast);
    throw error;
  }

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const deviceRatio = window.devicePixelRatio || 1;
  let ratioCap = 1.35;
  if (level === 'medium') ratioCap = 1.15;
  if (level === 'low' || reduced) ratioCap = 1;
  if (coarse) ratioCap = Math.min(ratioCap, 1.15);
  renderer.setPixelRatio(Math.min(deviceRatio, ratioCap));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(48, 1, 0.08, 240);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff4e8, 1.6);
  sun.position.set(3.2, 4.4, 8);
  scene.add(sun);

  const life = createLifeField(THREE, level);
  scene.add(life.group);
  const spiral = createSpiral(THREE);
  scene.add(spiral.mesh);
  const world = new THREE.Group();
  scene.add(world);
  cast.actors.forEach((actor) => world.add(actor.object));

  let disposed = false;

  function resize() {
    if (disposed) return;
    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;
    if (width < 2 || height < 2) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioCap));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = `${width}px`;
    renderer.domElement.style.height = `${height}px`;
    camera.aspect = width / height;
    const portrait = height > width && width < 1100;
    camera.fov = portrait ? 40 : 46;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  function seek(nextProgress, epilogue) {
    if (disposed) return;
    const progress = clamp01(nextProgress);
    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;
    const portrait = height > width && width < 1100;
    const cameraState = applyCamera(camera, progress, reduced, portrait);
    const phase = epilogue ? { ...cameraState.phase, ...epilogue } : cameraState.phase;
    const prominent = applyObjects(cast.actors, cameraState.cruiseZ, progress, reduced, portrait, width / Math.max(1, height));
    life.seek(progress, camera);
    const lifeShown = life.shown();
    mount.dataset.cells = lifeShown.cells ? '1' : '0';
    mount.dataset.dust = lifeShown.dust ? '1' : '0';
    spiral.seek(phase, camera);
    applyBackground(backdrop, progress);
    paintFinale(phase, line, nextLine, brand, flash, finale);
    const covered = phase.white > 0.92;
    renderer.domElement.style.visibility = covered ? 'hidden' : 'visible';
    mount.dataset.prominent = String(prominent);
    if (!covered) renderer.render(scene, camera);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('resize', resize);
    disposeCast(cast);
    life.geometries.forEach((geometry) => geometry.dispose());
    life.materials.forEach((material) => material.dispose());
    spiral.geometry.dispose();
    spiral.material.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pagehide', dispose, { once: true });
  resize();
  warmVisiblePrograms();

  function warmVisiblePrograms() {
    if (disposed) return;
    const hidden = [];
    scene.traverse((object) => {
      if (object.visible) return;
      hidden.push(object);
      object.visible = true;
    });
    if (typeof renderer.compile === 'function') renderer.compile(scene, camera);
    renderer.render(scene, camera);
    hidden.forEach((object) => {
      object.visible = false;
    });
    seek(0);
  }

  return { seek, dispose, setQuality() {} };
}

function paintFinale(phase, line, nextLine, brand, flash, finale) {
  const first = phase.line * (1 - phase.lineOut);
  const second = phase.lineOut >= 0.98 ? phase.lineIn * (1 - phase.lineExit) : 0;
  if (flash) flash.style.opacity = (phase.white * (1 - phase.night)).toFixed(3);
  if (line) {
    line.style.opacity = first.toFixed(3);
    line.style.transform = `translate(-50%, calc(-50% + ${(-16 * phase.lineOut).toFixed(1)}px)) scale(${(1 - phase.lineOut * 0.035).toFixed(3)})`;
    line.setAttribute('aria-hidden', first > 0.04 ? 'false' : 'true');
  }
  if (nextLine) {
    const enter = 1 - phase.lineIn;
    nextLine.style.opacity = second.toFixed(3);
    nextLine.style.transform = `translate(-50%, calc(-50% + ${(12 * enter).toFixed(1)}px)) scale(${(0.965 + phase.lineIn * 0.035).toFixed(3)})`;
    nextLine.setAttribute('aria-hidden', second > 0.04 ? 'false' : 'true');
  }
  if (brand) brand.style.opacity = '0';
  if (finale) {
    finale.style.backgroundColor = phase.night > 0 ? `rgba(0, 0, 0, ${phase.night.toFixed(3)})` : 'transparent';
    finale.setAttribute('aria-hidden', first > 0.04 || second > 0.04 ? 'false' : 'true');
  }
}

function disposeCast(cast) {
  cast.materials.forEach((material) => material.dispose());
  cast.geometries.forEach((geometry) => geometry.dispose());
  cast.textures.forEach((texture) => texture.dispose());
}
