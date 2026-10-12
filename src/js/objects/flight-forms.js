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
  const cylinder = keep(geometries, new THREE.CylinderGeometry(1, 1, 1, low ? 8 : 16));
  const cone = keep(geometries, new THREE.ConeGeometry(1, 1, low ? 8 : 14));
  const prism = keep(geometries, new THREE.CylinderGeometry(0.22, 0.22, 0.72, 3));

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
  const amber = keep(materials, new THREE.MeshStandardMaterial({
    color: 0xffe1b0,
    emissive: 0xff8a3d,
    emissiveIntensity: 0.7,
    metalness: 0.35,
    roughness: 0.32,
  }));
  const windowLit = keep(materials, new THREE.MeshBasicMaterial({
    color: 0x9aefff,
    transparent: true,
    opacity: 0.95,
    toneMapped: false,
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
    ...worldForms(THREE, {
      low, geometries, materials, box, plane, sphere, torus, cylinder, cone, prism, cyan, violet, white, glass, amber, windowLit, line,
    }),
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

function worldForms(THREE, kit) {
  return [
    digitalCity(THREE, kit),
    globe(THREE, kit),
    infinityMark(THREE, kit),
    prisms(THREE, kit),
    robotHand(THREE, kit),
    soundRig(THREE, kit),
    dnaHelix(THREE, kit),
    chip(THREE, kit),
    cameraBody(THREE, kit),
    clockwork(THREE, kit),
    rocket(THREE, kit),
    compass(THREE, kit),
    maze(THREE, kit),
    geometricHeart(THREE, kit),
    layerCube(THREE, kit),
    digitalKey(THREE, kit),
    antenna(THREE, kit),
    starSystem(THREE, kit),
    floatingGates(THREE, kit),
    skyLantern(THREE, kit),
  ];
}

function addBox(THREE, group, box, material, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(box, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  group.add(mesh);
  return mesh;
}

function digitalCity(THREE, kit) {
  const group = new THREE.Group();
  const heights = kit.low ? [0.42, 0.7, 0.5, 0.84, 0.46] : [0.34, 0.58, 0.46, 0.82, 0.4, 0.68, 0.52];
  heights.forEach((height, index) => {
    const x = (index - (heights.length - 1) / 2) * 0.18;
    const z = index % 2 === 0 ? -0.06 : 0.1;
    addBox(THREE, group, kit.box, kit.glass, x, height / 2 - 0.4, z, 0.14, height, 0.14);
    const glow = new THREE.Mesh(kit.plane, kit.windowLit);
    glow.position.set(x, height / 2 - 0.46, z + 0.075);
    glow.scale.set(0.06, 0.08, 1);
    group.add(glow);
  });
  return actor('form-city', group);
}

function globe(THREE, kit) {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  const body = new THREE.Mesh(kit.sphere, kit.cyan);
  body.scale.setScalar(0.32);
  spin.add(body);
  for (let index = 0; index < 3; index += 1) {
    const ring = new THREE.Mesh(kit.torus, index === 1 ? kit.violet : kit.white);
    ring.scale.setScalar(0.32 / 0.46);
    ring.rotation.x = index * 0.9;
    ring.rotation.y = index * 0.4;
    spin.add(ring);
  }
  group.add(spin);
  return actor('form-globe', group, (progress, pull, motion) => {
    spin.rotation.y = progress * Math.PI * 2 * 0.4 * motion * (1 - pull * 0.3);
  });
}

function infinityMark(THREE, kit) {
  const points = [];
  const count = kit.low ? 28 : 48;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const denom = 1 + Math.sin(angle) * Math.sin(angle);
    points.push(new THREE.Vector3(
      (Math.cos(angle) / denom) * 0.58,
      ((Math.sin(angle) * Math.cos(angle)) / denom) * 0.58,
      0
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points, true);
  const geometry = keep(kit.geometries, new THREE.TubeGeometry(curve, kit.low ? 40 : 72, 0.028, 6, true));
  const mesh = new THREE.Mesh(geometry, kit.violet);
  return actor('form-infinity', mesh);
}

function prisms(THREE, kit) {
  const group = new THREE.Group();
  const colors = [0x7ee7ff, 0xb9a6ff, 0xffb25e];
  colors.forEach((color, index) => {
    const material = keep(kit.materials, kit.low
      ? new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.48,
        roughness: 0.08,
        metalness: 0.12,
      })
      : new THREE.MeshPhysicalMaterial({
        color,
        transmission: 0.82,
        thickness: 0.45,
        roughness: 0.08,
        metalness: 0.04,
        transparent: true,
      }));
    const mesh = new THREE.Mesh(kit.prism, material);
    mesh.position.x = (index - 1) * 0.28;
    mesh.rotation.z = (index - 1) * 0.35;
    mesh.rotation.y = index * 0.4;
    group.add(mesh);
  });
  return actor('form-prisms', group);
}

function robotHand(THREE, kit) {
  const group = new THREE.Group();
  addBox(THREE, group, kit.box, kit.glass, 0, -0.05, 0, 0.46, 0.22, 0.1);
  for (let finger = 0; finger < 4; finger += 1) {
    const x = -0.16 + finger * 0.11;
    addBox(THREE, group, kit.box, kit.cyan, x, 0.18, 0, 0.06, 0.16, 0.06);
    addBox(THREE, group, kit.box, kit.violet, x, 0.34, 0, 0.05, 0.14, 0.05);
  }
  addBox(THREE, group, kit.box, kit.amber, -0.28, 0.08, 0.04, 0.08, 0.16, 0.06);
  return actor('form-hand', group);
}

function soundRig(THREE, kit) {
  const group = new THREE.Group();
  const bars = [];
  const count = kit.low ? 4 : 6;
  for (let index = 0; index < count; index += 1) {
    const height = 0.22 + (index % 3) * 0.16;
    const bar = addBox(THREE, group, kit.box, index % 2 === 0 ? kit.cyan : kit.violet, (index - (count - 1) / 2) * 0.14, height / 2 - 0.28, 0, 0.08, height, 0.08);
    bar.userData.base = height;
    bar.userData.phase = index * 0.7;
    bars.push(bar);
  }
  const samples = [];
  for (let index = 0; index <= 16; index += 1) {
    const x = -0.42 + (index / 16) * 0.84;
    samples.push(x, Math.sin(index * 0.7) * 0.1 + 0.28, 0.04);
  }
  const geometry = keep(kit.geometries, new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(samples, 3));
  group.add(new THREE.Line(geometry, kit.line));
  const head = new THREE.Mesh(kit.torus, kit.white);
  head.scale.setScalar(0.16);
  head.position.set(0.34, 0.18, 0);
  addBox(THREE, group, kit.box, kit.white, 0.42, 0.02, 0, 0.025, 0.22, 0.025);
  group.add(head);
  return actor('form-sound', group, (progress, pull, motion) => {
    bars.forEach((bar) => {
      const amount = 0.45 + 0.55 * Math.abs(Math.sin(progress * Math.PI * 2 * motion + bar.userData.phase));
      bar.scale.y = bar.userData.base * amount * (1 - pull * 0.35);
    });
  });
}

function dnaHelix(THREE, kit) {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  const steps = kit.low ? 6 : 10;
  for (let index = 0; index < steps; index += 1) {
    const angle = index * 0.72;
    const y = (index - (steps - 1) / 2) * 0.08;
    const ax = Math.cos(angle) * 0.2;
    const az = Math.sin(angle) * 0.2;
    const left = new THREE.Mesh(kit.sphere, kit.cyan);
    const right = new THREE.Mesh(kit.sphere, kit.violet);
    left.scale.setScalar(0.045);
    right.scale.setScalar(0.045);
    left.position.set(ax, y, az);
    right.position.set(-ax, y, -az);
    spin.add(left, right);
    addBox(THREE, spin, kit.box, kit.white, 0, y, 0, Math.abs(ax) * 2, 0.012, 0.012);
  }
  group.add(spin);
  return actor('form-dna', group, (progress, pull, motion) => {
    spin.rotation.y = progress * Math.PI * 2 * 0.35 * motion * (1 - pull * 0.25);
  });
}

function chip(THREE, kit) {
  const group = new THREE.Group();
  addBox(THREE, group, kit.box, kit.glass, 0, 0, 0, 0.78, 0.56, 0.06);
  addBox(THREE, group, kit.box, kit.cyan, 0, 0, 0.04, 0.22, 0.22, 0.02);
  const pins = kit.low ? 4 : 6;
  for (let index = 0; index < pins; index += 1) {
    const y = -0.2 + (index / (pins - 1)) * 0.4;
    addBox(THREE, group, kit.box, kit.amber, -0.46, y, 0, 0.12, 0.035, 0.02);
    addBox(THREE, group, kit.box, kit.amber, 0.46, y, 0, 0.12, 0.035, 0.02);
  }
  const traces = [
    -0.22, 0.1, 0.05, -0.02, 0.1, 0.05,
    -0.02, 0.1, 0.05, 0.14, -0.08, 0.05,
    0.14, -0.08, 0.05, 0.26, -0.08, 0.05,
  ];
  const geometry = keep(kit.geometries, new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(traces, 3));
  const circuit = new THREE.Line(geometry, kit.line);
  circuit.position.z = 0.04;
  group.add(circuit);
  return actor('form-chip', group);
}

function cameraBody(THREE, kit) {
  const group = new THREE.Group();
  addBox(THREE, group, kit.box, kit.glass, 0, 0, 0, 0.72, 0.42, 0.28);
  const lens = new THREE.Mesh(kit.cylinder, kit.cyan);
  lens.scale.set(0.16, 0.18, 0.16);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, 0.2);
  const ring = new THREE.Mesh(kit.torus, kit.white);
  ring.scale.setScalar(0.28);
  ring.position.z = 0.28;
  addBox(THREE, group, kit.box, kit.violet, 0.16, 0.28, -0.02, 0.22, 0.1, 0.16);
  group.add(lens, ring);
  return actor('form-camera', group);
}

function clockwork(THREE, kit) {
  const group = new THREE.Group();
  const teeth = kit.low ? 8 : 12;
  const shape = new THREE.Shape();
  for (let index = 0; index < teeth; index += 1) {
    const start = (index / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    const root = 0.28;
    const tip = 0.4;
    const point = (angle, radius) => [Math.cos(angle) * radius, Math.sin(angle) * radius];
    const a = point(start, root);
    const b = point(start + step * 0.35, tip);
    const c = point(start + step * 0.7, tip);
    const d = point(start + step, root);
    if (index === 0) shape.moveTo(a[0], a[1]);
    else shape.lineTo(a[0], a[1]);
    shape.lineTo(b[0], b[1]);
    shape.lineTo(c[0], c[1]);
    shape.lineTo(d[0], d[1]);
  }
  const geometry = keep(kit.geometries, new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false }));
  const large = new THREE.Mesh(geometry, kit.cyan);
  const small = new THREE.Mesh(geometry, kit.violet);
  small.scale.setScalar(0.62);
  small.position.set(0.52, -0.08, 0.02);
  const minute = new THREE.Group();
  const hour = new THREE.Group();
  addBox(THREE, minute, kit.box, kit.white, 0.12, 0, 0.08, 0.24, 0.02, 0.02);
  addBox(THREE, hour, kit.box, kit.amber, 0.08, 0, 0.1, 0.16, 0.02, 0.02);
  group.add(large, small, minute, hour);
  return actor('form-clock', group, (progress, pull, motion) => {
    const turn = progress * Math.PI * 2 * 0.3 * motion * (1 - pull * 0.3);
    large.rotation.z = turn;
    small.rotation.z = -turn * 1.6;
    minute.rotation.z = turn * 2;
    hour.rotation.z = turn * 0.45;
  });
}

function rocket(THREE, kit) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(kit.cylinder, kit.glass);
  body.scale.set(0.12, 0.46, 0.12);
  const nose = new THREE.Mesh(kit.cone, kit.cyan);
  nose.scale.set(0.12, 0.22, 0.12);
  nose.position.y = 0.32;
  const flame = new THREE.Mesh(kit.cone, kit.amber);
  flame.scale.set(0.08, 0.16, 0.08);
  flame.rotation.x = Math.PI;
  flame.position.y = -0.3;
  group.add(body, nose, flame);
  addBox(THREE, group, kit.box, kit.violet, -0.14, -0.16, 0, 0.1, 0.16, 0.03);
  addBox(THREE, group, kit.box, kit.violet, 0.14, -0.16, 0, 0.1, 0.16, 0.03);
  return actor('form-rocket', group, (progress, pull, motion) => {
    const flicker = 0.75 + 0.25 * Math.abs(Math.sin(progress * Math.PI * 4 * motion));
    flame.scale.y = 0.16 * flicker * (1 - pull * 0.5);
  });
}

