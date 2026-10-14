import { ILLUSION_DONE, ILLUSION_GATE, epilogueAt, illusionProgress, phases } from './animation/timeline.js';
import { createArrivalGalaxy } from './arrival-galaxy.js';
import { mountAbout } from './about.js';
import { mountGeometryField } from './geometry-field.js';
import { mountToolkit } from './toolkit.js';
import { mountServices } from './services.js';
import { mountWorksRail } from './works-rail.js';
import { mountOpeningScene } from './opening-scene.js';

const ASSET_MANIFEST = [];
const OPENING_MIN = 1200;
const OPENING_MAX = 2600;
const SCENE_TO_CIRCLE = 2;
const OPENING_SCALE = 0.32;
const OPENING_SEEN_KEY = 'portfolio-opening-seen';

function mobileOpening() {
  return window.matchMedia('(pointer: coarse)').matches;
}

function openingAlreadySeen() {
  try {
    return sessionStorage.getItem(OPENING_SEEN_KEY) === '1';
  } catch (error) {
    return false;
  }
}

function markOpeningSeen() {
  try {
    sessionStorage.setItem(OPENING_SEEN_KEY, '1');
  } catch (error) {
    // The tab can still finish the visit when storage is blocked.
  }
}

function boot() {
  const root = document.getElementById('experience');
  if (!root) throw new Error('Experience root was not found');
  createExperience(root).start();
}

