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

function createLayer(background) {
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.position = 'fixed';
  layer.style.inset = '0';
  layer.style.zIndex = '2147483000';
  layer.style.background = background;
  layer.style.pointerEvents = 'auto';
  layer.style.transform = 'none';
  document.body.appendChild(layer);
  return layer;
}

function flash(layer) {
  const frames = ['#000000', '#ffffff', '#000000', '#ffffff', '#000000', '#ffffff', '#000000', '#ffffff', '#000000'];
  let chain = Promise.resolve();
  frames.forEach((color, index) => {
    chain = chain.then(() => {
      layer.style.background = color;
      layer.style.transform = index % 2 === 0 ? 'translate(-3px, 2px) scale(1.01)' : 'translate(3px, -2px) scale(0.99)';
      return wait(78);
    });
  });
  return chain.then(() => {
    layer.style.transform = 'none';
  });
}

function whenPainted(work) {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const result = work();
        if (result && typeof result.then === 'function') result.then(resolve);
        else resolve();
      });
    });
  });
}

function runAnimation(element, keyframes, options) {
  const duration = options.duration || 0;
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      const animation = element.animate(keyframes, options);
      animation.onfinish = finish;
      animation.oncancel = finish;
    } catch (error) {
      window.setTimeout(finish, duration);
      return;
    }
    window.setTimeout(finish, duration + 60);
  });
}

function suckPage(flashLayer, duration, easing) {
  flashLayer.remove();
  const backdrop = createLayer('#000000');
  backdrop.style.zIndex = '1';
  const page = document.getElementById('experience');
  if (!page) return wait(duration);
  page.style.zIndex = '2';
  page.style.transformOrigin = '50% 50%';
  return runAnimation(
    page,
    [
      { transform: 'scale(1)' },
      { transform: 'scale(0.12)', offset: 0.7 },
      { transform: 'scale(0)' },
    ],
    { duration, easing, fill: 'forwards' }
  );
}

function portal(layer) {
  const disk = document.createElement('div');
  disk.style.position = 'absolute';
  disk.style.left = '50%';
  disk.style.top = '50%';
  disk.style.width = '48px';
  disk.style.height = '48px';
  disk.style.borderRadius = '50%';
  disk.style.background = 'transparent';
  disk.style.boxShadow = '0 0 0 120vmax #000000';
  layer.style.background = 'transparent';
  layer.appendChild(disk);
  return disk;
}

function openFromPoint(layer, duration, easing) {
  const disk = portal(layer);
  return runAnimation(
    disk,
    [
      { transform: 'translate(-50%, -50%) scale(0.08)' },
      { transform: 'translate(-50%, -50%) scale(70)' },
    ],
    { duration, easing, fill: 'forwards' }
  ).then(() => {
    layer.remove();
  });
}

function swallowToPoint(layer, duration, easing) {
  const disk = portal(layer);
  return runAnimation(
    disk,
    [
      { transform: 'translate(-50%, -50%) scale(70)' },
      { transform: 'translate(-50%, -50%) scale(0.08)' },
    ],
    { duration, easing, fill: 'forwards' }
  );
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

function coverLayer() {
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.position = 'fixed';
  layer.style.top = '0';
  layer.style.right = '0';
  layer.style.bottom = '0';
  layer.style.left = '0';
  layer.style.width = '100%';
  layer.style.height = '100%';
  layer.style.zIndex = '2147483646';
  layer.style.background = 'transparent';
  layer.style.pointerEvents = 'auto';
  layer.style.margin = '0';
  document.body.appendChild(layer);
  return layer;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function textPieces(element, mode) {
  const pieces = [];
  if (!element) return pieces;
  const style = getComputedStyle(element);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue || '';
    let index = 0;
    while (index < value.length) {
      let end = index + 1;
      if (mode === 'word') {
        while (end < value.length && value[end] !== ' ') end += 1;
      }
      const sample = value.slice(index, end);
      if (sample.trim() !== '') {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, end);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0.5 && rect.height > 0.5) pieces.push({ rect, text: sample, style });
      }
      index = end;
      while (value[index] === ' ') index += 1;
    }
    node = walker.nextNode();
  }
  return pieces;
}