function compass(THREE, kit) {
  const group = new THREE.Group();
  const bezel = new THREE.Mesh(kit.torus, kit.white);
  bezel.scale.setScalar(0.72);
  const needle = new THREE.Mesh(kit.cone, kit.amber);
  needle.scale.set(0.06, 0.28, 0.06);
  needle.position.y = 0.08;
  const south = new THREE.Mesh(kit.cone, kit.violet);
  south.scale.set(0.05, 0.18, 0.05);
  south.rotation.x = Math.PI;
  south.position.y = -0.06;
  const hub = new THREE.Mesh(kit.sphere, kit.cyan);
  hub.scale.setScalar(0.06);
  group.add(bezel, needle, south, hub);
  return actor('form-compass', group, (progress, pull, motion) => {
    needle.rotation.z = Math.sin(progress * Math.PI * 2 * motion) * 0.35 * (1 - pull);
    south.rotation.z = needle.rotation.z;
  });
}

function maze(THREE, kit) {
  const group = new THREE.Group();
  addBox(THREE, group, kit.box, kit.glass, 0, -0.04, 0, 0.92, 0.04, 0.92);
  const walls = kit.low
    ? [[-0.28, 0, 0.32, 0.04], [0.05, 0.16, 0.04, 0.36], [0.22, -0.12, 0.36, 0.04], [-0.08, -0.22, 0.04, 0.28]]
    : [[-0.3, 0.1, 0.28, 0.04], [0.02, 0.22, 0.04, 0.32], [0.24, 0, 0.32, 0.04], [-0.12, -0.16, 0.04, 0.36], [0.08, -0.28, 0.28, 0.04], [-0.28, -0.04, 0.2, 0.04]];
  walls.forEach((wall, index) => {
    addBox(THREE, group, kit.box, index % 2 === 0 ? kit.cyan : kit.violet, wall[0], 0.06, wall[1], wall[2], 0.12, wall[3]);
  });
  return actor('form-maze', group);
}