function createExperience(root) {
  const view = createLoadingView(root);
  const hint = root.querySelector('[data-scroll-hint]');
  const quality = detectQuality();
  const opening = createOpeningStage(root.querySelector('[data-stage-mount]'), quality);
  let galaxy = null;
  const scroll = createScrollController(root, {
    openingLength: measureOpeningLength(),
    lambda: quality.lambda,
  });
  let assets = new Map();
  const skipOpening = openingAlreadySeen();

  root.dataset.quality = quality.level;
  root.dataset.mode = 'opening';
  root.dataset.progress = '0';
  root.style.setProperty('--opening-progress', '0');

  const stageMount = opening.getMount();
  scroll.subscribe((sample) => {
    const circleShare = 1 / (1 + SCENE_TO_CIRCLE);
    const circleProgress = clamp01(sample.openingProgress / circleShare);
    const scrolledScene = clamp01((sample.openingProgress - circleShare) / (1 - circleShare));
    let sceneProgress = scrolledScene;
    if (scroll.isIllusion()) {
      sceneProgress = sample.epilogue == null
        ? illusionProgress(sample.illusion || 0, scroll.illusionOrigin())
        : ILLUSION_DONE;
    }
    const film = sample.epilogue == null ? null : epilogueAt(sample.epilogue);
    opening.seek(sceneProgress, film, sample.illusion == null ? 0 : sample.illusion);
    root.style.setProperty('--opening-progress', circleProgress.toFixed(4));
    const reveal = root.dataset.sealed === 'true'
      ? 1
      : (stageMount.dataset.scene === 'attached' ? clamp01(sceneProgress / 0.12) : 0);
    root.style.setProperty('--scene-reveal', reveal.toFixed(4));
    root.dataset.sceneProgress = sceneProgress.toFixed(4);
    if (circleProgress > 0.001) root.dataset.opening = 'active';
    else delete root.dataset.opening;
    if (circleProgress >= 0.999) root.dataset.circle = 'full';
    else delete root.dataset.circle;
    if (!hint) return;
    const hintVisible = root.dataset.phase === 'ready'
      && root.dataset.sealed !== 'true'
      && sample.mode === 'opening'
      && circleProgress <= 0.001;
    hint.setAttribute('aria-hidden', hintVisible ? 'false' : 'true');
    const phase = film || phases(sceneProgress);
    if (!film && phase.line >= 0.9) scroll.beginEpilogue();
    const content = root.querySelector('[data-content]');
    const span = root.clientHeight || window.innerHeight;
    const landed = span * 1.15;
    const scrollShift = Math.max(0, sample.offset - scroll.openingLength());
    const shift = root.dataset.sealed === 'true'
      ? scrollShift
      : (film ? film.site * landed : 0);
    root.style.setProperty('--content-shift', shift.toFixed(2));
    if (root.dataset.sealed === 'true' && !root.dataset.arrival) {
      root.dataset.arrival = skipOpening ? 'shown' : 'enter';
    }
    const siteHeader = root.querySelector('[data-site-header]');
    const headerReveal = root.dataset.sealed === 'true'
      ? clamp01((scrollShift - landed) / Math.max(1, span * 0.42))
      : 0;
    if (siteHeader) {
      siteHeader.style.setProperty('--header-reveal', headerReveal.toFixed(3));
      const headerReady = headerReveal > 0.92;
      siteHeader.dataset.ready = headerReady ? 'true' : 'false';
      siteHeader.toggleAttribute('inert', !headerReady);
    }
    if (film && film.done) scroll.seal(landed);
    if (content && (root.dataset.sealed === 'true' || (film && film.night > 0.35))) content.hidden = false;
    const arrivalOnScreen = root.dataset.sealed === 'true' && shift > span * 0.35 && shift < span * 2.15;
    if (arrivalOnScreen) {
      if (!galaxy) {
        galaxy = createArrivalGalaxy(root.querySelector('[data-arrival-sky]'), quality);
        galaxy.start();
      }
      galaxy.play();
    } else if (galaxy) {
      galaxy.pause();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scroll.wake();
  });
  mountWorksRail(root.querySelector('[data-works-rail]'));
  mountServices(root);
  mountAbout(root);
  mountGeometryField(root);
  mountToolkit(root);
  root.querySelectorAll('[data-arrival-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (root.dataset.sealed !== 'true') return;
      const id = link.getAttribute('href') || '';
      const target = id.startsWith('#') ? root.querySelector(id) : null;
      if (!target) return;
      event.preventDefault();
      const span = root.clientHeight || window.innerHeight;
      scroll.seekContent(span + target.offsetTop);
    });
  });
  const menuToggle = root.querySelector('[data-menu-toggle]');
  const siteHeader = root.querySelector('[data-site-header]');
  if (menuToggle && siteHeader) {
    menuToggle.addEventListener('click', () => {
      const open = siteHeader.dataset.menu !== 'open';
      if (open) siteHeader.dataset.menu = 'open';
      else delete siteHeader.dataset.menu;
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    siteHeader.querySelectorAll('.site-nav a').forEach((link) => {
      link.addEventListener('click', (event) => {
        delete siteHeader.dataset.menu;
        menuToggle.setAttribute('aria-expanded', 'false');
        if (link.getAttribute('href') !== '#services' || root.dataset.sealed !== 'true') return;
        const target = root.querySelector('#services');
        if (!target) return;
        event.preventDefault();
        const span = root.clientHeight || window.innerHeight;
        scroll.seekContent(span + target.offsetTop);
      });
    });
  }
  if (!skipOpening) {
    mountOpeningScene(opening, stageMount, quality, {
      onProgress(ratio) {
        view.render(ratio);
      },
    });
  }

  return {
    start() {
      if (skipOpening) {
        showFinishedSite(root, view, scroll);
        return;
      }
      waitForScene(stageMount)
        .then(() => view.render(1, true))
        .then(() => view.settle())
        .then(() => {
          view.finish();
          scroll.enable();
        })
        .catch((error) => {
          console.error(error);
          view.fail();
        });
    },
    getAssets() {
      return assets;
    },
  };
}

function showFinishedSite(root, view, scroll) {
  view.finish();
  const hint = root.querySelector('[data-scroll-hint]');
  const finale = root.querySelector('[data-finale]');
  if (hint) hint.setAttribute('aria-hidden', 'true');
  if (finale) finale.setAttribute('aria-hidden', 'true');
  root.style.setProperty('--opening-progress', '1');
  root.style.setProperty('--scene-reveal', '1');
  const span = root.clientHeight || window.innerHeight;
  scroll.seal(span * 1.15);
  scroll.enable();
}

function measureCircleLength() {
  const height = window.innerHeight || 800;
  return Math.min(OPENING_MAX, Math.max(OPENING_MIN, Math.round(height * 2.4)));
}

function measureOpeningLength() {
  const full = measureCircleLength() * (1 + SCENE_TO_CIRCLE);
  return Math.max(720, Math.round(full * OPENING_SCALE));
}

function detectQuality() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const connection = navigator.connection;
  const saveData = Boolean(connection && connection.saveData);
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8;
  let level = 'high';
  if (cores <= 4 || memory <= 4) level = 'medium';
  if (saveData || cores <= 2 || memory <= 2) level = 'low';
  let lambda = 14;
  if (level === 'medium') lambda = 16;
  if (level === 'low') lambda = 18;
  if (reducedMotion) lambda = 0;
  return { level, reducedMotion, lambda };
}

