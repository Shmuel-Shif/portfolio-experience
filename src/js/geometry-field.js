const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

export function mountGeometryField(root) {
  const section = root.querySelector('[data-geometry]');
  if (!section) return;
  let view = null;
  let cancelled = false;
  let started = false;

  function start() {
    if (started || cancelled) return;
    if (section.clientWidth < 2 || section.clientHeight < 2) return;
    started = true;
    import(THREE_MODULE_URL).then((THREE) => {
      if (cancelled || !section.isConnected) return;
      view = createGeometryField(THREE, section);
    }).catch((error) => {
      console.error(error);
    });
  }

  start();
  const sizeWatch = new ResizeObserver(start);
  sizeWatch.observe(section);
  const content = section.closest('[data-content]');
  const hiddenWatch = new MutationObserver(start);
  if (content) hiddenWatch.observe(content, { attributes: true, attributeFilter: ['hidden'] });

  function dispose() {
    cancelled = true;
    sizeWatch.disconnect();
    hiddenWatch.disconnect();
    if (!view) return;
    view.dispose();
    view = null;
  }

  window.addEventListener('pagehide', dispose, { once: true });
}

function createGeometryField(THREE, section) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = () => (section.clientWidth || window.innerWidth) < 760;
  const dense = !coarse && !narrow();
  const widthSeg = dense ? 72 : 40;
  const heightSeg = dense ? 48 : 28;

  const renderer = new THREE.WebGLRenderer({
    antialias: !coarse,
    alpha: false,
    powerPreference: coarse ? 'low-power' : 'high-performance',
  });
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  section.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  camera.position.set(0, 0, 7.2);

  const group = new THREE.Group();
  scene.add(group);

  const surface = buildSphere(widthSeg, heightSeg);
  const directions = surface.directions;
  const positions = new Float32Array(directions.length);
  const colors = new Float32Array(directions.length);
  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute('position', pointGeometry.getAttribute('position'));
  gridGeometry.setAttribute('color', pointGeometry.getAttribute('color'));
  gridGeometry.setIndex(surface.grid);
  const contourGeometry = new THREE.BufferGeometry();
  contourGeometry.setAttribute('position', pointGeometry.getAttribute('position'));
  contourGeometry.setAttribute('color', pointGeometry.getAttribute('color'));
  contourGeometry.setIndex(surface.contours);

  const grid = new THREE.LineSegments(gridGeometry, lineMaterial(0.78));
  const contours = new THREE.LineSegments(contourGeometry, lineMaterial(0.95));
  const points = new THREE.Points(pointGeometry, new THREE.PointsMaterial({
    size: dense ? 0.018 : 0.028,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  grid.frustumCulled = false;
  contours.frustumCulled = false;
  points.frustumCulled = false;
  group.add(grid);
  group.add(contours);
  group.add(points);

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const homeFocal = new THREE.Vector3(0.62, 0.22, 0.75).normalize();
  const focal = homeFocal.clone();
  const fieldAxis = { x: 0, y: 0, z: 1, ready: false };
  const grip = { value: 0, velocity: 0 };
  const stretch = { value: 0, velocity: 0 };
  const bodyX = { value: 0, velocity: 0 };
  const bodyY = { value: 0, velocity: 0 };
  const noseX = { value: 0, velocity: 0 };
  const noseY = { value: 0, velocity: 0 };
  const CHASE = reduced ? 0.22 : 0.38;
  let radius = 1;
  let pointerActive = false;
  let touchActive = false;
  let pointerX = 0;
  let pointerY = 0;
  let strength = 0;
  let planeX = 0;
  let planeY = 0;
  let yaw = 0;
  let visible = false;
  let frame = 0;
  let lastTime = 0;
  let disposed = false;

  function lineMaterial(opacity) {
    return new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  function viewHalf() {
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfW = halfH * Math.max(0.35, camera.aspect);
    return { halfH, halfW };
  }

  function onScreen() {
    const rect = section.getBoundingClientRect();
    const viewH = window.innerHeight || document.documentElement.clientHeight || 0;
    return rect.width > 2 && rect.height > 2 && rect.bottom > 0 && rect.top < viewH;
  }

  function resize() {
    if (disposed) return;
    const width = section.clientWidth;
    const height = section.clientHeight;
    if (width < 2 || height < 2) return;
    const cap = coarse || width < 760 ? 1.15 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const { halfH, halfW } = viewHalf();
    radius = Math.min(halfH, halfW) * 0.64;
    writeSurface(0);
    if (onScreen()) renderer.render(scene, camera);
  }

  function shellRadius() {
    return radius * 1.16;
  }

  function pointerRay(clientX, clientY) {
    const rect = section.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNdc, camera);
    return true;
  }

  function projectPointer(clientX, clientY) {
    strength = 0;
    if (!pointerRay(clientX, clientY)) return false;
    const ray = raycaster.ray;
    const denom = ray.direction.z;
    if (Math.abs(denom) < 1e-4) return false;
    const depth = -ray.origin.z / denom;
    const { halfW, halfH } = viewHalf();
    planeX = Math.min(halfW, Math.max(-halfW, ray.origin.x + ray.direction.x * depth));
    planeY = Math.min(halfH, Math.max(-halfH, ray.origin.y + ray.direction.y * depth));
    if (!Number.isFinite(planeX) || !Number.isFinite(planeY)) return false;
    strength = 1;
    return true;
  }

  function stepSpring(spring, target, dt, omega, zeta) {
    const force = omega * omega * (target - spring.value) - 2 * zeta * omega * spring.velocity;
    spring.velocity += force * dt;
    spring.value += spring.velocity * dt;
  }

  function shapeOf(x, y, z, time) {
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;
    const theta = Math.acos(Math.min(1, Math.max(-1, ny)));
    const phi = Math.atan2(nz, nx);
    const breathe = reduced ? 0 : time * 0.22;
    const organic = Math.sin(theta * 2 + breathe) * Math.cos(phi * 2) * 0.028
      + Math.sin(phi * 2 - theta + breathe * 0.6) * 0.016
      + Math.cos(theta * 3 + phi) * 0.01;
    return 1 + organic;
  }

  function smoothstep(value) {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
  }

  function girthOf(u) {
    const t = Math.min(1, Math.max(0, u));
    const belly = Math.exp(-((t - 0.36) * (t - 0.36)) / 0.05);
    return 0.2 + 0.94 * belly;
  }

  function slideOf(u) {
    const t = Math.min(1, Math.max(0, u));
    return 0.22 * t + 0.78 * t * t;
  }

  function steerAxis(tx, ty, tz, dt) {
    const len = Math.hypot(tx, ty, tz);
    if (len < radius * 0.08) return;
    const dx = tx / len;
    const dy = ty / len;
    const dz = tz / len;
    if (!fieldAxis.ready) {
      fieldAxis.x = dx;
      fieldAxis.y = dy;
      fieldAxis.z = dz;
      fieldAxis.ready = true;
      return;
    }
    const dot = Math.min(1, Math.max(-1, fieldAxis.x * dx + fieldAxis.y * dy + fieldAxis.z * dz));
    const angle = Math.acos(dot);
    if (angle < 1e-4) {
      fieldAxis.x = dx;
      fieldAxis.y = dy;
      fieldAxis.z = dz;
      return;
    }
    const step = Math.min(1, (Math.max(dt, 0.0001) * 5.2) / angle);
    const denom = Math.sin(angle);
    const k0 = Math.sin((1 - step) * angle) / denom;
    const k1 = Math.sin(step * angle) / denom;
    fieldAxis.x = fieldAxis.x * k0 + dx * k1;
    fieldAxis.y = fieldAxis.y * k0 + dy * k1;
    fieldAxis.z = fieldAxis.z * k0 + dz * k1;
    const norm = Math.hypot(fieldAxis.x, fieldAxis.y, fieldAxis.z) || 1;
    fieldAxis.x /= norm;
    fieldAxis.y /= norm;
    fieldAxis.z /= norm;
  }

  function localTip(nx, ny, bx, by) {
    const dx = nx - bx;
    const dy = ny - by;
    const dz = shellRadius() * 0.08;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return {
      x: c * dx - s * dz,
      y: dy,
      z: s * dx + c * dz,
    };
  }

  function worldOf(px, py, pz, bx, by) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return {
      x: c * px + s * pz + bx,
      y: py + by,
      z: -s * px + c * pz,
    };
  }

  function slimeLocal(x, y, z, time, tip, stretchNow, blend) {
    const shaped = shapeOf(x, y, z, time) * radius;
    let px = x * shaped;
    let py = y * shaped;
    let pz = z * shaped;
    let along = 0;
    const axisLen = Math.hypot(fieldAxis.x, fieldAxis.y, fieldAxis.z);
    if (blend > 0 && axisLen > 1e-6 && Number.isFinite(tip.x + tip.y + tip.z)) {
      const ax = fieldAxis.x / axisLen;
      const ay = fieldAxis.y / axisLen;
      const az = fieldAxis.z / axisLen;
      const align = Math.min(1, Math.max(-1, x * ax + y * ay + z * az));
      const u = (align + 1) * 0.5;
      let rx = x - ax * align;
      let ry = y - ay * align;
      let rz = z - az * align;
      const radialLen = Math.hypot(rx, ry, rz);
      if (radialLen > 1e-5) {
        rx /= radialLen;
        ry /= radialLen;
        rz /= radialLen;
      }
      const slide = slideOf(u);
      const wave = reduced ? 0 : Math.sin(u * 5.5 - time * 1.5) * Math.sin(u * Math.PI) * stretchNow * radius * 0.03;
      const thick = radius * girthOf(u) + wave;
      const tailReach = radius * (1.05 + Math.max(0, stretchNow) * (reduced ? 0.2 : 0.9));
      const tailX = -ax * tailReach;
      const tailY = -ay * tailReach;
      const tailZ = -az * tailReach;
      const sx = tailX + (tip.x - tailX) * slide + rx * thick;
      const sy = tailY + (tip.y - tailY) * slide + ry * thick;
      const sz = tailZ + (tip.z - tailZ) * slide + rz * thick;
      if (Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(sz)) {
        px += (sx - px) * blend;
        py += (sy - py) * blend;
        pz += (sz - pz) * blend;
      }
      along = slide;
    }
    return { x: px, y: py, z: pz, along };
  }

  function poseBounds(nx, ny, bx, by, stretchNow, blend, time) {
    const tip = localTip(nx, ny, bx, by);
    const count = directions.length / 3;
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    const aspect = Math.max(0.35, camera.aspect);
    let maxRatio = 0;
    let pushInX = 0;
    let pushOutX = 0;
    let pushInY = 0;
    let pushOutY = 0;
    for (let index = 0; index < count; index += 1) {
      const local = slimeLocal(
        directions[index * 3],
        directions[index * 3 + 1],
        directions[index * 3 + 2],
        time,
        tip,
        stretchNow,
        blend
      );
      const world = worldOf(local.x, local.y, local.z, bx, by);
      const dist = camera.position.z - world.z;
      if (!(dist > 0.35) || !Number.isFinite(world.x) || !Number.isFinite(world.y)) {
        maxRatio = Math.max(maxRatio, 2);
        continue;
      }
      const halfH = tanHalf * dist;
      const halfW = halfH * aspect;
      const roomX = halfW * 0.955;
      const roomY = halfH * 0.955;
      maxRatio = Math.max(maxRatio, Math.abs(world.x) / Math.max(halfW, 1e-4), Math.abs(world.y) / Math.max(halfH, 1e-4));
      if (world.x > roomX) pushInX = Math.min(pushInX, roomX - world.x);
      if (world.x < -roomX) pushOutX = Math.max(pushOutX, -roomX - world.x);
      if (world.y > roomY) pushInY = Math.min(pushInY, roomY - world.y);
      if (world.y < -roomY) pushOutY = Math.max(pushOutY, -roomY - world.y);
    }
    return {
      excess: maxRatio - 0.955,
      nudgeX: pushInX < -1e-4 && pushOutX > 1e-4 ? 0 : pushInX + pushOutX,
      nudgeY: pushInY < -1e-4 && pushOutY > 1e-4 ? 0 : pushInY + pushOutY,
      conflict: (pushInX < -1e-4 && pushOutX > 1e-4) || (pushInY < -1e-4 && pushOutY > 1e-4),
    };
  }

  function containPose(nx, ny, bx, by, stretchNow, blend, time) {
    let x = nx;
    let y = ny;
    let bodyX = bx;
    let bodyY = by;
    let stretch = Math.max(0, stretchNow);
    if (blend <= 0.001) return { nx: x, ny: y, bx: bodyX, by: bodyY, stretch };
    for (let step = 0; step < 8; step += 1) {
      const bounds = poseBounds(x, y, bodyX, bodyY, stretch, blend, time);
      if (bounds.excess <= 0.0005) return { nx: x, ny: y, bx: bodyX, by: bodyY, stretch };
      if (bounds.conflict || (Math.abs(bounds.nudgeX) < 1e-4 && Math.abs(bounds.nudgeY) < 1e-4)) break;
      x += bounds.nudgeX;
      y += bounds.nudgeY;
      bodyX += bounds.nudgeX;
      bodyY += bounds.nudgeY;
    }
    const fullX = x;
    const fullY = y;
    const fullBodyX = bodyX;
    const fullBodyY = bodyY;
    const fullStretch = stretch;
    if (poseBounds(fullX, fullY, fullBodyX, fullBodyY, fullStretch, blend, time).excess <= 0.0005) {
      return { nx: fullX, ny: fullY, bx: fullBodyX, by: fullBodyY, stretch: fullStretch };
    }
    let lo = 0;
    let hi = 1;
    for (let step = 0; step < 10; step += 1) {
      const mid = (lo + hi) * 0.5;
      if (poseBounds(fullX * mid, fullY * mid, fullBodyX * mid, fullBodyY * mid, fullStretch * mid, blend, time).excess <= 0.0005) lo = mid;
      else hi = mid;
    }
    return {
      nx: fullX * lo,
      ny: fullY * lo,
      bx: fullBodyX * lo,
      by: fullBodyY * lo,
      stretch: fullStretch * lo,
    };
  }

  function writeSurface(time, pose) {
    const position = pointGeometry.getAttribute('position');
    const color = pointGeometry.getAttribute('color');
    const pos = position.array;
    const col = color.array;
    const count = directions.length / 3;
    const shown = pose || { nx: 0, ny: 0, bx: 0, by: 0, stretch: 0, blend: 0 };
    const tip = localTip(shown.nx, shown.ny, shown.bx, shown.by);
    for (let index = 0; index < count; index += 1) {
      const x = directions[index * 3];
      const y = directions[index * 3 + 1];
      const z = directions[index * 3 + 2];
      const local = slimeLocal(x, y, z, time, tip, shown.stretch, shown.blend);
      const px = local.x;
      const py = local.y;
      const pz = local.z;
      const influence = local.along * shown.blend;
      pos[index * 3] = px;
      pos[index * 3 + 1] = py;
      pos[index * 3 + 2] = pz;
      const dot = Math.min(1, Math.max(-1, x * focal.x + y * focal.y + z * focal.z));
      const angle = Math.acos(dot);
      const focus = Math.exp(-angle * angle * 4.2);
      let ring = 0;
      const bands = [0.16, 0.32, 0.48, 0.64, 0.8];
      for (let band = 0; band < bands.length; band += 1) {
        const delta = (angle - bands[band]) / 0.028;
        ring = Math.max(ring, Math.exp(-delta * delta));
      }
      const bright = 0.42 + focus * 0.7 + ring * 0.55 + Math.min(influence, 1) * 0.45;
      col[index * 3] = 0.12 * bright;
      col[index * 3 + 1] = 0.78 * bright;
      col[index * 3 + 2] = 0.92 * bright;
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
  }

  function onVisibility() {
    if (!document.hidden && visible) wake();
  }

  function frameStep(now) {
    if (disposed) return;
    const width = section.clientWidth;
    const height = section.clientHeight;
    if (width > 2 && height > 2 && Math.abs(renderer.domElement.clientWidth - width) > 1) resize();
    visible = onScreen();
    if (!visible || document.hidden) {
      frame = 0;
      lastTime = 0;
      return;
    }
    frame = requestAnimationFrame(frameStep);
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60;
    lastTime = now;
    yaw += dt * (reduced ? 0.03 : 0.08);
    if (pointerActive) projectPointer(pointerX, pointerY);
    const goal = pointerActive ? strength : 0;
    const gripOmega = goal > 0 ? (reduced ? 8 : 14) : (reduced ? 5 : 4.4);
    const noseOmega = goal > 0 ? (reduced ? 8 : 16) : (reduced ? 5 : 4.2);
    const zeta = reduced ? 1.02 : 0.86;
    stepSpring(grip, goal, dt, gripOmega, zeta);
    stepSpring(noseX, goal > 0 ? planeX : 0, dt, noseOmega, zeta);
    stepSpring(noseY, goal > 0 ? planeY : 0, dt, noseOmega, zeta);
    stepSpring(stretch, Math.max(0, grip.value), dt, reduced ? 5 : 2.4, reduced ? 1.02 : 0.84);
    const held = Math.max(0, grip.value);
    stepSpring(bodyX, noseX.value * CHASE * held, dt, reduced ? 5 : 3.6, zeta);
    stepSpring(bodyY, noseY.value * CHASE * held, dt, reduced ? 5 : 3.6, zeta);
    const resting = goal <= 0
      && Math.abs(grip.value) < 0.0015
      && Math.abs(grip.velocity) < 0.008
      && Math.abs(noseX.value) < 0.012
      && Math.abs(noseY.value) < 0.012
      && Math.abs(noseX.velocity) < 0.02
      && Math.abs(noseY.velocity) < 0.02
      && Math.abs(stretch.value) < 0.0015
      && Math.abs(stretch.velocity) < 0.008
      && Math.abs(bodyX.value) < 0.012
      && Math.abs(bodyY.value) < 0.012
      && Math.abs(bodyX.velocity) < 0.02
      && Math.abs(bodyY.velocity) < 0.02;
    if (resting) {
      grip.value = 0;
      grip.velocity = 0;
      stretch.value = 0;
      stretch.velocity = 0;
      noseX.value = 0;
      noseY.value = 0;
      noseX.velocity = 0;
      noseY.velocity = 0;
      bodyX.value = 0;
      bodyY.value = 0;
      bodyX.velocity = 0;
      bodyY.velocity = 0;
    }
    if (!Number.isFinite(bodyX.value) || !Number.isFinite(bodyY.value) || !Number.isFinite(noseX.value) || !Number.isFinite(noseY.value)) {
      bodyX.value = 0;
      bodyY.value = 0;
      bodyX.velocity = 0;
      bodyY.velocity = 0;
      noseX.value = 0;
      noseY.value = 0;
      noseX.velocity = 0;
      noseY.velocity = 0;
    }
    const elapsed = now / 1000;
    const blend = Math.min(1, Math.max(0, grip.value));
    const aimTip = localTip(noseX.value, noseY.value, bodyX.value, bodyY.value);
    steerAxis(aimTip.x, aimTip.y, aimTip.z, dt);
    const contained = containPose(
      noseX.value,
      noseY.value,
      bodyX.value,
      bodyY.value,
      Math.max(0, stretch.value),
      blend,
      elapsed
    );
    const pose = {
      nx: contained.nx,
      ny: contained.ny,
      bx: contained.bx,
      by: contained.by,
      stretch: contained.stretch,
      blend,
    };
    group.position.set(pose.bx, pose.by, 0);
    group.rotation.set(0, yaw, 0);
    writeSurface(elapsed, pose);
    renderer.render(scene, camera);
  }

  function wake() {
    if (frame || disposed) return;
    lastTime = 0;
    frame = requestAnimationFrame(frameStep);
  }

  function rememberPointer(clientX, clientY) {
    pointerX = clientX;
    pointerY = clientY;
  }

  function onPointerMove(event) {
    if (event.pointerType === 'touch') return;
    rememberPointer(event.clientX, event.clientY);
    pointerActive = true;
    wake();
  }

  function onPointerLeave(event) {
    if (event.pointerType === 'touch' || touchActive) return;
    pointerActive = false;
    strength = 0;
    wake();
  }

  function onTouchStart(event) {
    if (event.touches.length !== 1) return;
    const point = event.touches[0];
    if (!projectPointer(point.clientX, point.clientY)) return;
    rememberPointer(point.clientX, point.clientY);
    touchActive = true;
    pointerActive = true;
    renderer.domElement.style.touchAction = 'none';
    wake();
  }

  function onTouchMove(event) {
    if (!touchActive || event.touches.length !== 1) return;
    const point = event.touches[0];
    event.preventDefault();
    event.stopPropagation();
    rememberPointer(point.clientX, point.clientY);
    pointerActive = true;
    wake();
  }

  function onTouchEnd() {
    if (!touchActive) return;
    touchActive = false;
    pointerActive = false;
    strength = 0;
    renderer.domElement.style.touchAction = 'pan-y';
    wake();
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) wake();
  }, { threshold: 0.01 });
  observer.observe(section);
  const boxWatch = new ResizeObserver(() => {
    resize();
    if (onScreen()) wake();
  });
  boxWatch.observe(section);
  const host = section.closest('#experience');
  const shiftWatch = host ? new MutationObserver(() => {
    if (onScreen()) wake();
  }) : null;
  if (shiftWatch) {
    shiftWatch.observe(host, { attributes: true, attributeFilter: ['data-scroll-offset', 'data-sealed'] });
  }

  section.addEventListener('pointermove', onPointerMove);
  section.addEventListener('pointerleave', onPointerLeave);
  section.addEventListener('touchstart', onTouchStart, { passive: true });
  section.addEventListener('touchmove', onTouchMove, { passive: false });
  section.addEventListener('touchend', onTouchEnd, { passive: true });
  section.addEventListener('touchcancel', onTouchEnd, { passive: true });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  const experience = section.closest('#experience');
  function nudge() {
    if (onScreen()) wake();
  }
  if (experience) {
    experience.addEventListener('wheel', nudge, { passive: true });
    experience.addEventListener('touchmove', nudge, { passive: true });
  }
  resize();
  writeSurface(0);
  wake();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      boxWatch.disconnect();
      if (shiftWatch) shiftWatch.disconnect();
      section.removeEventListener('pointermove', onPointerMove);
      section.removeEventListener('pointerleave', onPointerLeave);
      section.removeEventListener('touchstart', onTouchStart);
      section.removeEventListener('touchmove', onTouchMove);
      section.removeEventListener('touchend', onTouchEnd);
      section.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (experience) {
        experience.removeEventListener('wheel', nudge);
        experience.removeEventListener('touchmove', nudge);
      }
      delete section.dataset.hover;
      delete section.dataset.grabbing;
      renderer.domElement.style.touchAction = '';
      gridGeometry.deleteAttribute('position');
      gridGeometry.deleteAttribute('color');
      contourGeometry.deleteAttribute('position');
      contourGeometry.deleteAttribute('color');
      gridGeometry.dispose();
      contourGeometry.dispose();
      grid.material.dispose();
      contours.material.dispose();
      pointGeometry.dispose();
      points.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === section) section.removeChild(renderer.domElement);
    },
  };
}

