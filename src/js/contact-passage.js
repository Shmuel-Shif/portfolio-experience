const ARRIVE_KEY = 'portfolio-contact-arrive';
const RETURN_KEY = 'portfolio-contact-return';
const OPENING_SEEN_KEY = 'portfolio-opening-seen';

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function ensureStyle() {
  if (document.getElementById('contact-passage-style')) return;
  const style = document.createElement('style');
  style.id = 'contact-passage-style';
  style.textContent = '.contact-passage{position:fixed;inset:0;z-index:10000;background:#000;pointer-events:auto;}';
  document.head.appendChild(style);
}

function createLayer() {
  ensureStyle();
  const layer = document.createElement('div');
  layer.className = 'contact-passage';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  return layer;
}

function flash(layer) {
  const frames = ['#000000', '#ffffff', '#000000', '#ffffff', '#000000', '#ffffff', '#000000'];
  let chain = Promise.resolve();
  frames.forEach((color, index) => {
    chain = chain.then(() => {
      layer.style.background = color;
      layer.style.transform = index % 2 === 0 ? 'translate(-2px, 1px)' : 'translate(2px, -1px)';
      return wait(64);
    });
  });
  return chain.then(() => {
    layer.style.transform = 'none';
    layer.style.background = 'transparent';
  });
}

function hole(layer) {
  const disk = document.createElement('div');
  disk.style.position = 'absolute';
  disk.style.left = '50%';
  disk.style.top = '50%';
  disk.style.width = '0';
  disk.style.height = '0';
  disk.style.borderRadius = '50%';
  disk.style.background = 'transparent';
  disk.style.boxShadow = '0 0 0 200vmax #000000';
  disk.style.transform = 'translate(-50%, -50%)';
  layer.appendChild(disk);
  return disk;
}

function closeTunnel(layer, duration, easing) {
  const disk = hole(layer);
  disk.style.width = '300vmax';
  disk.style.height = '300vmax';
  return disk.animate(
    [{ width: '300vmax', height: '300vmax' }, { width: '0px', height: '0px' }],
    { duration, easing, fill: 'forwards' }
  ).finished.then(() => {
    layer.style.background = '#000000';
  });
}

function openTunnel(layer, duration, easing) {
  layer.style.background = 'transparent';
  const disk = hole(layer);
  return disk.animate(
    [{ width: '0px', height: '0px' }, { width: '300vmax', height: '300vmax' }],
    { duration, easing, fill: 'forwards' }
  ).finished.then(() => {
    layer.remove();
  });
}

function remember(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch (error) {
    // Navigation still proceeds when storage is blocked.
  }
}

function read(key) {
  try {
    return sessionStorage.getItem(key) || '';
  } catch (error) {
    return '';
  }
}

function clear(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    // Ignore storage failures.
  }
}

export function bindContactPassage(anchor) {
  if (!anchor || anchor.dataset.passageBound === 'true') return;
  anchor.dataset.passageBound = 'true';
  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    if (anchor.dataset.passage === 'running') return;
    anchor.dataset.passage = 'running';
    remember(ARRIVE_KEY, '1');
    if (reducedMotion()) {
      window.location.href = 'contact.html';
      return;
    }
    const layer = createLayer();
    flash(layer)
      .then(() => closeTunnel(layer, 460, 'cubic-bezier(0.7, 0, 1, 0.6)'))
      .then(() => {
        window.location.href = 'contact.html';
      })
      .catch(() => {
        window.location.href = 'contact.html';
      });
  });
}

export function revealContactPage() {
  const arriving = read(ARRIVE_KEY) === '1';
  if (!arriving || reducedMotion()) {
    document.documentElement.classList.remove('passage-cover');
    if (arriving) clear(ARRIVE_KEY);
    return;
  }
  const layer = createLayer();
  document.documentElement.classList.remove('passage-cover');
  clear(ARRIVE_KEY);
  openTunnel(layer, 520, 'cubic-bezier(0.16, 0.8, 0.3, 1)').catch(() => {
    layer.remove();
  });
}

export function departContactPage() {
  remember(RETURN_KEY, '1');
  remember(OPENING_SEEN_KEY, '1');
  if (reducedMotion()) {
    window.location.href = 'index.html';
    return;
  }
  const layer = createLayer();
  closeTunnel(layer, 1280, 'cubic-bezier(0.4, 0, 0.2, 1)')
    .then(() => {
      window.location.href = 'index.html';
    })
    .catch(() => {
      window.location.href = 'index.html';
    });
}

export function landOnPortfolio(root) {
  if (read(RETURN_KEY) !== '1' || read(OPENING_SEEN_KEY) !== '1') return;
  if (reducedMotion()) return;
  const layer = createLayer();
  const section = root.querySelector('#contact');
  let opened = false;
  const finish = () => {
    if (opened) return;
    opened = true;
    openTunnel(layer, 1500, 'cubic-bezier(0.2, 0.7, 0.2, 1)').catch(() => {
      layer.remove();
    });
  };
  const frame = () => {
    if (!section) return true;
    const rect = section.getBoundingClientRect();
    const view = root.getBoundingClientRect();
    const top = Math.max(rect.top, view.top);
    const bottom = Math.min(rect.bottom, view.bottom);
    return bottom - top > 80;
  };
  if (frame()) {
    window.setTimeout(finish, 180);
    return;
  }
  const watch = new MutationObserver(() => {
    if (!frame()) return;
    watch.disconnect();
    finish();
  });
  watch.observe(root, { attributes: true, attributeFilter: ['data-scroll-offset', 'data-sealed'] });
  window.setTimeout(() => {
    watch.disconnect();
    finish();
  }, 2400);
}

export function consumeContactReturn() {
  return read(RETURN_KEY) === '1';
}