function fixedPiece(text, rect, style, extra) {
  const node = document.createElement('span');
  node.textContent = text;
  node.style.position = 'absolute';
  node.style.left = `${rect.left}px`;
  node.style.top = `${rect.top}px`;
  node.style.width = `${rect.width}px`;
  node.style.height = `${rect.height}px`;
  node.style.margin = '0';
  node.style.display = 'flex';
  node.style.alignItems = 'center';
  node.style.justifyContent = 'center';
  node.style.font = style.font;
  node.style.color = style.color;
  node.style.letterSpacing = style.letterSpacing;
  node.style.lineHeight = '1';
  node.style.whiteSpace = 'pre';
  node.style.transformOrigin = '50% 50%';
  node.style.zIndex = '10';
  node.style.opacity = '1';
  node.style.visibility = 'visible';
  if (extra) extra(node, style);
  return node;
}

function framePoints(rect, radius, count) {
  const r = Math.min(radius, rect.width / 2, rect.height / 2);
  const left = rect.left;
  const top = rect.top;
  const width = rect.width;
  const height = rect.height;
  const straight = Math.max(0, width - r * 2) * 2 + Math.max(0, height - r * 2) * 2;
  const total = straight + Math.PI * 2 * r;
  const points = [];
  for (let index = 0; index < count; index += 1) {
    let distance = (index / count) * total;
    const topLen = Math.max(0, width - r * 2);
    const sideLen = Math.max(0, height - r * 2);
    const corner = Math.PI * r / 2;
    let x = left + r;
    let y = top;
    let angle = 0;
    if (distance <= topLen) {
      x = left + r + distance;
      y = top;
      angle = 0;
    } else if ((distance -= topLen) <= corner) {
      const a = -Math.PI / 2 + distance / r;
      x = left + width - r + Math.cos(a) * r;
      y = top + r + Math.sin(a) * r;
      angle = a + Math.PI / 2;
    } else if ((distance -= corner) <= sideLen) {
      x = left + width;
      y = top + r + distance;
      angle = Math.PI / 2;
    } else if ((distance -= sideLen) <= corner) {
      const a = distance / r;
      x = left + width - r + Math.cos(a) * r;
      y = top + height - r + Math.sin(a) * r;
      angle = a + Math.PI / 2;
    } else if ((distance -= corner) <= topLen) {
      x = left + width - r - distance;
      y = top + height;
      angle = Math.PI;
    } else if ((distance -= topLen) <= corner) {
      const a = Math.PI / 2 + distance / r;
      x = left + r + Math.cos(a) * r;
      y = top + height - r + Math.sin(a) * r;
      angle = a + Math.PI / 2;
    } else if ((distance -= corner) <= sideLen) {
      x = left;
      y = top + height - r - distance;
      angle = -Math.PI / 2;
    } else {
      distance -= sideLen;
      const a = Math.PI + distance / Math.max(r, 1);
      x = left + r + Math.cos(a) * r;
      y = top + r + Math.sin(a) * r;
      angle = a + Math.PI / 2;
    }
    points.push({ x, y, angle });
  }
  return points;
}

function playCalmShift() {
  const veil = coverLayer();
  veil.style.background = '#000000';
  veil.style.opacity = '0';
  const duration = 460;
  const start = performance.now();
  return new Promise((resolve) => {
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      veil.style.opacity = String(t);
      if (t < 1) window.requestAnimationFrame(frame);
      else resolve();
    };
    window.requestAnimationFrame(frame);
  });
}

