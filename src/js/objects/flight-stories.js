const SERVICES = [
  'בניית אתרים',
  'פיתוח אפליקציות',
  'דפי נחיתה',
  'מערכות ניהול',
  'מערכות הזמנות',
  'מערכות CRM',
  'אוטומציות עסקיות',
  'פתרונות AI',
  'ממשקי משתמש',
  'חנויות אונליין',
  'דשבורדים',
  'אינטגרציות API',
  'מערכות מותאמות אישית',
  'חוויית משתמש UI/UX',
  'פיתוח Frontend',
  'פיתוח Backend',
  'פתרונות לעסקים',
  'מערכות דיגיטליות מתקדמות',
];

const SNIPPETS = [
  "const app = createApp()",
  "fetch('/api/data')",
  'async function loadData()',
  'display: grid',
  'transform: translate3d()',
  "addEventListener('scroll', ...)",
];

const TERMS = [
  'HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'API', 'REST API',
  'JSON', 'Git', 'GitHub', 'UI/UX', 'Frontend', 'Backend', 'Database', 'SQL',
  'Authentication', 'Automation', 'Artificial Intelligence', 'Machine Learning',
  'Responsive Design', 'Performance', 'Security', 'Cloud', 'Web Development',
  'Mobile Apps', 'Digital Systems', 'Creative Technology',
];

export function createFlightStories(THREE) {
  const services = SERVICES.map((label, index) => makePanel(THREE, label, index, index % 2 === 0 ? 'glass' : 'metal'));
  const snippets = SNIPPETS.map((label, index) => makePanel(THREE, label, index, index % 2 === 0 ? 'code' : 'plate'));
  const terms = TERMS.map((label, index) => (index % 2 === 0
    ? makeWord(THREE, label, index, 'float')
    : makePanel(THREE, label, index, 'frame')));
  const stories = [];
  let service = 0;
  let term = 0;
  let snippet = 0;
  while (service < services.length || term < terms.length || snippet < snippets.length) {
    if (service < services.length) stories.push(services[service]);
    service += 1;
    if (term < terms.length) stories.push(terms[term]);
    term += 1;
    if (snippet < snippets.length) stories.push(snippets[snippet]);
    snippet += 1;
    if (term < terms.length) stories.push(terms[term]);
    term += 1;
  }
  return stories;
}

export function weaveStories(actors, stories) {
  const images = actors.slice();
  const total = images.length + stories.length;
  const slots = new Array(total);
  const used = new Set();
  stories.forEach((story, index) => {
    let at = Math.round(((index + 0.5) * (total - 1)) / stories.length);
    while (used.has(at) && at < total - 1) at += 1;
    used.add(at);
    slots[at] = story;
  });
  let image = 0;
  for (let index = 0; index < total; index += 1) {
    if (!slots[index]) slots[index] = images[image];
    image += slots[index] === images[image] ? 1 : 0;
  }
  actors.splice(0, actors.length, ...slots);
}

function makePanel(THREE, label, index, variant) {
  const code = variant === 'code' || variant === 'plate';
  const layout = layoutText(label, {
    font: code ? '600 42px Consolas, "Segoe UI Mono", monospace' : '600 54px Rubik, "Segoe UI", sans-serif',
    minFont: code ? 34 : 44,
    direction: code ? 'ltr' : 'rtl',
    padX: 72,
    padY: 64,
    maxWidth: code ? 980 : 860,
  });
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  drawPanel(canvas.getContext('2d'), layout, variant);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const glass = variant === 'glass' || variant === 'metal' || variant === 'frame';
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    roughness: glass ? 0.18 : 0.42,
    metalness: variant === 'metal' ? 0.78 : 0.48,
    emissive: new THREE.Color(variant === 'metal' ? 0x24143a : 0x0c2438),
    emissiveIntensity: 0.26,
    depthWrite: false,
    toneMapped: true,
  });
  const planeH = layout.lines.length > 1 ? 1.16 : 0.86;
  const planeW = planeH * (canvas.width / canvas.height);
  const geometry = new THREE.PlaneGeometry(planeW, planeH);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return {
    id: `${variant}-${index}`,
    kind: variant === 'frame' ? 'word' : 'card',
    variant,
    label,
    object: mesh,
    material,
    geometry,
    texture,
    aspect: 1,
    ready: true,
  };
}

function makeWord(THREE, label, index, variant) {
  const layout = layoutText(label, {
    font: '600 64px Rubik, "Segoe UI", sans-serif',
    minFont: 48,
    direction: 'ltr',
    padX: 24,
    padY: 28,
    maxWidth: 920,
  });
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = layout.font;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.direction = 'ltr';
  context.fillStyle = index % 2 === 0 ? '#f4fbff' : '#b9a6ff';
  drawLines(context, layout, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const planeH = 0.42 * Math.max(1, layout.lines.length * 0.82);
  const planeW = planeH * (canvas.width / canvas.height);
  const geometry = new THREE.PlaneGeometry(planeW, planeH);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return {
    id: `word-${index}`,
    kind: 'word',
    variant,
    label,
    object: mesh,
    material,
    geometry,
    texture,
    aspect: 1,
    ready: true,
  };
}

function layoutText(label, options) {
  const probe = document.createElement('canvas').getContext('2d');
  let size = Number(options.font.match(/(\d+)px/)[1]);
  let font = options.font;
  let lines = [];
  let width = options.maxWidth;
  while (size >= options.minFont) {
    font = options.font.replace(/(\d+)px/, `${size}px`);
    probe.font = font;
    probe.direction = options.direction;
    lines = wrapLines(probe, label, options.maxWidth - options.padX * 2);
    const widest = Math.max(...lines.map((line) => probe.measureText(line).width));
    width = Math.ceil(widest + options.padX * 2);
    if (widest <= options.maxWidth - options.padX * 2) break;
    size -= 4;
  }
  const lineHeight = Math.round(size * 1.28);
  const height = Math.max(150, options.padY * 2 + lineHeight * lines.length);
  return { font, lines, lineHeight, width: Math.max(280, width), height, padY: options.padY };
}

function wrapLines(context, label, maxWidth) {
  const words = label.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [label];
}

function drawLines(context, layout, x, y) {
  const block = layout.lineHeight * layout.lines.length;
  let cursor = y - block / 2 + layout.lineHeight / 2;
  layout.lines.forEach((line) => {
    context.fillText(line, x, cursor);
    cursor += layout.lineHeight;
  });
}

function drawPanel(context, layout, variant) {
  const { width, height } = layout;
  context.clearRect(0, 0, width, height);
  const accent = variant === 'metal' || variant === 'plate' ? '#c9b6ff' : '#7ee7ff';
  const code = variant === 'code' || variant === 'plate';
  roundRect(context, 10, 10, width - 20, height - 20, 28);
  context.fillStyle = variant === 'frame' ? 'rgba(8, 12, 20, 0.28)' : 'rgba(6, 10, 16, 0.94)';
  context.fill();
  context.strokeStyle = accent;
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = accent;
  context.fillRect(36, 36, 54, 3);
  context.font = layout.font;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.direction = code ? 'ltr' : 'rtl';
  context.fillStyle = code ? '#d7fff4' : '#f7fbff';
  drawLines(context, layout, width / 2, height / 2 + 8);
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