function buildSphere(widthSeg, heightSeg) {
  const directions = [];
  const grid = [];
  const contours = [];

  function add(x, y, z) {
    const length = Math.hypot(x, y, z) || 1;
    directions.push(x / length, y / length, z / length);
    return directions.length / 3 - 1;
  }

  const poleNorth = add(0, 1, 0);
  const rings = [];
  for (let y = 1; y < heightSeg; y += 1) {
    const v = y / heightSeg;
    const theta = v * Math.PI;
    const ring = [];
    for (let x = 0; x < widthSeg; x += 1) {
      const phi = (x / widthSeg) * Math.PI * 2;
      ring.push(add(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)));
    }
    rings.push(ring);
  }
  const poleSouth = add(0, -1, 0);

  rings[0].forEach((id, x) => {
    grid.push(poleNorth, id);
    grid.push(id, rings[0][(x + 1) % widthSeg]);
  });
  for (let y = 0; y < rings.length - 1; y += 1) {
    for (let x = 0; x < widthSeg; x += 1) {
      const nextX = (x + 1) % widthSeg;
      grid.push(rings[y][x], rings[y][nextX]);
      grid.push(rings[y][x], rings[y + 1][x]);
    }
  }
  const last = rings[rings.length - 1];
  last.forEach((id, x) => {
    grid.push(id, last[(x + 1) % widthSeg]);
    grid.push(id, poleSouth);
  });

  const focal = { x: 0.62, y: 0.22, z: 0.75 };
  const focalLen = Math.hypot(focal.x, focal.y, focal.z);
  focal.x /= focalLen;
  focal.y /= focalLen;
  focal.z /= focalLen;
  const helper = Math.abs(focal.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let tx = helper.y * focal.z - helper.z * focal.y;
  let ty = helper.z * focal.x - helper.x * focal.z;
  let tz = helper.x * focal.y - helper.y * focal.x;
  const tLen = Math.hypot(tx, ty, tz) || 1;
  tx /= tLen;
  ty /= tLen;
  tz /= tLen;
  const bx = focal.y * tz - focal.z * ty;
  const by = focal.z * tx - focal.x * tz;
  const bz = focal.x * ty - focal.y * tx;
  const samples = widthSeg;
  const bands = [0.16, 0.32, 0.48, 0.64, 0.8];
  bands.forEach((angle) => {
    let previous = -1;
    const first = directions.length / 3;
    for (let step = 0; step < samples; step += 1) {
      const spin = (step / samples) * Math.PI * 2;
      const cx = Math.cos(angle);
      const sx = Math.sin(angle);
      const id = add(
        focal.x * cx + (tx * Math.cos(spin) + bx * Math.sin(spin)) * sx,
        focal.y * cx + (ty * Math.cos(spin) + by * Math.sin(spin)) * sx,
        focal.z * cx + (tz * Math.cos(spin) + bz * Math.sin(spin)) * sx
      );
      if (previous >= 0) contours.push(previous, id);
      previous = id;
    }
    contours.push(previous, first);
  });

  return { directions: new Float32Array(directions), grid, contours };
}
