const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const COUNTS = {
  high: { stars: 1680, dust: 620, arm: 1050 },
  medium: { stars: 980, dust: 360, arm: 600 },
  low: { stars: 500, dust: 180, arm: 300 },
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
  let width = 0;
  let height = 0;
  let starting = false;
  let shown = false;
  let reveal = 0;
  let fadeId = 0;
  let fadeStamp = 0;

  function start() {
    if (starting || renderer || failed || !mount) return;
    starting = true;
    import(THREE_MODULE_URL).then((THREE) => {
      if (failed) return;
      build(THREE);
      if (shown) play();
    }).catch(() => {
      failed = true;
    });
  }

  let fadeListener = null;

  function play(onFade) {
    if (typeof onFade === 'function') fadeListener = onFade;
    shown = true;
    if (!ready) return;
    setShown(true);
    if (reduced) reveal = 1;
    paint();
    if (reduced || reveal >= 1 || fadeId) return;
    fadeStamp = 0;
    fadeId = requestAnimationFrame(fadeStep);
  }

  function pause() {
    shown = false;
    if (fadeId) cancelAnimationFrame(fadeId);
    fadeId = 0;
    fadeStamp = 0;
    setShown(false);
  }

  function fadeStep(now) {
    fadeId = 0;
    if (!shown || !ready || reduced) return;
    if (fadeStamp === 0) fadeStamp = now;
    const dt = Math.min(0.05, Math.max(0, (now - fadeStamp) / 1000));
    fadeStamp = now;
    reveal = Math.min(1, reveal + dt / 1.35);
    paint();
    if (shown && reveal < 1) fadeId = requestAnimationFrame(fadeStep);
  }

  function paint() {
    if (!ready || !fieldMaterial) return;
    fieldMaterial.uniforms.uReveal.value = reveal;
    renderer.render(scene, camera);
    if (fadeListener) fadeListener(reveal);
  }

  function setShown(visible) {
    if (!renderer) return;
    renderer.domElement.style.visibility = visible ? 'visible' : 'hidden';
  }

  function resize() {
    if (!ready || !renderer || !mount) return;
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
    renderer.domElement.className = 'arrival-sky__canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.visibility = 'hidden';
    mount.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
    camera.position.set(0, 0.15, 7.2);

    fieldMaterial = new THREE.ShaderMaterial({
      uniforms: { uReveal: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: false,
      vertexShader: `
        attribute float aSize;
        attribute float aReveal;
        attribute vec3 aColor;
        uniform float uReveal;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          vec4 clip = projectionMatrix * view;
          vec2 ndc = clip.xy / max(0.001, abs(clip.w));
          float center = smoothstep(0.12, 0.5, length(ndc * vec2(0.78, 1.15)));
          float appear = aReveal < 0.0 ? 1.0 : smoothstep(aReveal, min(aReveal + 0.28, 0.92), max(uReveal, 0.0));
          vColor = aColor;
          vAlpha = 0.82 * mix(0.46, 1.0, center) * mix(0.05, 1.0, appear);
          gl_PointSize = clamp(aSize * (112.0 / max(1.0, -view.z)), 0.35, 3.2);
          gl_Position = clip;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 delta = gl_PointCoord - vec2(0.5);
          float falloff = dot(delta, delta);
          if (falloff > 0.25) discard;
          float glow = smoothstep(0.22, 0.06, falloff);
          gl_FragColor = vec4(vColor, glow * vAlpha * 0.62);
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
      position: [-2.7, 0.7, -5.2],
      tilt: [0.85, 0.2, 0.35],
      spin: [0.008, 0.15, 0.02],
      flow: 0.26,
    }));
    scene.add(makeGalaxy(THREE, random, {
      arms: 2,
      count: counts.arm * 2,
      radius: 4.2,
      position: [3.1, -1.15, -9.5],
      tilt: [1.15, -0.4, -0.55],
      spin: [-0.006, -0.1, 0.014],
      flow: -0.2,
    }));
    addRings(THREE, random);

    ready = true;
    resize();
    if (shown) play();
  }

  function makeField(THREE, random, count, kind) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const twinkles = new Float32Array(count);
    const drifts = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      let depth = kind === 'dust' ? 7 + random() * 16 : 10 + random() * 28;
      const spread = kind === 'dust' ? 10 : 20;
      let x = (random() - 0.5) * spread * 2;
      let y = (random() - 0.5) * spread * 1.15;
      const viewZ = 7.2 + depth;
      if (Math.abs(x) / viewZ < 0.22 && Math.abs(y) / viewZ < 0.16 && random() > 0.42) {
        depth = 22 + random() * 12;
        x = (random() - 0.5) * 22;
        y = (random() - 0.5) * 12;
      }
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = -depth;
      const tone = random();
      const color = tone > 0.94
        ? [0.72, 0.84, 0.94]
        : tone < 0.45 ? [0.22, 0.5, 0.82] : [0.38, 0.68, 0.92];
      colors.set(color, index * 3);
      sizes[index] = kind === 'dust' ? 0.5 + random() * 0.7 : 0.6 + random() * 1.3;
      phases[index] = random() * Math.PI * 2;
      const near = 1 - Math.min(1, depth / 28);
      drifts[index] = kind === 'dust'
        ? 0.05 + near * 0.14
        : (random() > 0.86 ? 0.1 + random() * 0.16 : near * 0.035);
      twinkles[index] = kind === 'stars' && random() > 0.5 ? 0.35 + random() * 1.5 : 0;
    }
    const points = new THREE.Points(pointGeometry(THREE, positions, colors, sizes, phases, twinkles, drifts), fieldMaterial);
    if (kind === 'stars') {
      const appear = points.geometry.attributes.aReveal;
      for (let index = 0; index < count; index += 1) appear.setX(index, (index % 4) * 0.16);
      appear.needsUpdate = true;
    }
    return points;
  }

  function makeGalaxy(THREE, random, spec) {
    const count = spec.count;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const twinkles = new Float32Array(count);
    const drifts = new Float32Array(count);
    const flows = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const arm = index % spec.arms;
      const along = Math.pow(random(), 0.72);
      const angle = along * Math.PI * 4.4 + (arm / spec.arms) * Math.PI * 2;
      const spread = (random() - 0.5) * (0.05 + along * 0.42);
      const radius = along * spec.radius;
      positions[index * 3] = Math.cos(angle + spread) * radius;
      positions[index * 3 + 1] = (random() - 0.5) * (0.035 + along * 0.16) * spec.radius;
      positions[index * 3 + 2] = Math.sin(angle + spread) * radius * 0.38;
      const core = along < 0.12;
      const color = core ? [0.74, 0.88, 1] : (arm % 2 === 0 ? [0.24, 0.58, 0.92] : [0.42, 0.74, 1]);
      colors.set(color, index * 3);
      sizes[index] = core ? 1.15 + random() * 0.7 : 0.55 + random() * 0.85;
      phases[index] = random() * Math.PI * 2;
      twinkles[index] = core && random() > 0.6 ? 0.7 : 0;
      drifts[index] = 0;
    }
    const points = new THREE.Points(pointGeometry(THREE, positions, colors, sizes, phases, twinkles, drifts, flows), fieldMaterial);
    const group = new THREE.Group();
    group.add(points);
    group.position.set(spec.position[0], spec.position[1], spec.position[2]);
    group.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2]);
    return group;
  }

  function addRings(THREE) {
    const material = new THREE.LineBasicMaterial({
      color: 0x6aafd0,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const specs = [
      { rx: 2.7, ry: 0.85, at: [0.8, 0.3, -2.6], tilt: [1.15, 0.2, 0.4] },
      { rx: 3.8, ry: 1.15, at: [-1.1, -0.45, -4.1], tilt: [1.35, 0.5, -0.3] },
      { rx: 5.2, ry: 1.7, at: [1.1, 0.4, -7], tilt: [1.05, -0.35, 0.2] },
    ];
    specs.forEach((spec, index) => {
      const group = new THREE.Group();
      group.add(new THREE.LineLoop(ellipseGeometry(THREE, spec.rx, spec.ry), material));
      group.position.set(spec.at[0], spec.at[1], spec.at[2]);
      group.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2]);
      group.add(new THREE.Points(pointGeometry(
        THREE,
        new Float32Array([spec.rx, 0, 0]),
        new Float32Array([0.55, 0.8, 1]),
        new Float32Array([1.8]),
        new Float32Array([index]),
        new Float32Array([0.8]),
        new Float32Array([0]),
      ), fieldMaterial));
      scene.add(group);
    });
  }

  return { start, play, pause };
}

function pointGeometry(THREE, positions, colors, sizes, phases, twinkles, drifts, flows) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1));
  geometry.setAttribute('aDrift', new THREE.BufferAttribute(drifts, 1));
  geometry.setAttribute('aFlow', new THREE.BufferAttribute(flows || new Float32Array(positions.length / 3), 1));
  const reveal = new Float32Array(positions.length / 3);
  reveal.fill(-1);
  geometry.setAttribute('aReveal', new THREE.BufferAttribute(reveal, 1));
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
