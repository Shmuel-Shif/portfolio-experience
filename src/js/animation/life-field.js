import { PATH_SPAN, phases, clamp01, smoothstep } from './timeline.js';

const CELL_COLORS = [0xc4383a, 0x7a1830, 0x2f6fe0, 0x1498a8, 0x7a3fd4, 0xe07a2f, 0x2f9a62, 0xd45286];

export function createLifeField(THREE, level) {
  const cellCount = level === 'low' ? 32 : level === 'medium' ? 56 : 80;
  const fiberCount = level === 'low' ? 6 : level === 'medium' ? 10 : 14;
  const dustCount = level === 'low' ? 70 : level === 'medium' ? 120 : 170;
  const membraneCount = level === 'low' ? 3 : 5;
  const geometries = [];
  const materials = [];
  const group = new THREE.Group();
  group.renderOrder = 0;

  const cellGeometry = new THREE.SphereGeometry(1, level === 'low' ? 12 : 20, level === 'low' ? 10 : 16);
  const cellMaterial = new THREE.MeshPhongMaterial({
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    shininess: 48,
    specular: new THREE.Color(0xffffff),
    toneMapped: false,
  });
  geometries.push(cellGeometry);
  materials.push(cellMaterial);
  const cells = new THREE.InstancedMesh(cellGeometry, cellMaterial, cellCount);
  cells.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cellCount * 3), 3);
  const cellBase = [];
  const color = new THREE.Color();
  for (let index = 0; index < cellCount; index += 1) {
    cellBase.push({
      x: Math.sin(index * 2.17) * (2.4 + (index % 5) * 0.85),
      y: Math.cos(index * 1.43) * (1.5 + (index % 4) * 0.45),
      z: -36 - ((index + 0.5) / cellCount) * (PATH_SPAN - 12),
      scale: index % 6 === 0 ? 2.15 + (index % 3) * 0.55 : index % 3 === 0 ? 0.85 : 0.24 + (index % 4) * 0.08,
      flat: 1,
      phase: index * 0.7,
      parallax: 0.22 + (index % 5) * 0.08,
    });
    color.setHex(CELL_COLORS[index % CELL_COLORS.length]);
    cells.setColorAt(index, color);
  }
  if (cells.instanceColor) cells.instanceColor.needsUpdate = true;
  cells.visible = false;
  group.add(cells);

  const fibers = [];
  for (let index = 0; index < fiberCount; index += 1) {
    const points = 28;
    const positions = new Float32Array(points * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: index % 2 === 0 ? 0xf4f7fb : CELL_COLORS[index % CELL_COLORS.length],
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      toneMapped: false,
    });
    geometries.push(geometry);
    materials.push(material);
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    line.visible = false;
    group.add(line);
    fibers.push({
      line,
      points,
      x: Math.sin(index * 1.9) * 2.4,
      y: Math.cos(index * 1.2) * 1.4,
      z: -48 - ((index + 0.3) / fiberCount) * (PATH_SPAN - 16),
      amp: 0.35 + (index % 3) * 0.2,
      parallax: 0.18 + index * 0.03,
    });
  }

  const dustPositions = new Float32Array(dustCount * 3);
  const dustBase = [];
  for (let index = 0; index < dustCount; index += 1) {
    dustBase.push({
      x: Math.sin(index * 3.1) * (2 + (index % 7) * 0.4),
      y: Math.cos(index * 2.2) * 1.8,
      z: -30 - ((index + 0.2) / dustCount) * PATH_SPAN,
      parallax: 0.3 + (index % 4) * 0.1,
    });
    dustPositions[index * 3] = dustBase[index].x;
    dustPositions[index * 3 + 1] = dustBase[index].y;
    dustPositions[index * 3 + 2] = dustBase[index].z;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.03,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    sizeAttenuation: true,
    toneMapped: false,
  });
  geometries.push(dustGeometry);
  materials.push(dustMaterial);
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.frustumCulled = false;
  dust.visible = false;
  group.add(dust);

  const nebula = createNebula(THREE);
  geometries.push(nebula.geometry);
  materials.push(nebula.material);
  group.add(nebula.mesh);

  const membraneGeometry = new THREE.SphereGeometry(1, 16, 10);
  geometries.push(membraneGeometry);
  const membranes = [];
  for (let index = 0; index < membraneCount; index += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: CELL_COLORS[index % CELL_COLORS.length],
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    materials.push(material);
    const mesh = new THREE.Mesh(membraneGeometry, material);
    mesh.visible = false;
    group.add(mesh);
    membranes.push({
      mesh,
      x: Math.cos(index * 2.4) * 1.8,
      y: Math.sin(index * 1.7) * 0.8,
      z: -44 - ((index + 0.5) / membraneCount) * (PATH_SPAN - 16),
      scale: 1.4 + index * 0.35,
      parallax: 0.12 + index * 0.04,
    });
  }

  const dummy = new THREE.Object3D();
  const coreZ = -PATH_SPAN - 2;

  function seek(progress, camera) {
    const phase = phases(progress);
    const pull = phase.suction;
    const hidden = phase.white > 0.3;
    group.visible = !hidden;
    if (hidden) return;
    nebula.material.uniforms.uDrift.value = phase.flight * 1.4;
    nebula.material.uniforms.uPull.value = pull;
    nebula.material.uniforms.uAspect.value = camera ? camera.aspect || 1 : 1;
    const night = smoothstep(clamp01((pull - 0.38) / 0.36));
    nebula.material.uniforms.uFade.value = 1 - night;
    nebula.mesh.visible = night < 0.985;
    if (phase.shrink > 0.01 || phase.white > 0.01) {
      group.visible = false;
      return;
    }
    const cameraZ = camera ? camera.position.z : 0;
    const dustIn = smoothstep(clamp01((phase.t - 0.045) / 0.04));
    const cellsIn = smoothstep(clamp01((phase.t - 0.09) / 0.05));
    const imagesLead = phase.t > 0.1;

    cells.visible = cellsIn > 0.02 && phase.spiralIn < 0.98;
    const portrait = camera && camera.aspect < 1;
    const half = portrait ? Math.tan((40 * Math.PI) / 360) * camera.aspect : 1;
    const dustFade = dustIn * (1 - smoothstep(clamp01((pull - 0.2) / 0.62)));
    dust.visible = dustFade > 0.03 && phase.spiralIn < 0.4;
    dust.material.opacity = 0.7 * dustFade;

    if (cells.visible) {
    for (let index = 0; index < cellCount; index += 1) {
      const cell = cellBase[index];
      const ahead = cameraZ - cell.z;
      const pass = clamp01((24 - ahead) / 26);
      const side = Math.sign(cell.x || (index % 2 === 0 ? 1 : -1));
      const reach = portrait
        ? Math.max(0.8, Math.min(2.6, half * (cell.scale > 1.4 ? 5.2 : 7)))
        : (cell.scale > 1.4 ? 5.4 : 8.4);
      const angle = cell.phase + pull * (2.5 + index * 0.01);
      let x = side * (reach - pass * reach * 2);
      let y = cell.y * Math.sin(pass * Math.PI) * (portrait ? 0.62 : 1);
      let z = cell.z - (1 - pass) * 12 + pass * 3;
      const local = clamp01((pull - (index % 7) * 0.02) / 0.82);
      const swallowed = phase.spiralIn > 0.08 ? smoothstep(clamp01((local - 0.58) / 0.36)) : 0;
      x = x * (1 - local) + Math.cos(angle) * (0.35 + cell.scale * 0.15) * (1 - local);
      y = y * (1 - local) + Math.sin(angle) * 0.28 * (1 - local);
      z = z * (1 - local) + coreZ * local;
      const pulse = 1 + Math.sin(phase.t * Math.PI * 2 + cell.phase) * 0.08;
      const shrink = (1 - local * 0.92) * (1 - swallowed);
      dummy.position.set(x, y, z);
      const passScale = (0.2 + 0.8 * pass) * cellsIn;
      const showCell = cellsIn > 0.02 && pass > 0.04 && pass < 0.96;
      dummy.scale.set(
        showCell ? cell.scale * pulse * shrink * passScale : 0,
        showCell ? cell.scale * cell.flat * pulse * shrink * passScale : 0,
        showCell ? cell.scale * pulse * shrink * passScale : 0
      );
      dummy.updateMatrix();
      cells.setMatrixAt(index, dummy.matrix);
    }
    cells.instanceMatrix.needsUpdate = true;
    }

    fibers.forEach((fiber, fiberIndex) => {
      const fiberFade = imagesLead ? 1 - smoothstep(clamp01((pull - 0.28) / 0.62)) : 0;
      const fiberIn = fiberFade > 0.04 && phase.spiralIn < 0.4;
      fiber.line.visible = fiberIn;
      fiber.line.material.opacity = 0.45 * fiberFade;
      if (!fiberIn) return;
      const attribute = fiber.line.geometry.attributes.position;
      for (let point = 0; point < fiber.points; point += 1) {
        const u = point / (fiber.points - 1);
        const wave = Math.sin(u * 9 + phase.flight * 3 + fiberIndex) * fiber.amp;
        let x = fiber.x + wave;
        let y = fiber.y + Math.cos(u * 7 + phase.flight * 2) * fiber.amp * 0.65;
        let z = fiber.z - u * 14 + phase.flight * PATH_SPAN * fiber.parallax;
        z = wrapZ(z);
        const local = clamp01((pull - fiberIndex * 0.04) / 0.88);
        const angle = u * 4 + pull * 5 + fiberIndex;
        x = x * (1 - local) + Math.cos(angle) * (1.2 - u) * (1 - local);
        y = y * (1 - local) + Math.sin(angle) * 0.5 * (1 - local);
        z = z * (1 - local) + coreZ * local;
        attribute.setXYZ(point, x, y, z);
      }
      attribute.needsUpdate = true;
    });

    if (dust.visible) {
    const dustAttribute = dust.geometry.attributes.position;
    for (let index = 0; index < dustCount; index += 1) {
      const speck = dustBase[index];
      let x = speck.x;
      let y = speck.y + Math.sin(phase.flight * 2 + index) * 0.08;
      let z = wrapZ(speck.z + phase.flight * PATH_SPAN * speck.parallax);
      const local = clamp01((pull - (index % 9) * 0.02) / 0.9);
      const angle = index * 0.4 + pull * 6;
      x = x * (1 - local) + Math.cos(angle) * 0.7 * (1 - local);
      y = y * (1 - local) + Math.sin(angle) * 0.35 * (1 - local);
      z = z * (1 - local) + coreZ * local;
      dustAttribute.setXYZ(index, x, y, z);
    }
    dustAttribute.needsUpdate = true;
    }
    membranes.forEach((membrane, index) => {
      const z = wrapZ(membrane.z + phase.flight * PATH_SPAN * membrane.parallax);
      const camZ = camera ? camera.position.z : 0;
      const dist = Math.abs(camZ - z);
      const local = clamp01((pull - index * 0.05) / 0.85);
      const showMembrane = !portrait && dist > 14 && cellsIn > 0.35 && phase.spiralIn < 0.02;
      membrane.mesh.visible = showMembrane;
      if (!showMembrane) return;
      const angle = index + pull * 3;
      membrane.mesh.position.set(
        membrane.x * (1 - local) + Math.cos(angle) * (1 - local),
        membrane.y * (1 - local),
        z * (1 - local) + coreZ * local
      );
      const membraneFade = 1 - smoothstep(clamp01((pull - 0.15) / 0.5));
      const size = Math.min(1.15, membrane.scale * (1 - local * 0.9) * cellsIn);
      membrane.mesh.scale.set(size, size * 0.62, size * 0.8);
      membrane.mesh.material.opacity = 0.08 * (1 - local) * membraneFade;
    });
  }

  return {
    group,
    geometries,
    materials,
    seek,
    shown() {
      return { cells: cells.visible, dust: dust.visible };
    },
  };
}

