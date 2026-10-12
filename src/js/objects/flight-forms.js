export function createFlightForms(THREE, level) {
  const low = level === 'low';
  const geometries = [];
  const materials = [];
  const textures = [];
  const box = keep(geometries, new THREE.BoxGeometry(1, 1, 1));
  const plane = keep(geometries, new THREE.PlaneGeometry(1, 1));
  const sphere = keep(geometries, new THREE.SphereGeometry(1, low ? 10 : 18, low ? 8 : 14));
  const torus = keep(geometries, new THREE.TorusGeometry(0.46, 0.016, 8, low ? 28 : 48));
  const crystal = keep(geometries, new THREE.OctahedronGeometry(0.46, 0));
  const poly = keep(geometries, new THREE.IcosahedronGeometry(0.42, 0));

  const glass = keep(materials, new THREE.MeshStandardMaterial({
    color: 0x163044,
    emissive: 0x123044,
    emissiveIntensity: 0.35,
    metalness: 0.72,
    roughness: 0.22,
    transparent: true,
    opacity: 0.92,
  }));
  const cyan = keep(materials, new THREE.MeshStandardMaterial({
    color: 0xd8fbff,
    emissive: 0x3ec6ff,
    emissiveIntensity: 0.85,
    metalness: 0.4,
    roughness: 0.28,
  }));
  const violet = keep(materials, new THREE.MeshStandardMaterial({
    color: 0xf2ecff,
    emissive: 0x7a5cff,
    emissiveIntensity: 0.8,
    metalness: 0.46,
    roughness: 0.24,
  }));
  const white = keep(materials, new THREE.MeshBasicMaterial({
    color: 0xf7fbff,
    transparent: true,
    opacity: 0.92,
  }));
  const line = keep(materials, new THREE.LineBasicMaterial({
    color: 0xb9a6ff,
    transparent: true,
    opacity: 0.85,
  }));
  const points = keep(materials, new THREE.PointsMaterial({
    color: 0x7ee7ff,
    size: low ? 0.045 : 0.035,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    sizeAttenuation: true,
  }));

  const browserMap = paintTexture(THREE, textures, 384, 240, paintBrowser);
  const phoneMap = paintTexture(THREE, textures, 180, 340, paintPhone);
  const dataMap = paintTexture(THREE, textures, 384, 240, paintData);
  const screen = (map) => keep(materials, new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  }));
  const browserScreen = screen(browserMap);
  const phoneScreen = screen(phoneMap);
  const dataScreen = screen(dataMap);

  const actors = [
    browser(THREE, box, plane, glass, browserScreen, 0),
    browser(THREE, box, plane, glass, browserScreen, 1),
    phone(THREE, box, plane, glass, phoneScreen, 0),
    phone(THREE, box, plane, glass, phoneScreen, 1),
    glyph(THREE, textures, materials, plane, '</>', '#7ee7ff', 'slash'),
    glyph(THREE, textures, materials, plane, '{ }', '#f4fbff', 'brace'),
    glyph(THREE, textures, materials, plane, '<html>', '#b9a6ff', 'tag'),
    neural(THREE, geometries, sphere, cyan, violet, line, low),
    rings(THREE, torus, cyan, white, 0),
    rings(THREE, torus, violet, cyan, 1),
    plasma(THREE, sphere, cyan, violet),
    particles(THREE, geometries, points, low),
    solid(THREE, crystal, cyan, 'crystal'),
    solid(THREE, poly, violet, 'poly'),
    panel(THREE, box, plane, glass, dataScreen, 0),
    panel(THREE, box, plane, glass, dataScreen, 1),
  ];

  return { actors, geometries, materials, textures };
}

function keep(list, item) {
  list.push(item);
  return item;
}

function actor(id, object, localPose) {
  object.visible = false;
  object.frustumCulled = false;
  object.renderOrder = 2;
  return {
    id,
    kind: 'form',
    variant: id,
    object,
    ready: true,
    localPose,
  };
}