function createOpeningStage(mount, quality) {
  if (!mount) throw new Error('Opening stage mount was not found');
  const state = { progress: 0, quality: quality.level, scene: null };
  mount.dataset.scene = 'pending';
  mount.dataset.quality = quality.level;
  mount.dataset.progress = '0';

  function seek(progress, epilogue, spinExtra = 0) {
    const next = clamp01(progress);
    state.progress = next;
    state.spinExtra = Math.max(0, Number(spinExtra) || 0);
    mount.dataset.progress = next.toFixed(4);
    if (state.scene) state.scene.seek(next, epilogue, state.spinExtra);
  }

  return {
    getMount() { return mount; },
    getProgress() { return state.progress; },
    seek,
    attachScene(scene) {
      if (!scene || typeof scene.seek !== 'function') {
        throw new Error('Opening scene must implement seek(progress)');
      }
      state.scene = scene;
      mount.dataset.scene = 'attached';
      scene.seek(state.progress, null, state.spinExtra || 0);
    },
  };
}

function createLoadingView(root) {
  const meter = root.querySelector('[data-loader-meter]');
  const bar = root.querySelector('[data-loader-bar]');
  const percentNode = root.querySelector('[data-loader-percent]');
  const status = root.querySelector('[data-loader-status]');
  const hint = root.querySelector('[data-scroll-hint]');
  let frame = 0;
  let latest = 0;

  function paint(ratio) {
    const percent = toPercent(ratio);
    root.dataset.meter = 'live';
    meter.style.setProperty('--load', String(percent / 100));
    bar.setAttribute('aria-valuenow', String(percent));
    percentNode.textContent = `${percent}%`;
  }

  function render(ratio, sync = false) {
    latest = clamp01(ratio);
    if (sync) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      paint(latest);
      return;
    }
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      paint(latest);
    });
  }

  return {
    render,
    finish() {
      root.dataset.phase = 'ready';
      meter.setAttribute('aria-hidden', 'true');
      hint.setAttribute('aria-hidden', 'false');
    },
    fail() {
      root.dataset.phase = 'error';
      root.dataset.meter = 'live';
      meter.setAttribute('aria-hidden', 'false');
      hint.setAttribute('aria-hidden', 'true');
      status.textContent = 'הטעינה נכשלה';
    },
    settle() {
      return nextFrame().then(nextFrame);
    },
  };
}