function playWorldShift() {
  const section = document.querySelector('[data-contact]');
  const frameBox = section ? section.querySelector('.contact__frame') : null;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const stage = coverLayer();
  stage.style.background = 'transparent';
  stage.style.overflow = 'visible';
  const vignette = document.createElement('div');
  vignette.style.position = 'absolute';
  vignette.style.inset = '0';
  vignette.style.background = '#000000';
  vignette.style.opacity = '0';
  vignette.style.zIndex = '1';
  stage.appendChild(vignette);
  const hole = document.createElement('div');
  hole.style.position = 'absolute';
  hole.style.left = `${cx}px`;
  hole.style.top = `${cy}px`;
  hole.style.width = '90px';
  hole.style.height = '90px';
  hole.style.margin = '-45px 0 0 -45px';
  hole.style.borderRadius = '50%';
  hole.style.background = 'radial-gradient(circle, #000000 0 42%, rgba(7, 18, 24, 0.96) 68%, transparent 74%)';
  hole.style.boxShadow = '0 0 36px 10px rgba(0, 0, 0, 0.85), inset 0 0 16px rgba(126, 231, 255, 0.28)';
  hole.style.transform = 'scale(0.2)';
  hole.style.zIndex = '2';
  stage.appendChild(hole);
  const bloom = document.createElement('div');
  bloom.style.position = 'absolute';
  bloom.style.left = `${cx}px`;
  bloom.style.top = `${cy}px`;
  bloom.style.width = '48px';
  bloom.style.height = '48px';
  bloom.style.margin = '-24px 0 0 -24px';
  bloom.style.borderRadius = '50%';
  bloom.style.background = '#ffffff';
  bloom.style.boxShadow = '0 0 48px 16px rgba(255, 255, 255, 0.45)';
  bloom.style.transform = 'scale(0)';
  bloom.style.opacity = '0';
  bloom.style.zIndex = '12';
  stage.appendChild(bloom);
  const rings = [0, 1, 2].map((index) => {
    const ring = document.createElement('div');
    ring.style.position = 'absolute';
    ring.style.left = `${cx}px`;
    ring.style.top = `${cy}px`;
    ring.style.width = `${150 + index * 70}px`;
    ring.style.height = `${150 + index * 70}px`;
    ring.style.marginLeft = `${-(75 + index * 35)}px`;
    ring.style.marginTop = `${-(75 + index * 35)}px`;
    ring.style.borderRadius = '50%';
    ring.style.border = '1px solid rgba(126, 231, 255, 0.28)';
    ring.style.transform = 'scale(0.4)';
    ring.style.zIndex = '2';
    stage.appendChild(ring);
    return ring;
  });
  const actors = [];
  const hide = [];
  function addText(selector, mode, options) {
    section.querySelectorAll(selector).forEach((element) => {
      hide.push(element);
      textPieces(element, mode).forEach((piece, index) => {
        const node = fixedPiece(piece.text, piece.rect, piece.style);
        stage.appendChild(node);
        actors.push({
          node,
          ox: piece.rect.left + piece.rect.width / 2,
          oy: piece.rect.top + piece.rect.height / 2,
          delay: Math.min(0.3, options.delay + index * options.step),
          span: options.span,
          spin: options.spin * (index % 2 === 0 ? 1 : -1),
          arc: options.arc * (index % 2 === 0 ? 1 : -1),
        });
      });
    });
  }
  if (section) {
    addText('.contact__line', 'char', { delay: 0.16, step: 0.012, span: 0.5, spin: 240, arc: 18 });
    addText('.contact__kicker, .contact__lead, .contact__note, .site-footer p', 'word', { delay: 0.14, step: 0.015, span: 0.46, spin: 90, arc: 28 });
    const button = section.querySelector('.contact__cta');
    if (button) {
      hide.push(button);
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      const node = fixedPiece(button.textContent || '', rect, style, (chip) => {
        chip.style.border = `${style.borderWidth} ${style.borderStyle} ${style.borderColor}`;
        chip.style.borderRadius = style.borderRadius;
        chip.style.background = style.backgroundColor;
        chip.style.width = `${rect.width}px`;
        chip.style.height = `${rect.height}px`;
      });
      stage.appendChild(node);
      actors.push({
        node,
        ox: rect.left + rect.width / 2,
        oy: rect.top + rect.height / 2,
        delay: 0.2,
        span: 0.52,
        spin: 520,
        arc: 36,
      });
    }
    if (frameBox) {
      const rect = frameBox.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(frameBox).borderTopLeftRadius) || 0;
      const color = getComputedStyle(frameBox).borderTopColor || 'rgba(126, 231, 255, 0.28)';
      const samples = framePoints(rect, radius, 48);
      const tick = Math.max(10, (rect.width + rect.height) * 2 / samples.length);
      samples.forEach((point, index) => {
        const bit = document.createElement('span');
        bit.style.position = 'absolute';
        bit.style.left = `${point.x}px`;
        bit.style.top = `${point.y}px`;
        bit.style.width = `${tick}px`;
        bit.style.height = '2px';
        bit.style.margin = `-1px 0 0 ${-tick / 2}px`;
        bit.style.background = color;
        bit.style.transformOrigin = '50% 50%';
        bit.style.zIndex = '8';
        bit.style.opacity = '1';
        bit.style.transform = `rotate(${point.angle}rad)`;
        stage.appendChild(bit);
        actors.push({
          node: bit,
          ox: point.x,
          oy: point.y,
          delay: 0.2 + index * 0.003,
          span: 0.5,
          spin: 160,
          arc: 10,
          base: `rotate(${point.angle}rad)`,
        });
      });
    }
  }
  const duration = 2100;
  const start = performance.now();
  let sourcesHidden = false;
  return new Promise((resolve) => {
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      if (!sourcesHidden && t > 0.04 && actors.length > 0) {
        sourcesHidden = true;
        hide.forEach((element) => {
          element.style.visibility = 'hidden';
        });
      }
      const depth = clamp01((t - 0.14) / 0.62);
      const open = clamp01((t - 0.8) / 0.2);
      const openEase = 1 - (1 - open) * (1 - open);
      vignette.style.opacity = String(clamp01((t - 0.8) / 0.12));
      hole.style.opacity = String(clamp01((t - 0.08) / 0.18) * (1 - openEase));
      hole.style.transform = `scale(${(0.25 + depth * 2.1 + open * 0.6).toFixed(3)})`;
      rings.forEach((ring, index) => {
        const spin = (depth + open) * (18 + index * 10);
        ring.style.opacity = String(clamp01((t - 0.1) / 0.2) * (0.35 + depth * 0.4) * (1 - openEase));
        ring.style.transform = `scale(${(0.55 + depth * 1.3 - open * 0.45).toFixed(3)}) rotate(${spin.toFixed(2)}deg)`;
      });
      bloom.style.opacity = open > 0 ? '1' : '0';
      bloom.style.transform = `scale(${(openEase * 70).toFixed(3)})`;
      if (frameBox && t > 0.28 && frameBox.dataset.folded !== 'true') {
        frameBox.dataset.folded = 'true';
        frameBox.style.background = 'transparent';
        frameBox.style.borderColor = 'transparent';
        frameBox.style.boxShadow = 'none';
      }
      actors.forEach((actor) => {
        const p = clamp01((t - actor.delay) / actor.span);
        const pull = p * p * p;
        actor.node.style.opacity = '1';
        actor.node.style.visibility = 'visible';
        const x = (cx - actor.ox) * pull + Math.sin(p * Math.PI) * actor.arc;
        const y = (cy - actor.oy) * pull;
        const scale = Math.max(0.02, 1 - pull * 0.98);
        const tangent = actor.base || '';
        actor.node.style.opacity = String(pull > 0.9 ? 1 - (pull - 0.9) / 0.1 : 1);
        actor.node.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotateY(${(pull * actor.spin * 0.45).toFixed(2)}deg) rotateZ(${(pull * actor.spin).toFixed(2)}deg) scale(${scale.toFixed(3)}) ${tangent}`;
      });
      if (t < 1) window.requestAnimationFrame(frame);
      else resolve();
    };
    window.requestAnimationFrame(frame);
  });
}

export function bindContactPassage(anchor) {
  if (!anchor || anchor.dataset.passageBound === 'true') return;
  anchor.dataset.passageBound = 'true';
  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    if (anchor.dataset.passage === 'running') return;
    anchor.dataset.passage = 'running';
    remember(ARRIVE_KEY, '1');
    playWorldShift().then(() => {
      window.location.href = 'contact.html';
    });
  });
}

export function revealContactPage() {
  const arriving = read(ARRIVE_KEY) === '1';
  if (arriving) clear(ARRIVE_KEY);
  if (!arriving) {
    document.documentElement.classList.remove('passage-cover');
    return;
  }
  const layer = coverLayer();
  layer.style.background = '#ffffff';
  document.documentElement.classList.remove('passage-cover');
  const duration = 220;
  const start = performance.now();
  const fade = (now) => {
    const t = Math.min(1, (now - start) / duration);
    layer.style.opacity = String(1 - t);
    if (t < 1) window.requestAnimationFrame(fade);
    else layer.remove();
  };
  window.requestAnimationFrame(fade);
}

export function departContactPage() {
  remember(RETURN_KEY, '1');
  remember(OPENING_SEEN_KEY, '1');
  if (reducedMotion()) {
    window.location.href = 'index.html';
    return;
  }
  const layer = createLayer('transparent');
  swallowToPoint(layer, 1100, 'cubic-bezier(0.4, 0, 0.2, 1)')
    .then(() => {
      window.location.href = 'index.html';
    });
}

export function landOnPortfolio(root) {
  if (read(RETURN_KEY) !== '1' || read(OPENING_SEEN_KEY) !== '1') return;
  if (reducedMotion()) return;
  const layer = createLayer('#000000');
  const section = root.querySelector('#contact');
  let opened = false;
  const finish = () => {
    if (opened) return;
    opened = true;
    openFromPoint(layer, 1500, 'cubic-bezier(0.2, 0.7, 0.2, 1)').then(() => {
      if (layer.isConnected) layer.remove();
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