function browser(THREE, box, plane, glass, screen, index) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(box, glass);
  frame.scale.set(1.28, 0.86, 0.05);
  const face = new THREE.Mesh(plane, screen);
  face.position.z = 0.03;
  face.scale.set(1.16, 0.7, 1);
  group.add(frame, face);
  return actor(`form-browser-${index}`, group);
}

function phone(THREE, box, plane, glass, screen, index) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(box, glass);
  body.scale.set(0.46, 0.92, 0.045);
  const face = new THREE.Mesh(plane, screen);
  face.position.z = 0.028;
  face.scale.set(0.38, 0.76, 1);
  group.add(body, face);
  return actor(`form-phone-${index}`, group);
}

function glyph(THREE, textures, materials, plane, text, color, name) {
  const map = paintTexture(THREE, textures, 256, 256, (context) => {
    context.clearRect(0, 0, 256, 256);
    context.font = '600 78px Consolas, "Segoe UI Mono", monospace';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 132);
  });
  const material = keep(materials, new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  }));
  const mesh = new THREE.Mesh(plane, material);
  mesh.scale.set(0.86, 0.86, 1);
  return actor(`form-code-${name}`, mesh);
}

function neural(THREE, geometries, sphere, cyan, violet, line, low) {
  const group = new THREE.Group();
  const layers = low ? [2, 2, 2] : [2, 3, 2];
  const nodes = [];
  layers.forEach((count, layer) => {
    for (let index = 0; index < count; index += 1) {
      const mesh = new THREE.Mesh(sphere, layer === 1 ? violet : cyan);
      const y = (index - (count - 1) / 2) * 0.34;
      mesh.position.set((layer - 1) * 0.42, y, layer === 1 ? 0.06 : 0);
      mesh.scale.setScalar(0.075);
      mesh.userData.pulse = index + layer;
      group.add(mesh);
      nodes.push(mesh);
    }
  });
  const pairs = [];
  nodes.forEach((from) => {
    nodes.forEach((to) => {
      if (to.position.x > from.position.x + 0.2) {
        pairs.push(from.position.x, from.position.y, from.position.z, to.position.x, to.position.y, to.position.z);
      }
    });
  });
  const geometry = keep(geometries, new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pairs, 3));
  group.add(new THREE.LineSegments(geometry, line));
  return actor('form-neural', group, (progress) => {
    nodes.forEach((node) => {
      const pulse = 0.075 + Math.sin(progress * Math.PI * 2 + node.userData.pulse) * 0.012;
      node.scale.setScalar(pulse);
    });
  });
}

function rings(THREE, torus, primary, secondary, index) {
  const group = new THREE.Group();
  const speeds = [0.55, -0.8, 0.35];
  for (let ringIndex = 0; ringIndex < 3; ringIndex += 1) {
    const mesh = new THREE.Mesh(torus, ringIndex === 1 ? secondary : primary);
    mesh.rotation.x = ringIndex * 0.85;
    mesh.rotation.y = index * 0.4 + ringIndex * 0.3;
    mesh.userData.spin = speeds[ringIndex];
    mesh.userData.baseZ = ringIndex * 0.6;
    group.add(mesh);
  }
  return actor(`form-rings-${index}`, group, (progress, pull, motion) => {
    group.children.forEach((ring) => {
      ring.rotation.z = ring.userData.baseZ + progress * ring.userData.spin * Math.PI * 2 * motion * (1 - pull * 0.35);
    });
  });
}

