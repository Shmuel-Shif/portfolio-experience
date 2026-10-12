import { OBJECT_FILES, familyOf } from './image-catalog.js';
import { assignHomes } from '../animation/object-motion.js';
import { createFlightStories, weaveStories } from './flight-stories.js';
import { createFlightForms } from './flight-forms.js';

const sessionSeed = Math.floor(Math.random() * 0x7fffffff);

export function getSessionSeed() {
  return sessionSeed;
}

export function createImageCast(THREE, level) {
  const rng = mulberry32(sessionSeed);
  const order = mixFiles(OBJECT_FILES, rng);
  const geometry = new THREE.PlaneGeometry(1.65, 1.65);
  const geometries = [geometry];
  const materials = [];
  const textures = [];
  const actors = order.map((file) => {
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
    });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.renderOrder = 2;
    const id = file.replace(/\.png$/i, '');
    return {
      id,
      kind: 'image',
      file,
      family: familyOf(file),
      object: mesh,
      material,
      ready: false,
    };
  });
  const stories = createFlightStories(THREE);
  stories.forEach((story) => {
    geometries.push(story.geometry);
    materials.push(story.material);
    textures.push(story.texture);
  });
  weaveStories(actors, stories);
  const forms = createFlightForms(THREE, level);
  forms.geometries.forEach((geometry) => geometries.push(geometry));
  forms.materials.forEach((material) => materials.push(material));
  forms.textures.forEach((texture) => textures.push(texture));
  weaveStories(actors, forms.actors);
  assignHomes(actors, rng);
  const maxEdge = level === 'low' ? 384 : level === 'medium' ? 480 : 560;

  return {
    actors,
    geometries,
    materials,
    textures,
    loaded: 0,
    failed: 0,
    async load(onProgress, onReady) {
      let finished = 0;
      let opened = false;
      const images = actors.filter((actor) => actor.kind === 'image');
      const essential = Math.min(18, images.length);
      const report = () => {
        if (onProgress) onProgress(Math.min(1, finished / essential));
      };
      const tryOpen = () => {
        if (opened || !onReady) return;
        const enough = this.loaded >= 12 || finished >= images.length || (finished >= essential && this.loaded > 0);
        if (!enough) return;
        opened = true;
        onReady();
      };
      report();
      await mapPool(images, 2, async (actor) => {
        try {
          const image = await loadImage(`assets/images/objects/${actor.file}`);
          if (opened) await idleGap();
          const texture = textureFromImage(THREE, image, maxEdge);
          textures.push(texture);
          actor.material.map = texture;
          actor.material.needsUpdate = true;
          const aspect = image.naturalWidth / Math.max(1, image.naturalHeight);
          actor.aspect = aspect;
          actor.ready = true;
          this.loaded += 1;
        } catch (error) {
          console.error(error);
          actor.ready = false;
          this.failed += 1;
        } finally {
          finished += 1;
          report();
          tryOpen();
          await nextFrame();
        }
      });
    },
  };
}

function mixFiles(files, rng) {
  const groups = new Map();
  files.forEach((file) => {
    const key = familyOf(file);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  });
  groups.forEach((list) => shuffle(list, rng));
  const keys = Array.from(groups.keys());
  shuffle(keys, rng);
  const out = [];
  let guard = 0;
  while (out.length < files.length && guard < 5000) {
    guard += 1;
    let placed = false;
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const list = groups.get(key);
      if (!list.length) continue;
      const previous = out.length ? familyOf(out[out.length - 1]) : '';
      const alternative = keys.some((other) => other !== key && groups.get(other).length > 0);
      if (previous === key && alternative) continue;
      out.push(list.pop());
      placed = true;
    }
    if (!placed) break;
  }
  groups.forEach((list) => {
    while (list.length) out.push(list.pop());
  });
  return out;
}

function shuffle(list, rng) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const held = list[index];
    list[index] = list[swap];
    list[swap] = held;
  }
  return list;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error(`Image timed out: ${url}`));
    }, 12000);
    image.decoding = 'async';
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error(`Image failed: ${url}`));
    };
    image.src = url;
  });
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function idleGap() {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 160 });
      return;
    }
    setTimeout(resolve, 32);
  });
}

function textureFromImage(THREE, image, maxEdge) {
  const largest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = largest > maxEdge ? maxEdge / largest : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true });
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.anisotropy = 4;
  return texture;
}

async function mapPool(items, limit, task) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await task(items[index], index);
    }
  });
  await Promise.all(workers);
}
