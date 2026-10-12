export function createSpiral(THREE) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uSpin: { value: 0 },
      uGrow: { value: 0 },
      uAspect: { value: 1 },
      uColor: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uSpin;
      uniform float uGrow;
      uniform float uAspect;
      uniform float uColor;
      void main() {
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        float r = length(p);
        float angle = atan(p.y, p.x);
        float cover = 0.5 * length(vec2(uAspect, 1.0));
        float radius = max(uGrow, 0.0) * cover * 1.25;
        float mask = 1.0 - smoothstep(radius, radius + 0.008, r);
        if (mask < 0.004) discard;
        float spiral = sin(angle * 8.0 - log(max(r, 0.0015)) * 10.0 + uSpin);
        float fine = sin(angle * 16.0 - log(max(r, 0.0015)) * 20.0 - uSpin * 0.5);
        float ink = step(0.0, spiral);
        vec3 light = mix(vec3(1.0), vec3(0.62, 0.28, 0.98), uColor);
        vec3 dark = mix(vec3(0.0), vec3(0.04, 0.12, 0.62), uColor);
        vec3 color = mix(light, dark, max(ink, step(0.94, fine)));
        color = mix(color, vec3(0.95, 0.62, 0.16), uColor * step(0.97, fine));
        gl_FragColor = vec4(color, mask);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  const distance = 1.2;
  return {
    mesh,
    geometry,
    material,
    seek(phase, camera) {
      const grow = phase.spiral * (1 - phase.flash);
      mesh.visible = grow > 0.012 && phase.white < 0.35;
      if (!mesh.visible) return;
      const aspect = camera.aspect || 1;
      const height = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance;
      const width = height * aspect;
      mesh.position.copy(camera.position);
      mesh.quaternion.copy(camera.quaternion);
      mesh.translateZ(-distance);
      mesh.scale.set(width * 0.5, height * 0.5, 1);
      material.uniforms.uAspect.value = aspect;
      material.uniforms.uGrow.value = grow * ((camera.aspect || 1) < 0.85 ? 1.2 : 1);
      material.uniforms.uColor.value = phase.color || 0;
      material.uniforms.uSpin.value = phase.spiralIn * 4 + Math.max(0, phase.t - 0.34) * 22;
    },
  };
}