function geometricHeart(THREE, kit) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.25);
  shape.bezierCurveTo(0.35, 0.7, 0.85, 0.28, 0, -0.5);
  shape.bezierCurveTo(-0.85, 0.28, -0.35, 0.7, 0, 0.25);
  const geometry = keep(kit.geometries, new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false }));
  geometry.center();
  const mesh = new THREE.Mesh(geometry, kit.violet);
  mesh.scale.setScalar(0.7);
  return actor('form-heart', mesh);
}

function layerCube(THREE, kit) {
  const group = new THREE.Group();
  [kit.cyan, kit.violet, kit.white].forEach((material, index) => {
    const slab = addBox(THREE, group, kit.box, material, (index - 1) * 0.04, (index - 1) * 0.16, (index - 1) * 0.03, 0.62, 0.08, 0.62);
    slab.rotation.y = index * 0.18;
  });
  return actor('form-layers', group);
}

function digitalKey(THREE, kit) {
  const group = new THREE.Group();
  const bow = new THREE.Mesh(kit.torus, kit.cyan);
  bow.scale.setScalar(0.42);
  bow.position.x = -0.28;
  const shaft = addBox(THREE, group, kit.box, kit.glass, 0.16, 0, 0, 0.62, 0.08, 0.06);
  addBox(THREE, group, kit.box, kit.amber, 0.28, -0.08, 0, 0.08, 0.1, 0.05);
  addBox(THREE, group, kit.box, kit.violet, 0.4, -0.07, 0, 0.07, 0.12, 0.05);
  const chip = new THREE.Mesh(kit.sphere, kit.windowLit);
  chip.scale.setScalar(0.05);
  chip.position.set(-0.28, 0, 0.02);
  group.add(bow, chip);
  shaft.position.x = 0.12;
  return actor('form-key', group);
}