function createNebula(THREE) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    uniforms: {
      uDrift: { value: 0 },
      uPull: { value: 0 },
      uAspect: { value: 1 },
      uFade: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uDrift;
      uniform float uPull;
      uniform float uAspect;
      uniform float uFade;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float weight = 0.5;
        for (int index = 0; index < 5; index++) {
          value += weight * noise(p);
          p *= 2.05;
          weight *= 0.5;
        }
        return value;
      }
      void main() {
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        float pull = clamp(uPull, 0.0, 1.0);
        p *= mix(1.0, 0.22, smoothstep(0.0, 1.0, pull));
        p += vec2(uDrift * 0.35, sin(uDrift) * 0.08);
        float n1 = fbm(p * 1.35 + vec2(uDrift * 0.2, 0.0));
        float n2 = fbm(p * 2.4 - vec2(0.0, uDrift * 0.15));
        float n3 = fbm(p * 3.6 + n1);
        vec3 deep = vec3(0.02, 0.025, 0.07);
        vec3 teal = vec3(0.08, 0.55, 0.72);
        vec3 violet = vec3(0.42, 0.16, 0.72);
        vec3 rose = vec3(0.86, 0.22, 0.48);
        vec3 gold = vec3(0.95, 0.55, 0.16);
        vec3 color = mix(deep, teal, smoothstep(0.28, 0.62, n1));
        color = mix(color, violet, smoothstep(0.34, 0.7, n2) * 0.9);
        color = mix(color, rose, smoothstep(0.42, 0.78, n1 * n2) * 0.75);
        color = mix(color, gold, smoothstep(0.55, 0.86, n3) * 0.55);
        vec2 starCell = floor(vUv * vec2(uAspect, 1.0) * 90.0);
        float star = hash(starCell);
        vec2 starUv = fract(vUv * vec2(uAspect, 1.0) * 90.0) - 0.5;
        float starMask = smoothstep(0.08, 0.0, length(starUv)) * step(0.86, star);
        color += vec3(0.9, 0.95, 1.0) * starMask * (1.0 - smoothstep(0.35, 0.95, pull));
        float gather = smoothstep(0.28, 0.95, pull);
        float edge = smoothstep(0.12, 0.9, length(p));
        color *= mix(1.0, 1.0 - edge * 0.85, gather);
        float vignette = smoothstep(1.05, 0.2, length(vUv - 0.5));
        gl_FragColor = vec4(color * vignette, uFade);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  return { mesh, geometry, material };
}

function wrapZ(z) {
  const span = PATH_SPAN + 18;
  let value = z;
  while (value > 6) value -= span;
  while (value < -PATH_SPAN - 12) value += span;
  return value;
}