function createScrollController(root, options) {
  const state = {
    offset: 0,
    target: 0,
    min: 0,
    openingLength: options.openingLength,
    contentLength: 0,
    sealed: false,
    pending: 0,
    aim: 0,
    epilogue: false,
    epilogueAt: 0,
    epilogueElapsed: null,
    illusion: false,
    illusionAt: 0,
    illusionElapsed: null,
    illusionOrigin: ILLUSION_GATE,
    landedShift: 0,
    lambda: options.lambda,
    enabled: false,
    listeners: new Set(),
    published: '',
    frame: 0,
    lastTime: 0,
  };
  let touchY = null;

  function fitContentLength() {
    const span = root.clientHeight || window.innerHeight;
    const content = root.querySelector('[data-content]');
    const height = content && !content.hidden ? content.scrollHeight : 0;
    state.contentLength = Math.max(span * 2.6, height);
  }

  function maxOffset() {
    return state.openingLength + state.contentLength;
  }

  function clampOffset(value) {
    return Math.min(maxOffset(), Math.max(state.min, value));
  }

  function sampleFrom(offset) {
    const openingLength = state.openingLength || 1;
    const openingOffset = Math.min(Math.max(offset, 0), state.openingLength);
    const openingProgress = clamp01(openingOffset / openingLength);
    const contentProgress = state.contentLength > 0
      ? clamp01((offset - state.openingLength) / state.contentLength)
      : 0;
    const mode = offset >= state.openingLength - 0.25 ? 'content' : 'opening';
    return { offset, openingProgress, contentProgress, mode };
  }

  function inScene() {
    return state.offset >= state.openingLength * 0.5;
  }

  function openingNotch() {
    const length = state.openingLength;
    if (mobileOpening()) {
      const span = root.clientHeight || window.innerHeight || 700;
      if (inScene()) return Math.max(56, span * 0.18);
      return Math.max(84, span * 0.24);
    }
    if (inScene()) return Math.max(2.4, Math.min(4, length * 0.00072));
    return Math.max(16, Math.min(24, length * 0.0055));
  }

  function openingLead() {
    return openingNotch() * (inScene() ? 3 : 4);
  }

  function openingRate() {
    return Math.max(280, state.openingLength * 0.11);
  }

  function publish() {
    const sample = sampleFrom(state.offset);
    sample.epilogue = state.epilogue ? state.epilogueElapsed : null;
    sample.illusion = state.illusion && !state.epilogue ? state.illusionElapsed : null;
    const filmKey = sample.epilogue == null ? '' : sample.epilogue.toFixed(3);
    const illusionKey = sample.illusion == null ? '' : sample.illusion.toFixed(3);
    const key = `${sample.mode}|${sample.openingProgress.toFixed(4)}|${sample.contentProgress.toFixed(4)}|${filmKey}|${illusionKey}`;
    if (key === state.published) return;
    state.published = key;
    root.dataset.scrollOffset = String(Math.round(sample.offset));
    root.dataset.progress = sample.openingProgress.toFixed(4);
    root.dataset.mode = sample.mode;
    root.dataset.epilogue = state.epilogue ? '1' : '0';
    state.listeners.forEach((listener) => listener(sample));
  }

  function step(now) {
    const elapsed = state.lastTime === 0 ? 1 / 60 : (now - state.lastTime) / 1000;
    const dt = elapsed > 0.25 ? 1 / 60 : Math.min(Math.max(elapsed, 0), 0.1);
    state.lastTime = now;
    if (state.epilogue && !state.sealed) {
      state.pending = 0;
      state.aim = state.offset;
      state.epilogueElapsed = Math.max(0, (now - state.epilogueAt) / 1000);
    } else if (state.illusion && !state.sealed) {
      state.pending = 0;
      state.aim = state.offset;
      const raw = Math.max(0, (now - state.illusionAt) / 1000);
      const previous = state.illusionElapsed || 0;
      state.illusionElapsed = previous + Math.min(0.05, Math.max(0, raw - previous));
    } else if (!state.sealed && state.lambda > 0) {
      const lead = openingLead();
      const gap = state.aim - state.offset;
      if (Math.abs(gap) > lead) state.aim = state.offset + Math.sign(gap) * lead;
      const remain = state.aim - state.offset;
      if (Math.abs(remain) < 0.08) state.offset = state.aim;
      else state.offset = clampOffset(state.offset + remain * (1 - Math.exp(-dt / 0.062)));
    } else if (state.pending !== 0) {
      if (state.lambda <= 0) {
        state.offset = clampOffset(state.offset + state.pending);
        state.pending = 0;
        state.aim = state.offset;
      } else {
        const rate = state.sealed ? 2600 : openingRate();
        const stepPx = Math.sign(state.pending) * Math.min(Math.abs(state.pending), rate * dt);
        state.offset = clampOffset(state.offset + stepPx);
        state.pending -= stepPx;
        if (Math.abs(state.pending) < 0.35) state.pending = 0;
      }
    }
    state.target = state.sealed ? state.offset : state.aim;
    publish();
    const settled = sampleFrom(state.offset);
    const filmKey = state.epilogue && state.epilogueElapsed != null ? state.epilogueElapsed.toFixed(3) : '';
    const illusionKey = state.illusion && !state.epilogue && state.illusionElapsed != null ? state.illusionElapsed.toFixed(3) : '';
    const settledKey = `${settled.mode}|${settled.openingProgress.toFixed(4)}|${settled.contentProgress.toFixed(4)}|${filmKey}|${illusionKey}`;
    if (settledKey !== state.published) publish();
    const filming = (state.epilogue || state.illusion) && !state.sealed;
    const chasing = !state.sealed && Math.abs(state.aim - state.offset) > 0.08;
    const live = typeof options.onFrame === 'function' && options.onFrame(now);
    if (state.pending !== 0 || chasing || filming || live) state.frame = requestAnimationFrame(step);
    else {
      state.frame = 0;
      state.lastTime = 0;
    }
  }

  function wake() {
    if (state.frame) return;
    state.lastTime = 0;
    state.frame = requestAnimationFrame(step);
  }

  function pushInput(delta) {
    if (!delta || ((state.epilogue || state.illusion) && !state.sealed)) return;
    if (!state.sealed && state.lambda > 0) {
      const lead = openingLead();
      state.aim = clampOffset(state.aim + delta);
      const gap = state.aim - state.offset;
      if (Math.abs(gap) > lead) state.aim = state.offset + Math.sign(gap) * lead;
      wake();
      return;
    }
    const cap = state.sealed ? 720 : openingLead();
    state.pending = Math.min(cap, Math.max(-cap, state.pending + delta));
    if (state.lambda <= 0) state.aim = clampOffset(state.offset + state.pending);
    wake();
  }

  function onWheel(event) {
    if (!state.enabled || event.ctrlKey) return;
    event.preventDefault();
    if ((state.epilogue || state.illusion) && !state.sealed) return;
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta = Math.sign(delta) * Math.min(36, Math.abs(delta) * 28);
    else if (event.deltaMode === 2) delta = Math.sign(delta) * (root.clientHeight || window.innerHeight) * (state.sealed ? 0.65 : 0.1);
    else if (!state.sealed && Math.abs(delta) >= 50) delta = Math.sign(delta) * openingNotch();
    else if (!state.sealed && Math.abs(delta) > openingNotch()) delta = Math.sign(delta) * openingNotch();
    else if (state.sealed && Math.abs(delta) >= 50) delta = Math.sign(delta) * Math.min(110, Math.abs(delta));
    if (delta === 0) return;
    pushInput(delta);
  }

  function onTouchStart(event) {
    if (!state.enabled || event.touches.length !== 1) {
      touchY = null;
      return;
    }
    touchY = event.touches[0].clientY;
  }

  function onTouchMove(event) {
    if (!state.enabled || touchY === null || event.touches.length !== 1) return;
    const y = event.touches[0].clientY;
    const delta = touchY - y;
    touchY = y;
    event.preventDefault();
    if ((state.epilogue || state.illusion) && !state.sealed) return;
    if (delta === 0) return;
    pushInput(delta);
  }

  function onTouchEnd() {
    touchY = null;
  }

  function onKeyDown(event) {
    if (!state.enabled || event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target && event.target.isContentEditable)) return;
    let delta = 0;
    if (event.key === 'ArrowDown' || event.key === ' ') delta = 72;
    if (event.key === 'ArrowUp') delta = -72;
    if (event.key === 'PageDown') delta = (root.clientHeight || window.innerHeight) * 0.85;
    if (event.key === 'PageUp') delta = -(root.clientHeight || window.innerHeight) * 0.85;
    if (delta === 0) return;
    event.preventDefault();
    if ((state.epilogue || state.illusion) && !state.sealed) return;
    pushInput(state.sealed ? delta : Math.sign(delta) * Math.min(Math.abs(delta), openingNotch()));
  }

  function onResize() {
    const previousOpening = state.openingLength || 1;
    const openingProgress = Math.min(1, Math.max(0, state.target / previousOpening));
    const contentOffset = Math.max(0, state.target - previousOpening);
    const displayedProgress = Math.min(1, Math.max(0, state.offset / previousOpening));
    const displayedContent = Math.max(0, state.offset - previousOpening);
    state.openingLength = measureOpeningLength();
    if (state.sealed) {
      state.min = state.openingLength + state.landedShift;
      fitContentLength();
    }
    state.target = clampOffset(openingProgress * state.openingLength + contentOffset);
    state.offset = clampOffset(displayedProgress * state.openingLength + displayedContent);
    wake();
  }

  return {
    subscribe(listener) {
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },
    openingLength() {
      return state.openingLength;
    },
    beginIllusion(origin = ILLUSION_GATE) {
      if (state.illusion || state.epilogue || state.sealed) return;
      state.illusion = true;
      state.illusionOrigin = Math.max(ILLUSION_GATE, Math.min(0.84, origin));
      state.illusionAt = performance.now();
      state.illusionElapsed = 0;
      state.pending = 0;
      state.aim = state.offset;
      state.published = '';
      root.dataset.illusion = '1';
      wake();
    },
    isIllusion() {
      return state.illusion;
    },
    illusionOrigin() {
      return state.illusionOrigin;
    },
    beginEpilogue() {
      if (state.epilogue || state.sealed) return;
      state.epilogue = true;
      state.epilogueAt = performance.now();
      state.epilogueElapsed = 0;
      state.pending = 0;
      state.aim = state.offset;
      state.published = '';
      root.dataset.epilogue = '1';
      wake();
    },
    isEpilogue() {
      return state.epilogue;
    },
    seal(landedShift = 0) {
      if (state.sealed) return;
      state.sealed = true;
      state.pending = 0;
      state.aim = state.offset;
      state.landedShift = Math.max(0, landedShift);
      const landed = state.openingLength + state.landedShift;
      state.min = landed;
      root.dataset.sealed = 'true';
      markOpeningSeen();
      const content = root.querySelector('[data-content]');
      if (content) content.hidden = false;
      fitContentLength();
      state.offset = clampOffset(Math.max(state.offset, landed));
      state.aim = state.offset;
      state.target = state.offset;
      state.published = '';
      wake();
    },
    enable() {
      if (state.enabled) return;
      state.enabled = true;
      root.addEventListener('wheel', onWheel, { passive: false });
      root.addEventListener('touchstart', onTouchStart, { passive: true });
      root.addEventListener('touchmove', onTouchMove, { passive: false });
      root.addEventListener('touchend', onTouchEnd, { passive: true });
      root.addEventListener('touchcancel', onTouchEnd, { passive: true });
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('resize', onResize);
    },
    seekContent(shift) {
      if (!state.sealed || !Number.isFinite(shift)) return;
      const next = clampOffset(state.openingLength + Math.max(state.landedShift, shift));
      state.pending = next - state.offset;
      state.aim = next;
      wake();
    },
    wake() {
      wake();
    },
  };
}