function antenna(THREE, kit) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(kit.cylinder, kit.white);
  pole.scale.set(0.03, 0.7, 0.03);
  const dish = new THREE.Mesh(kit.sphere, kit.cyan);
  dish.scale.set(0.22, 0.08, 0.22);
  dish.position.y = 0.28;
  group.add(pole, dish);
  const waves = [];
  for (let index = 0; index < 3; index += 1) {
    const samples = [];
    const radius = 0.18 + index * 0.1;
    for (let step = 0; step <= 10; step += 1) {
      const angle = -0.9 + (1.8 * step) / 10;
      samples.push(Math.sin(angle) * radius, 0.34 + index * 0.02, Math.cos(angle) * radius);
    }
    const geometry = keep(kit.geometries, new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(samples, 3));
    const wave = new THREE.Line(geometry, kit.line);
    wave.userData.base = 1 + index * 0.04;
    group.add(wave);
    waves.push(wave);
  }
  return actor('form-antenna', group, (progress, pull, motion) => {
    const pulse = 1 + Math.sin(progress * Math.PI * 2 * motion) * 0.08 * (1 - pull);
    waves.forEach((wave) => wave.scale.setScalar(wave.userData.base * pulse));
  });
}

function starSystem(THREE, kit) {
  const group = new THREE.Group();
  const sun = new THREE.Mesh(kit.sphere, kit.amber);
  sun.scale.setScalar(0.12);
  group.add(sun);
  const planets = [];
  [0.28, 0.44].forEach((radius, index) => {
    const orbit = new THREE.Mesh(kit.torus, index === 0 ? kit.cyan : kit.violet);
    orbit.scale.setScalar(radius / 0.46);
    orbit.rotation.x = Math.PI / 2;
    const planet = new THREE.Mesh(kit.sphere, index === 0 ? kit.cyan : kit.white);
    planet.scale.setScalar(index === 0 ? 0.05 : 0.035);
    planet.userData.radius = radius;
    planet.userData.speed = index === 0 ? 0.55 : 0.32;
    group.add(orbit, planet);
    planets.push(planet);
  });
  return actor('form-stars', group, (progress, pull, motion) => {
    planets.forEach((planet) => {
      const angle = progress * Math.PI * 2 * planet.userData.speed * motion;
      const radius = planet.userData.radius * (1 - pull * 0.2);
      planet.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    });
  });
}

