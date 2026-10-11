(() => {
  'use strict';

  // Real preload list. The percentage is measured from these files only.
  // A file with Content-Length reports byte progress; otherwise it counts
  // only after the response has fully arrived.
  // Example for a later stage: { id: 'opening', url: 'assets/opening.glb' }
  const ASSET_MANIFEST = [];

  function boot() {
    const root = document.getElementById('experience');
    if (!root) {
      throw new Error('Experience root was not found');
    }

    const experience = createExperience(root);
    // Later stage: experience.scroll.subscribe((offset) => opening.seek(offset));
    experience.start();
  }

  function createExperience(root) {
    const view = createLoadingView(root);
    const scroll = createScrollController(root);
    let assets = new Map();

    return {
      scroll,
      getAssets() {
        return assets;
      },
      start() {
        loadManifest(ASSET_MANIFEST, (ratio) => view.render(ratio))
          .then((loaded) => {
            assets = loaded;
            if (ASSET_MANIFEST.length > 0) view.render(1, true);
            return view.settle().then(() => {
              view.finish();
              scroll.enable();
            });
          })
          .catch((error) => {
            console.error(error);
            view.fail();
          });
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
        if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
        paint(latest);
        return;
      }
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        paint(latest);
      });
    }

    function finish() {
      root.dataset.phase = 'ready';
      meter.setAttribute('aria-hidden', 'true');
      hint.setAttribute('aria-hidden', 'false');
    }

    function fail() {
      root.dataset.phase = 'error';
      root.dataset.meter = 'live';
      meter.setAttribute('aria-hidden', 'false');
      hint.setAttribute('aria-hidden', 'true');
      status.textContent = 'הטעינה נכשלה';
    }

    function settle() {
      return nextFrame().then(nextFrame);
    }

    return { render, finish, fail, settle };
  }

  function createScrollController(root) {
    const state = {
      offset: 0,
      min: 0,
      max: Number.POSITIVE_INFINITY,
      enabled: false,
      listeners: new Set(),
    };
    let touchY = null;

    function commit(next) {
      const clamped = Math.min(state.max, Math.max(state.min, next));
      if (clamped === state.offset) return;
      state.offset = clamped;
      root.dataset.scrollOffset = String(Math.round(clamped));
      state.listeners.forEach((listener) => listener(state.offset));
    }

    function onWheel(event) {
      if (!state.enabled || event.ctrlKey) return;
      let delta = event.deltaY;
      if (event.deltaMode === 1) delta *= 16;
      if (event.deltaMode === 2) delta *= root.clientHeight || window.innerHeight;
      if (delta === 0) return;
      event.preventDefault();
      commit(state.offset + delta);
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
      if (delta === 0) return;
      event.preventDefault();
      commit(state.offset + delta);
    }

    function onTouchEnd() {
      touchY = null;
    }

    function onKeyDown(event) {
      if (!state.enabled || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target && event.target.isContentEditable)) {
        return;
      }

      let delta = 0;
      if (event.key === 'ArrowDown' || event.key === ' ') delta = 72;
      if (event.key === 'ArrowUp') delta = -72;
      if (event.key === 'PageDown') delta = (root.clientHeight || window.innerHeight) * 0.85;
      if (event.key === 'PageUp') delta = -(root.clientHeight || window.innerHeight) * 0.85;
      if (delta === 0) return;
      event.preventDefault();
      commit(state.offset + delta);
    }

    return {
      getOffset() {
        return state.offset;
      },
      setRange(min, max) {
        state.min = min;
        state.max = max;
        commit(state.offset);
      },
      subscribe(listener) {
        state.listeners.add(listener);
        return () => state.listeners.delete(listener);
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
      },
    };
  }

  function loadManifest(manifest, onProgress) {
    const loaded = new Map();
    if (manifest.length === 0) {
      return Promise.resolve(loaded);
    }

    const progress = new Array(manifest.length).fill(0);
    const emit = () => {
      const sum = progress.reduce((total, value) => total + value, 0);
      onProgress(sum / progress.length);
    };

    emit();

    const tasks = manifest.map((asset, index) => {
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
    });

    return Promise.all(tasks).then(() => loaded);
  }

  async function loadAsset(asset, onRatio) {
    const response = await fetch(asset.url);
    if (!response.ok) {
      throw new Error(`Asset failed (${response.status}): ${asset.url}`);
    }

    const encoding = response.headers.get('Content-Encoding');
    const declared = Number(response.headers.get('Content-Length'));
    const lengthKnown = Number.isFinite(declared)
      && declared > 0
      && (!encoding || encoding === 'identity');

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
    return concatChunks(chunks, received);
  }

  function concatChunks(chunks, length) {
    const bytes = new Uint8Array(length);
    let offset = 0;
    chunks.forEach((chunk) => {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    });
    return bytes.buffer;
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
})();
