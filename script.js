(() => {
  'use strict';

  // Real preload list. The percentage is measured from these files only.
  // A file with Content-Length reports byte progress; otherwise it counts
  // only after the response has fully arrived.
  // Example for a later stage: { id: 'opening', url: 'assets/opening.glb' }
  const ASSET_MANIFEST = [];

  const OPENING_MIN = 1200;
  const OPENING_MAX = 2600;
  const SCENE_TO_CIRCLE = 1;
  const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

  function boot() {
    const root = document.getElementById('experience');
    if (!root) {
      throw new Error('Experience root was not found');
    }

    const experience = createExperience(root);
    experience.start();
  }

  function createExperience(root) {
    const view = createLoadingView(root);
    const hint = root.querySelector('[data-scroll-hint]');
    const quality = detectQuality();
    const opening = createOpeningStage(root.querySelector('[data-stage-mount]'), quality);
    const scroll = createScrollController(root, {
      openingLength: measureOpeningLength(),
      lambda: quality.lambda,
    });
    let assets = new Map();

    root.dataset.quality = quality.level;
    root.dataset.mode = 'opening';
    root.dataset.progress = '0';
    root.style.setProperty('--opening-progress', '0');

    const stageMount = opening.getMount();
    scroll.subscribe((sample) => {
      const circleShare = 1 / (1 + SCENE_TO_CIRCLE);
      const circleProgress = clamp01(sample.openingProgress / circleShare);
      const sceneProgress = clamp01((sample.openingProgress - circleShare) / (1 - circleShare));
      opening.seek(sceneProgress);
      root.style.setProperty('--opening-progress', circleProgress.toFixed(4));
      const reveal = stageMount.dataset.scene === 'attached' ? clamp01(sceneProgress / 0.12) : 0;
      root.style.setProperty('--scene-reveal', reveal.toFixed(4));
      root.dataset.sceneProgress = sceneProgress.toFixed(4);
      if (circleProgress > 0.001) root.dataset.opening = 'active';
      if (circleProgress >= 0.999) root.dataset.circle = 'full';
      else delete root.dataset.circle;
      if (!hint) return;
      const hintVisible = root.dataset.phase === 'ready' && circleProgress < 0.92 && sample.mode === 'opening';
      hint.setAttribute('aria-hidden', hintVisible ? 'false' : 'true');
    });
    mountChaosScene(opening, stageMount, quality);

    return {
      scroll,
      opening,
      getAssets() {
        return assets;
      },
      setContentLength(length) {
        scroll.setContentLength(length);
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

  function measureCircleLength() {
    const height = window.innerHeight || 800;
    return Math.min(OPENING_MAX, Math.max(OPENING_MIN, Math.round(height * 2.4)));
  }

  function measureOpeningLength() {
    return measureCircleLength() * (1 + SCENE_TO_CIRCLE);
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

    let lambda = 8;
    if (level === 'medium') lambda = 11;
    if (level === 'low') lambda = 16;
    if (reducedMotion) lambda = 0;

    return { level, reducedMotion, lambda };
  }

  // Empty stage adapter. A later Three.js scene can be attached with seek(progress).
  function createOpeningStage(mount, quality) {
    if (!mount) {
      throw new Error('Opening stage mount was not found');
    }

    const state = {
      progress: 0,
      quality: quality.level,
      scene: null,
    };

    mount.dataset.scene = 'pending';
    mount.dataset.quality = quality.level;
    mount.dataset.progress = '0';

    function seek(progress) {
      const next = clamp01(progress);
      state.progress = next;
      const printed = next.toFixed(4);
      mount.dataset.progress = printed;
      if (state.scene) state.scene.seek(next);
    }

    return {
      getMount() {
        return mount;
      },
      getProgress() {
        return state.progress;
      },
      getQuality() {
        return state.quality;
      },
      setQuality(level) {
        state.quality = level;
        mount.dataset.quality = level;
        if (state.scene && typeof state.scene.setQuality === 'function') {
          state.scene.setQuality(level);
        }
      },
      seek,
      attachScene(scene) {
        if (!scene || typeof scene.seek !== 'function') {
          throw new Error('Opening scene must implement seek(progress)');
        }
        state.scene = scene;
        mount.dataset.scene = 'attached';
        if (typeof scene.setQuality === 'function') scene.setQuality(state.quality);
        scene.seek(state.progress);
      },
    };
  }

  function mountChaosScene(opening, mount, quality) {
    import(THREE_MODULE_URL).then((THREE) => {
      const scene = createChaosScene(THREE, mount, quality);
      opening.attachScene(scene);
      const reveal = clamp01(opening.getProgress() / 0.12);
      mount.parentElement.style.setProperty('--scene-reveal', reveal.toFixed(4));
    }).catch((error) => {
      console.error(error);
    });
  }

  function createChaosScene(THREE, mount, quality) {
    const reduced = Boolean(quality.reducedMotion);
    const level = quality.level;
    const meshCount = level === 'low' ? 12 : level === 'medium' ? 22 : 32;
    const particleCount = reduced ? 48 : level === 'low' ? 64 : level === 'medium' ? 120 : 180;
    const spinScale = reduced ? 0.25 : 1;
    const random = createRandom(170);
    const palette = [0xff2a4a, 0x6d5efc, 0x19d3ff, 0xffd23a, 0x39f28a, 0xff6a1a, 0xff4ad8, 0x3d7bff];
    const geometries = createChaosGeometries(THREE, level);
    const meshes = [];
    const particles = createParticleField(THREE, particleCount, random);
    let renderer;
    let scene;
    let camera;
    let group;
    let disposed = false;
    let progress = 0;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: level === 'high' && !reduced,
        alpha: false,
        powerPreference: level === 'low' ? 'low-power' : 'high-performance',
      });
    } catch (error) {
      geometries.forEach((geometry) => geometry.dispose());
      throw error;
    }

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const ratioCap = level === 'low' || coarse || reduced ? 1 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioCap));
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.38;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.042);
    camera = new THREE.PerspectiveCamera(52, 1, 0.1, 80);

    scene.add(new THREE.AmbientLight(0xffffff, 0.045));
    scene.add(new THREE.HemisphereLight(0xb9dcff, 0x14010c, 0.28));
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 3.4);
    keyLight.position.set(4.5, 8, 7);
    scene.add(keyLight);
    const coolLight = new THREE.PointLight(0x3ecbff, 10, 36);
    coolLight.position.set(-6, 2, 4);
    scene.add(coolLight);
    const warmLight = new THREE.PointLight(0xff2f86, 8, 34);
    warmLight.position.set(5, -3, 3);
    scene.add(warmLight);
    const rimLight = new THREE.DirectionalLight(0x9ad8ff, 0.4);
    rimLight.position.set(-8, -2, -6);
    scene.add(rimLight);

    const physical = level === 'high' && !reduced && !coarse;
    group = new THREE.Group();
    scene.add(group);

    function addChaosObject(object, materials, extraGeometries) {
      extraGeometries.forEach((geometry) => {
        if (geometries.indexOf(geometry) === -1) geometries.push(geometry);
      });
      object.visible = false;
      object.scale.setScalar(0.02);
      group.add(object);
      meshes.push(Object.assign({
        mesh: object,
        materials,
        delay: 0,
      }, createChaosPath(meshes.length, random)));
    }

    const primitives = geometries.slice();
    const specials = createChaosSpecials(THREE, level, physical, palette);
    specials.forEach((special) => {
      if (meshes.length < meshCount) {
        addChaosObject(special.object, special.materials, special.geometries);
      } else {
        special.materials.forEach((entry) => entry.material.dispose());
        special.geometries.forEach((geometry) => geometry.dispose());
      }
    });

    let cursor = 0;
    while (meshes.length < meshCount && primitives.length > 0) {
      const geometry = primitives[cursor % primitives.length];
      const color = palette[cursor % palette.length];
      const emissive = palette[(cursor + 3) % palette.length];
      const faceted = geometry.type !== 'SphereGeometry' && geometry.type !== 'TorusGeometry' && geometry.type !== 'TorusKnotGeometry';
      const finish = geometry.type === 'RingGeometry' ? 'ring' : faceted ? 'gem' : (cursor % 2 === 0 ? 'glass' : 'metal');
      const entry = createFinishMaterial(THREE, physical, color, emissive, finish);
      addChaosObject(new THREE.Mesh(geometry, entry.material), [entry], []);
      cursor += 1;
    }
    const ranks = meshes.map((_, index) => index);
    for (let index = ranks.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      const hold = ranks[index];
      ranks[index] = ranks[swap];
      ranks[swap] = hold;
    }
    ranks.forEach((meshIndex, rank) => {
      meshes[meshIndex].delay = (rank / Math.max(1, ranks.length - 1)) * 0.7;
    });
    group.add(particles.points);

    function resize() {
      if (disposed) return;
      const width = mount.clientWidth || window.innerWidth;
      const height = mount.clientHeight || window.innerHeight;
      if (width < 2 || height < 2) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = width < 760 ? 64 : 50;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }

    function seek(nextProgress) {
      if (disposed) return;
      progress = clamp01(nextProgress);
      const surge = smoothstep(progress);
      const motion = spinScale;
      meshes.forEach((item) => {
        const shown = appearOf(progress, item.delay);
        const travel = smoothstep(clamp01((progress - item.delay) / Math.max(0.32, 1 - item.delay)));
        const wave = Math.sin(item.phase + progress * item.turns * Math.PI * 2) * item.sway * motion * travel;
        const cross = Math.cos(item.phase * 0.73 + progress * item.turns * Math.PI * 2) * item.lift * motion * travel;
        item.mesh.visible = shown > 0.025;
        item.mesh.position.set(
          item.fromX + (item.toX - item.fromX) * travel + wave,
          item.fromY + (item.toY - item.fromY) * travel + cross,
          item.fromZ + (item.toZ - item.fromZ) * travel
        );
        item.mesh.rotation.set(
          item.rotX + item.spinX * progress * Math.PI * 2 * motion,
          item.rotY + item.spinY * progress * Math.PI * 2 * motion,
          item.rotZ + item.spinZ * progress * Math.PI * 2 * motion
        );
        item.mesh.scale.setScalar(shown * item.bulk * (0.62 + surge * 0.4));
        const heat = shown * (0.16 + surge * 0.48);
        item.materials.forEach((entry) => {
          entry.material.emissiveIntensity = heat * entry.glow;
          entry.material.color.copy(entry.base).lerp(entry.hot, shown * surge * 0.22);
        });
      });
      particles.apply(progress, reduced);
      group.rotation.set(progress * 0.04 * motion, progress * 0.1 * motion, 0);
      camera.position.set(
        reduced ? 0 : Math.sin(progress * Math.PI) * 0.8,
        0.12 + progress * 0.32,
        14.2 - (reduced ? surge * 1.5 : surge * 3.4)
      );
      camera.lookAt(0, 0, 0);
      coolLight.intensity = 10 + surge * 24;
      warmLight.intensity = 8 + surge * 28;
      rimLight.intensity = 0.35 + surge * 2.5;
      renderer.render(scene, camera);
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('resize', resize);
      meshes.forEach((item) => {
        item.materials.forEach((entry) => entry.material.dispose());
      });
      geometries.forEach((geometry) => geometry.dispose());
      particles.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('pagehide', dispose, { once: true });
    resize();

    return {
      seek,
      resize,
      dispose,
      setQuality() {
        seek(progress);
      },
    };
  }

  function createChaosGeometries(THREE, level) {
    const sphere = level === 'low' ? [12, 8] : [24, 16];
    const list = [
      new THREE.SphereGeometry(0.52, sphere[0], sphere[1]),
      new THREE.BoxGeometry(0.78, 0.78, 0.78),
      new THREE.TorusGeometry(0.46, 0.14, level === 'low' ? 6 : 12, level === 'low' ? 16 : 28),
      new THREE.OctahedronGeometry(0.58, 0),
      new THREE.IcosahedronGeometry(0.54, 0),
      new THREE.TetrahedronGeometry(0.66, 0),
      new THREE.ConeGeometry(0.42, 0.9, 5),
      new THREE.RingGeometry(0.28, 0.52, level === 'low' ? 5 : 7),
      new THREE.DodecahedronGeometry(0.6, 0),
    ];
    if (level !== 'low') {
      list.push(new THREE.TorusKnotGeometry(0.34, 0.1, level === 'high' ? 64 : 40, 8));
    }
    return list;
  }

  function createParticleField(THREE, count, random) {
    const seeds = [];
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const seed = {
        x: (random() - 0.5) * 16,
        y: (random() - 0.5) * 10,
        z: (random() - 0.5) * 14,
        drift: random() * 4 + 0.5,
        orbit: random() * 0.8,
        phase: random() * Math.PI * 2,
      };
      seeds.push(seed);
      positions[index * 3] = seed.x;
      positions[index * 3 + 1] = seed.y;
      positions[index * 3 + 2] = seed.z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xfff6d0,
      size: 0.055,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);

    return {
      points,
      apply(progress, reduced) {
        const values = geometry.attributes.position.array;
        const fade = smoothstep(clamp01((progress - 0.04) / 0.82));
        for (let index = 0; index < seeds.length; index += 1) {
          const seed = seeds[index];
          const emerge = smoothstep(clamp01((progress - (index / seeds.length) * 0.75) / 0.22));
          const swing = reduced ? 0 : Math.sin(seed.phase + progress * Math.PI * 2) * seed.orbit * emerge;
          const lift = reduced ? 0 : Math.cos(seed.phase * 0.8 + progress * Math.PI * 2) * seed.orbit * 0.65 * emerge;
          const outward = seed.x >= 0 ? 1 : -1;
          values[index * 3] = seed.x + swing + outward * (1 - emerge) * 1.5;
          values[index * 3 + 1] = seed.y + lift;
          values[index * 3 + 2] = seed.z * (1 - emerge * 0.45) + seed.drift * emerge;
        }
        geometry.attributes.position.needsUpdate = true;
        material.opacity = fade * (reduced ? 0.35 : 0.88);
        material.size = 0.03 + fade * (reduced ? 0.02 : 0.045);
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  }

  function createRandom(seed) {
    let value = seed >>> 0;
    return function random() {
      value = (value + 0x6d2b79f5) >>> 0;
      let t = Math.imul(value ^ (value >>> 15), 1 | value);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function smoothstep(value) {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  }

  function appearOf(progress, delay) {
    return smoothstep(clamp01((progress - delay) / 0.24));
  }

  function signedSpin(random) {
    const value = (random() - 0.5) * 2.4;
    if (Math.abs(value) >= 0.4) return value;
    return value < 0 ? -0.85 : 0.85;
  }

  function createChaosPath(index, random) {
    const lanes = [
      { fx: -10, fy: 1.6, fz: -16, tx: -2.2, ty: 1.1, tz: 2.4 },
      { fx: 10, fy: -2.2, fz: -14, tx: 2.4, ty: -1.2, tz: 3.1 },
      { fx: 0.8, fy: 9.2, fz: -18, tx: -0.6, ty: 2.2, tz: 1.6 },
      { fx: -1.2, fy: -9, fz: -12, tx: 0.8, ty: -2.1, tz: 3.4 },
      { fx: 8, fy: 4.5, fz: -20, tx: -3.1, ty: 0.4, tz: 1.2 },
      { fx: -8.5, fy: -3.5, fz: -10, tx: 3.2, ty: 1.5, tz: 3.8 },
    ];
    const lane = lanes[index % lanes.length];
    return {
      fromX: lane.fx + (random() - 0.5) * 1.6,
      fromY: lane.fy + (random() - 0.5) * 1.3,
      fromZ: lane.fz - random() * 3,
      toX: lane.tx + (random() - 0.5) * 1.8,
      toY: lane.ty + (random() - 0.5) * 1.3,
      toZ: lane.tz + random() * 1.2,
      sway: 0.4 + random() * 1.2,
      lift: 0.3 + random() * 0.95,
      turns: 0.55 + random() * 1.15,
      spinX: signedSpin(random),
      spinY: signedSpin(random),
      spinZ: signedSpin(random) * 0.8,
      rotX: random() * Math.PI,
      rotY: random() * Math.PI,
      rotZ: random() * Math.PI,
      phase: random() * Math.PI * 2,
      bulk: 0.64 + random() * 0.72,
    };
  }

  function createFinishMaterial(THREE, physical, color, emissive, finish) {
    const params = {
      color,
      emissive,
      emissiveIntensity: 0,
      metalness: finish === 'metal' || finish === 'ring' ? 0.9 : 0.08,
      roughness: finish === 'gem' ? 0.22 : finish === 'metal' ? 0.16 : 0.06,
      flatShading: finish === 'gem',
      side: finish === 'ring' ? THREE.DoubleSide : THREE.FrontSide,
    };
    const material = physical
      ? new THREE.MeshPhysicalMaterial(Object.assign({
        clearcoat: finish === 'metal' ? 0.4 : 1,
        clearcoatRoughness: 0.1,
      }, params))
      : new THREE.MeshStandardMaterial(params);
    return {
      material,
      base: new THREE.Color(color),
      hot: new THREE.Color(emissive),
      glow: finish === 'metal' ? 0.45 : 0.8,
    };
  }

  function createLinkedRings(THREE, level, physical, palette, offset, ringCount) {
    const geometry = new THREE.TorusGeometry(
      0.68,
      0.085,
      level === 'low' ? 6 : 10,
      level === 'low' ? 18 : 32
    );
    geometry.userData.special = true;
    const group = new THREE.Group();
    const materials = [];
    for (let ring = 0; ring < ringCount; ring += 1) {
      const entry = createFinishMaterial(
        THREE,
        physical,
        palette[(offset + ring * 2) % palette.length],
        palette[(offset + ring + 4) % palette.length],
        'ring'
      );
      const mesh = new THREE.Mesh(geometry, entry.material);
      if (ring === 1) mesh.rotation.x = Math.PI / 2;
      if (ring === 2) mesh.rotation.y = Math.PI / 2;
      group.add(mesh);
      materials.push(entry);
    }
    return {
      object: group,
      materials,
      geometries: [geometry],
      drawCalls: ringCount,
    };
  }

  function createDistortedSolid(THREE, level, physical, color, emissive, salt, kind) {
    const geometry = kind === 'torus'
      ? new THREE.TorusGeometry(0.52, 0.18, level === 'low' ? 6 : 10, level === 'low' ? 16 : 28)
      : new THREE.IcosahedronGeometry(0.72, level === 'low' ? 0 : 1);
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const wave = Math.sin(x * 3.2 + salt) * Math.cos(y * 2.6 + salt * 0.4) * Math.sin(z * 2.9 + 0.8);
      position.setXYZ(
        index,
        x + normal.getX(index) * wave * 0.28,
        y * (1 + wave * 0.22),
        z + normal.getZ(index) * wave * 0.2
      );
    }
    geometry.computeVertexNormals();
    geometry.userData.special = true;
    const entry = createFinishMaterial(THREE, physical, color, emissive, kind === 'torus' ? 'glass' : 'gem');
    return {
      object: new THREE.Mesh(geometry, entry.material),
      materials: [entry],
      geometries: [geometry],
      drawCalls: 1,
    };
  }

  function createStarPrism(THREE, physical, color, emissive) {
    const shape = new THREE.Shape();
    const spikes = 5;
    for (let point = 0; point < spikes * 2; point += 1) {
      const radius = point % 2 === 0 ? 0.74 : 0.3;
      const angle = (point / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (point === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.26,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.04,
      bevelSegments: 1,
      curveSegments: 1,
    });
    geometry.center();
    geometry.userData.special = true;
    const entry = createFinishMaterial(THREE, physical, color, emissive, 'metal');
    return {
      object: new THREE.Mesh(geometry, entry.material),
      materials: [entry],
      geometries: [geometry],
      drawCalls: 1,
    };
  }

  function createChaosSpecials(THREE, level, physical, palette) {
    const list = [
      createLinkedRings(THREE, level, physical, palette, 0, level === 'high' ? 3 : 2),
      createDistortedSolid(THREE, level, physical, palette[1], palette[4], 1.7),
    ];
    if (level !== 'low') {
      list.push(createLinkedRings(THREE, level, physical, palette, 3, 2));
      list.push(createDistortedSolid(THREE, level, physical, palette[5], palette[2], 2.4, 'torus'));
    }
    if (level === 'high') {
      list.push(createStarPrism(THREE, physical, palette[6], palette[0]));
    }
    return list;
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

  function createScrollController(root, options) {
    const state = {
      offset: 0,
      target: 0,
      min: 0,
      openingLength: options.openingLength,
      contentLength: 0,
      lambda: options.lambda,
      enabled: false,
      listeners: new Set(),
      published: '',
      frame: 0,
      lastTime: 0,
    };
    let touchY = null;

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

    function publish() {
      const sample = sampleFrom(state.offset);
      const key = sample.mode + '|' + sample.openingProgress.toFixed(4) + '|' + sample.contentProgress.toFixed(4);
      if (key === state.published) return;
      state.published = key;
      root.dataset.scrollOffset = String(Math.round(sample.offset));
      root.dataset.progress = sample.openingProgress.toFixed(4);
      root.dataset.mode = sample.mode;
      state.listeners.forEach((listener) => listener(sample));
    }

    function step(now) {
      const dt = state.lastTime === 0 ? 1 / 60 : Math.min((now - state.lastTime) / 1000, 0.05);
      state.lastTime = now;
      if (state.lambda <= 0) {
        state.offset = state.target;
      } else {
        state.offset = damp(state.offset, state.target, state.lambda, dt);
        if (Math.abs(state.offset - state.target) < 0.05) state.offset = state.target;
      }
      publish();
      if (state.offset !== state.target) {
        state.frame = requestAnimationFrame(step);
      } else {
        state.frame = 0;
        state.lastTime = 0;
      }
    }

    function wake() {
      if (state.frame) return;
      state.lastTime = 0;
      state.frame = requestAnimationFrame(step);
    }

    function addDelta(delta) {
      const next = clampOffset(state.target + delta);
      if (next === state.target) return;
      state.target = next;
      wake();
    }

    function onWheel(event) {
      if (!state.enabled || event.ctrlKey) return;
      let delta = event.deltaY;
      if (event.deltaMode === 1) delta *= 16;
      if (event.deltaMode === 2) delta *= root.clientHeight || window.innerHeight;
      event.preventDefault();
      if (delta === 0) return;
      addDelta(delta);
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
      if (delta === 0) return;
      addDelta(delta);
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
      addDelta(delta);
    }

    function onResize() {
      const previousOpening = state.openingLength || 1;
      const openingProgress = Math.min(1, Math.max(0, state.target / previousOpening));
      const contentOffset = Math.max(0, state.target - previousOpening);
      const displayedProgress = Math.min(1, Math.max(0, state.offset / previousOpening));
      const displayedContent = Math.max(0, state.offset - previousOpening);
      state.openingLength = measureOpeningLength();
      state.target = clampOffset(openingProgress * state.openingLength + contentOffset);
      state.offset = clampOffset(displayedProgress * state.openingLength + displayedContent);
      wake();
    }

    return {
      getOffset() {
        return state.offset;
      },
      getTarget() {
        return state.target;
      },
      getProgress() {
        return sampleFrom(state.offset).openingProgress;
      },
      setContentLength(length) {
        state.contentLength = Math.max(0, Number(length) || 0);
        state.target = clampOffset(state.target);
        state.offset = clampOffset(state.offset);
        wake();
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
        window.addEventListener('resize', onResize);
      },
    };
  }

  function damp(current, target, lambda, dt) {
    return target + (current - target) * Math.exp(-lambda * dt);
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
