const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const COUNTS = {
  high: { stars: 2400, dust: 900, arm: 1500 },
  medium: { stars: 1400, dust: 520, arm: 860 },
  low: { stars: 720, dust: 260, arm: 420 },
};

export function createArrivalGalaxy(mount, quality) {
  const reduced = Boolean(quality && quality.reducedMotion);
  const level = quality && COUNTS[quality.level] ? quality.level : 'high';
  const counts = COUNTS[level];
  let renderer = null;
  let scene = null;
  let camera = null;
  let fieldMaterial = null;
  let ready = false;
  let failed = false;
  let elapsed = 0;
  let last = 0;
  let width = 0;
  let height = 0;
  const spins = [];
  const riders = [];
  const flashes = [];
  let streaks = null;
  let streakCursor = 0;
  let nextStreak = 1.4;
  let nextFlash = 0.8;

  let starting = false;

  function start() {
    if (starting || renderer || failed || !mount) return;
    starting = true;
    import(THREE_MODULE_URL).then((THREE) => {
      if (failed) return;
      build(THREE);
    }).catch(() => {
      failed = true;
    });
  }

  function tick(now) {
    if (failed) return false;
    if (!ready) return !reduced;
    if (document.hidden) return false;
    const dt = last === 0 ? 1 / 60 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    resize();
    if (!reduced) {
      elapsed += dt;
      fieldMaterial.uniforms.uTime.value = elapsed;
      spins.forEach((item) => {
        item.object.rotation.y += item.y * dt;
        item.object.rotation.z += item.z * dt;
        item.object.rotation.x += item.x * dt;
      });
      riders.forEach((rider) => {
        rider.angle += rider.speed * dt;
        rider.point.position.set(
          Math.cos(rider.angle) * rider.rx,
          Math.sin(rider.angle) * rider.ry,
          0,
        );
      });
      advanceStreaks(dt);
      advanceFlashes(dt);
    }
    renderer.render(scene, camera);
    return !reduced;
  }

  function resize() {
    if (!ready || !mount) return;
    const nextWidth = mount.clientWidth || window.innerWidth;
    const nextHeight = mount.clientHeight || window.innerHeight;
    if (Math.abs(nextWidth - width) < 2 && Math.abs(nextHeight - height) < 2) return;
    width = nextWidth;
    height = nextHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function build(THREE) {
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: level === 'low' ? 'low-power' : 'high-performance',
      });
    } catch (error) {
      failed = true;
      return;
    }
    const ratioCap = level === 'high' ? 1.25 : 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioCap));
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
    camera.position.set(0, 0.15, 7.2);

    fieldMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: false,
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute float aTwinkle;
        attribute float aDrift;
        attribute vec3 aColor;
        uniform float uTime;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.045 + aPhase) * aDrift;
          p.y += cos(uTime * 0.037 + aPhase * 1.3) * aDrift * 0.65;
          float twinkle = aTwinkle > 0.0 ? 0.62 + 0.38 * sin(uTime * aTwinkle + aPhase) : 0.9;
          vColor = aColor;
          vAlpha = twinkle;
          vec4 view = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(aSize * (150.0 / max(1.0, -view.z)), 0.4, 5.5);
          gl_Position = projectionMatrix * view;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 delta = gl_PointCoord - vec2(0.5);
          float falloff = dot(delta, delta);
          if (falloff > 0.25) discard;
          float glow = smoothstep(0.25, 0.02, falloff);
          gl_FragColor = vec4(vColor, glow * vAlpha * 0.9);
        }
      `,
    });

    const random = mulberry32(0x51f);
    scene.add(makeField(THREE, random, counts.stars, 'stars'));
    scene.add(makeField(THREE, random, counts.dust, 'dust'));
    scene.add(makeGalaxy(THREE, random, {
      arms: 3,
      count: counts.arm * 3,
      radius: 3.4,
      position: [-2.4, 0.55, -4.5],
      tilt: [0.85, 0.2, 0.35],
      spin: [0.012, 0.09, 0.018],
    }));
    scene.add(makeGalaxy(THREE, random, {
      arms: 2,
      count: counts.arm * 2,
      radius: 4.2,
      position: [3.1, -1.15, -9.5],
      tilt: [1.15, -0.4, -0.55],
      spin: [-0.008, -0.055, 0.01],
    }));
    addRings(THREE, random);
    streaks = makeStreaks(THREE, 8);
    scene.add(streaks.mesh);
    addFlashes(THREE, random);

    ready = true;
    resize();
    if (reduced) renderer.render(scene, camera);
  }

  function makeField(THREE, random, count, kind) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const twinkles = new Float32Array(count);
    const drifts = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const depth = kind === 'dust' ? 1.5 + random() * 10 : 4 + random() * 34;
      const spread = kind === 'dust' ? 7 : 16;
      positions[index * 3] = (random() - 0.5) * spread * 2;
      positions[index * 3 + 1] = (random() - 0.5) * spread * 1.15;
      positions[index * 3 + 2] = -depth;
      const tone = random();
      const color = tone < 0.34 ? [0.55, 0.86, 1] : tone < 0.67 ? [0.75, 0.88, 1] : [0.42, 0.62, 1];
      colors.set(color, index * 3);
      sizes[index] = kind === 'dust' ? 0.7 + random() * 1.1 : 0.8 + random() * 2.4;
      phases[index] = random() * Math.PI * 2;
      const near = 1 - Math.min(1, depth / 28);
      drifts[index] = kind === 'dust' ? 0.08 + near * 0.28 : near * 0.05;
      twinkles[index] = kind === 'stars' && random() > 0.72 ? 0.6 + random() * 1.8 : 0;
    }
    return new THREE.Points(pointGeometry(THREE, positions, colors, sizes, phases, twinkles, drifts), fieldMaterial);
  }

  function makeGalaxy(THREE, random, spec) {
    const count = spec.count;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const twinkles = new Float32Array(count);
    const drifts = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const arm = index % spec.arms;
      const along = Math.pow(random(), 0.62);
      const angle = along * Math.PI * 4.4 + (arm / spec.arms) * Math.PI * 2;
      const spread = (random() - 0.5) * (0.05 + along * 0.42);
      const radius = along * spec.radius;
      positions[index * 3] = Math.cos(angle + spread) * radius;
      positions[index * 3 + 1] = (random() - 0.5) * (0.035 + along * 0.16) * spec.radius;
      positions[index * 3 + 2] = Math.sin(angle + spread) * radius * 0.38;
      const core = along < 0.16;
      const color = core ? [0.92, 0.96, 1] : (arm % 2 === 0 ? [0.35, 0.78, 1] : [0.62, 0.9, 1]);
      colors.set(color, index * 3);
      sizes[index] = core ? 1.8 + random() * 1.6 : 0.7 + random() * 1.5;
      phases[index] = random() * Math.PI * 2;
      twinkles[index] = core && random() > 0.45 ? 1.2 + random() : 0;
      drifts[index] = 0;
    }
    const points = new THREE.Points(pointGeometry(THREE, positions, colors, sizes, phases, twinkles, drifts), fieldMaterial);
    const group = new THREE.Group();
    group.add(points);
    group.position.set(spec.position[0], spec.position[1], spec.position[2]);
    group.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2]);
    spins.push({ object: group, x: spec.spin[0], y: spec.spin[1], z: spec.spin[2] });
    return group;
  }

  function addRings(THREE, random) {
    const material = new THREE.LineBasicMaterial({
      color: 0x9fdfff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const specs = [
      { rx: 2.7, ry: 0.85, at: [0.2, 0.1, -1.6], tilt: [1.15, 0.2, 0.4], spin: 0.045 },
      { rx: 3.8, ry: 1.15, at: [-0.6, -0.3, -3.2], tilt: [1.35, 0.5, -0.3], spin: -0.028 },
      { rx: 5.2, ry: 1.7, at: [1.1, 0.4, -6.4], tilt: [1.05, -0.35, 0.2], spin: 0.016 },
    ];
    specs.forEach((spec, index) => {
      const group = new THREE.Group();
      group.add(new THREE.LineLoop(ellipseGeometry(THREE, spec.rx, spec.ry), material));
      group.position.set(spec.at[0], spec.at[1], spec.at[2]);
      group.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2]);
      const point = new THREE.Points(pointGeometry(
        THREE,
        new Float32Array([spec.rx, 0, 0]),
        new Float32Array([0.75, 0.95, 1]),
        new Float32Array([3.2]),
        new Float32Array([index]),
        new Float32Array([1.4]),
        new Float32Array([0]),
      ), fieldMaterial);
      group.add(point);
      riders.push({
        point,
        rx: spec.rx,
        ry: spec.ry,
        angle: random() * Math.PI * 2,
        speed: spec.spin * 18,
      });
      spins.push({ object: group, x: 0, y: 0, z: spec.spin });
      scene.add(group);
    });
  }

  function makeStreaks(THREE, count) {
    const positions = new Float32Array(count * 2 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: 0xc8f4ff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    mesh.frustumCulled = false;
    const items = [];
    for (let index = 0; index < count; index += 1) items.push({ life: 0, vx: 0, vy: 0, vz: 0 });
    return { mesh, positions, items };
  }

  function advanceStreaks(dt) {
    nextStreak -= dt;
    if (nextStreak <= 0) {
      const item = streaks.items[streakCursor];
      const base = streakCursor * 6;
      const x = (Math.random() - 0.5) * 8;
      const y = (Math.random() - 0.5) * 4;
      const z = -2 - Math.random() * 8;
      streaks.positions[base] = x;
      streaks.positions[base + 1] = y;
      streaks.positions[base + 2] = z;
      streaks.positions[base + 3] = x;
      streaks.positions[base + 4] = y;
      streaks.positions[base + 5] = z;
      item.life = 0.55 + Math.random() * 0.35;
      item.vx = (Math.random() - 0.5) * 7;
      item.vy = (Math.random() - 0.5) * 1.4;
      item.vz = -0.4 - Math.random();
      streakCursor = (streakCursor + 1) % streaks.items.length;
      nextStreak = 2.4 + Math.random() * 2.2;
    }
    streaks.items.forEach((item, index) => {
      const base = index * 6;
      if (item.life <= 0) {
        streaks.positions[base + 2] = 40;
        streaks.positions[base + 5] = 40;
        return;
      }
      item.life -= dt;
      streaks.positions[base] += item.vx * dt;
      streaks.positions[base + 1] += item.vy * dt;
      streaks.positions[base + 2] += item.vz * dt;
      const tail = 0.22;
      streaks.positions[base + 3] = streaks.positions[base] - item.vx * tail;
      streaks.positions[base + 4] = streaks.positions[base + 1] - item.vy * tail;
      streaks.positions[base + 5] = streaks.positions[base + 2] - item.vz * tail;
    });
    streaks.mesh.geometry.attributes.position.needsUpdate = true;
  }

  function addFlashes(THREE, random) {
    for (let index = 0; index < 6; index += 1) {
      const point = new THREE.Points(pointGeometry(
        THREE,
        new Float32Array([(random() - 0.5) * 10, (random() - 0.5) * 5, -3 - random() * 10]),
        new Float32Array([0.8, 0.95, 1]),
        new Float32Array([0.2]),
        new Float32Array([index]),
        new Float32Array([0]),
        new Float32Array([0]),
      ), fieldMaterial);
      scene.add(point);
      flashes.push({ point, life: 0 });
    }
  }

  function advanceFlashes(dt) {
    nextFlash -= dt;
    if (nextFlash <= 0) {
      const flash = flashes[Math.floor(Math.random() * flashes.length)];
      flash.life = 0.45;
      nextFlash = 1.5 + Math.random() * 1.8;
    }
    flashes.forEach((flash) => {
      const size = flash.point.geometry.attributes.aSize;
      if (flash.life > 0) {
        flash.life -= dt;
        size.array[0] = 2.2 + Math.sin((0.45 - flash.life) / 0.45 * Math.PI) * 3.4;
        size.needsUpdate = true;
        return;
      }
      if (size.array[0] > 0.25) {
        size.array[0] = 0.2;
        size.needsUpdate = true;
      }
    });
  }

  return { start, tick, resize };
}

function pointGeometry(THREE, positions, colors, sizes, phases, twinkles, drifts) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1));
  geometry.setAttribute('aDrift', new THREE.BufferAttribute(drifts, 1));
  return geometry;
}

function ellipseGeometry(THREE, rx, ry) {
  const steps = 96;
  const positions = new Float32Array((steps + 1) * 3);
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    positions[index * 3] = Math.cos(angle) * rx;
    positions[index * 3 + 1] = Math.sin(angle) * ry;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value = (value + 0x6D2B79F5) >>> 0;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