function floatingGates(THREE, kit) {
  const group = new THREE.Group();
  [0, 1].forEach((index) => {
    const frame = new THREE.Group();
    addBox(THREE, frame, kit.box, index === 0 ? kit.cyan : kit.violet, -0.22, 0, 0, 0.04, 0.62, 0.04);
    addBox(THREE, frame, kit.box, index === 0 ? kit.cyan : kit.violet, 0.22, 0, 0, 0.04, 0.62, 0.04);
    addBox(THREE, frame, kit.box, kit.white, 0, 0.3, 0, 0.48, 0.04, 0.04);
    frame.position.z = index === 0 ? -0.12 : 0.16;
    frame.rotation.y = index === 0 ? -0.35 : 0.4;
    group.add(frame);
  });
  return actor('form-gates', group);
}

function skyLantern(THREE, kit) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(kit.sphere, kit.amber);
  core.scale.set(0.16, 0.2, 0.16);
  const hoop = new THREE.Mesh(kit.torus, kit.cyan);
  hoop.scale.setScalar(0.42);
  hoop.position.y = 0.16;
  group.add(core, hoop);
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    addBox(THREE, group, kit.box, kit.violet, Math.cos(angle) * 0.16, 0, Math.sin(angle) * 0.16, 0.02, 0.42, 0.02);
  }
  const tassel = new THREE.Mesh(kit.cone, kit.white);
  tassel.scale.set(0.05, 0.16, 0.05);
  tassel.rotation.x = Math.PI;
  tassel.position.y = -0.32;
  group.add(tassel);
  return actor('form-lantern', group, (progress, pull, motion) => {
    const glow = 0.9 + Math.sin(progress * Math.PI * 2 * motion) * 0.1;
    core.scale.set(0.16 * glow, 0.2 * glow, 0.16 * glow * (1 - pull * 0.2));
  });
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