function damp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

function loadManifest(manifest, onProgress) {
  const loaded = new Map();
  if (manifest.length === 0) return Promise.resolve(loaded);
  const progress = new Array(manifest.length).fill(0);
  const emit = () => onProgress(progress.reduce((total, value) => total + value, 0) / progress.length);
  emit();
  return Promise.all(manifest.map((asset, index) => {
    if (!asset || typeof asset.url !== 'string' || asset.url.length === 0) {
      return Promise.reject(new Error('Each asset needs a url'));
    }
    return loadAsset(asset, (ratio) => {
      progress[index] = ratio;
      emit();
    }).then((buffer) => {
      progress[index] = 1;
      emit();
      loaded.set(asset.id || asset.url, buffer);
    });
  })).then(() => loaded);
}

async function loadAsset(asset, onRatio) {
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error(`Asset failed (${response.status}): ${asset.url}`);
  const encoding = response.headers.get('Content-Encoding');
  const declared = Number(response.headers.get('Content-Length'));
  const lengthKnown = Number.isFinite(declared) && declared > 0 && (!encoding || encoding === 'identity');
  if (!response.body || typeof response.body.getReader !== 'function') {
    const buffer = await response.arrayBuffer();
    onRatio(1);
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (lengthKnown) onRatio(Math.min(1, received / declared));
  }
  onRatio(1);
  const bytes = new Uint8Array(received);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return bytes.buffer;
}

function waitForScene(mount) {
  if (mount.dataset.loadedImages) return Promise.resolve();
  return new Promise((resolve, reject) => {
    mount.addEventListener('scene-ready', () => resolve(), { once: true });
    mount.addEventListener('scene-failed', () => reject(new Error('Opening scene failed')), { once: true });
  });
}

function toPercent(ratio) {
  const safe = clamp01(ratio);
  if (safe >= 1) return 100;
  return Math.floor(safe * 100);
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

boot();