function plasma(THREE, sphere, cyan, violet) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(sphere, cyan);
  core.scale.setScalar(0.22);
  group.add(core);
  const moons = [];
  for (let index = 0; index < 4; index += 1) {
    const moon = new THREE.Mesh(sphere, index % 2 === 0 ? violet : cyan);
    moon.scale.setScalar(0.05);
    moon.userData.orbit = 0.34 + index * 0.04;
    moon.userData.spin = 0.45 + index * 0.12;
    moon.userData.baseA = index * 1.4;
    group.add(moon);
    moons.push(moon);
  }
  return actor('form-plasma', group, (progress, pull, motion) => {
    moons.forEach((moon) => {
      const angle = moon.userData.baseA + progress * moon.userData.spin * Math.PI * 2 * motion;
      const radius = moon.userData.orbit * (1 - pull * 0.45);
      moon.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72, Math.sin(angle * 0.5) * 0.08);
    });
  });
}

function particles(THREE, geometries, material, low) {
  const count = low ? 16 : 28;
  const positions = [];
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399;
    const radius = 0.12 + (index % 5) * 0.07;
    positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.78, ((index % 7) - 3) * 0.035);
  }
  const geometry = keep(geometries, new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return actor('form-particles', new THREE.Points(geometry, material));
}

function solid(THREE, geometry, material, name) {
  const mesh = new THREE.Mesh(geometry, material);
  return actor(`form-${name}`, mesh);
}

function panel(THREE, box, plane, glass, screen, index) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(box, glass);
  frame.scale.set(1.05, 0.72, 0.04);
  const face = new THREE.Mesh(plane, screen);
  face.position.z = 0.026;
  face.scale.set(0.94, 0.6, 1);
  group.add(frame, face);
  return actor(`form-data-${index}`, group);
}

function paintTexture(THREE, textures, width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.push(texture);
  return texture;
}

function paintBrowser(context, width, height) {
  context.fillStyle = '#071018';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#102033';
  context.fillRect(0, 0, width, 36);
  ['#7ee7ff', '#b9a6ff', '#f4fbff'].forEach((color, index) => {
    context.fillStyle = color;
    context.beginPath();
    context.arc(18 + index * 16, 18, 4, 0, Math.PI * 2);
    context.fill();
  });
  context.fillStyle = '#173044';
  context.fillRect(78, 10, width - 96, 16);
  context.fillStyle = '#123044';
  context.fillRect(18, 54, width - 36, 78);
  context.fillStyle = '#7ee7ff';
  context.fillRect(28, 66, 120, 10);
  context.fillStyle = '#d7e7f2';
  context.fillRect(28, 86, 180, 6);
  context.fillRect(28, 100, 140, 6);
  context.fillStyle = '#24143a';
  context.fillRect(18, 148, (width - 48) / 2, 72);
  context.fillStyle = '#10283a';
  context.fillRect(30 + (width - 48) / 2, 148, (width - 48) / 2, 72);
}

function paintPhone(context, width, height) {
  context.fillStyle = '#071018';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#7ee7ff';
  context.fillRect(16, 28, 70, 8);
  context.fillStyle = '#b9a6ff';
  context.fillRect(16, 48, width - 32, 36);
  for (let row = 0; row < 4; row += 1) {
    context.fillStyle = row % 2 === 0 ? '#10283a' : '#24143a';
    context.fillRect(16, 100 + row * 48, width - 32, 36);
    context.fillStyle = '#f4fbff';
    context.fillRect(26, 112 + row * 48, 48, 6);
  }
}

function paintData(context, width, height) {
  context.fillStyle = '#071018';
  context.fillRect(0, 0, width, height);
  context.font = '600 22px Consolas, monospace';
  context.fillStyle = '#7ee7ff';
  context.fillText('const data = []', 18, 36);
  context.fillStyle = '#f4fbff';
  context.fillText('latency 12ms', 18, 68);
  context.fillStyle = '#b9a6ff';
  context.fillText('nodes 128', 18, 100);
  [0.45, 0.72, 0.38, 0.86, 0.58].forEach((amount, index) => {
    context.fillStyle = index % 2 === 0 ? '#7ee7ff' : '#b9a6ff';
    const barWidth = 28;
    const barHeight = 70 * amount;
    context.fillRect(28 + index * 42, height - 28 - barHeight, barWidth, barHeight);
  });
}
