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
      uFov: { value: 46 },
      uColor: { value: 0 },
      uGlow: { value: 0 },
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
      uniform float uFov;
      uniform float uColor;
      uniform float uGlow;

      float ribbon(vec3 p) {
        float travel = uSpin * 0.22;
        float s = p.x * 0.62 + p.z * 0.16 - travel;
        float radius = mix(0.62, 0.9, smoothstep(0.72, 1.35, uAspect));
        float a = s * 1.05 + uSpin * 0.38;
        vec3 center = vec3(p.x, cos(a) * radius, -2.7 + sin(a) * radius);
        vec3 tangent = normalize(vec3(1.0, -sin(a) * radius * 0.65, cos(a) * radius * 0.65));
        vec3 radial = normalize(vec3(0.0, cos(a), sin(a)));
        vec3 binormal = normalize(cross(tangent, radial));
        vec3 rel = p - center;
        float across = dot(rel, radial);
        float thick = dot(rel, binormal);
        vec2 d = abs(vec2(thick, across)) - vec2(0.016, 0.26);
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      }

      float ribbonAcross(vec3 p) {
        float travel = uSpin * 0.22;
        float s = p.x * 0.62 + p.z * 0.16 - travel;
        float radius = mix(0.62, 0.9, smoothstep(0.72, 1.35, uAspect));
        float a = s * 1.05 + uSpin * 0.38;
        vec3 center = vec3(p.x, cos(a) * radius, -2.7 + sin(a) * radius);
        vec3 radial = normalize(vec3(0.0, cos(a), sin(a)));
        return dot(p - center, radial);
      }

      void main() {
        float halfH = tan(radians(uFov) * 0.5) * 1.2;
        float halfW = halfH * max(uAspect, 0.2);
        vec3 origin = vec3(0.0);
        vec3 ray = normalize(vec3((vUv - 0.5) * vec2(halfW, halfH) * 2.0, -1.2));
        float travel = 0.2;
        float hit = -1.0;
        for (int i = 0; i < 42; i++) {
          float dist = ribbon(origin + ray * travel);
          if (dist < 0.006) {
            hit = travel;
            break;
          }
          travel += max(dist * 0.82, 0.018);
          if (travel > 8.0) break;
        }
        float glowAmt = clamp(uGlow, 0.0, 1.0);
        float appear = smoothstep(0.02, 0.62, uGrow);
        if (hit < 0.0 && glowAmt < 0.28) discard;
        vec3 pos = origin + ray * max(hit, 1.6);
        vec3 normal = normalize(vec3(
          ribbon(pos + vec3(0.012, 0.0, 0.0)) - ribbon(pos - vec3(0.012, 0.0, 0.0)),
          ribbon(pos + vec3(0.0, 0.012, 0.0)) - ribbon(pos - vec3(0.0, 0.012, 0.0)),
          ribbon(pos + vec3(0.0, 0.0, 0.012)) - ribbon(pos - vec3(0.0, 0.0, 0.012))
        ));
        float across = hit < 0.0 ? 0.0 : ribbonAcross(pos);
        float light = clamp(dot(normal, normalize(vec3(0.25, 0.72, 0.45))), 0.0, 1.0);
        float edge = smoothstep(0.26, 0.08, abs(across));
        vec3 cyan = vec3(0.494, 0.906, 1.0);
        vec3 color = mix(vec3(0.02), vec3(0.96), light);
        color = mix(color, vec3(0.0), 1.0 - edge);
        color = mix(color, cyan, uColor * (0.35 + edge * 0.45));
        float miss = hit < 0.0 ? 1.0 : 0.0;
        float illumination = glowAmt * mix(edge, 0.55, glowAmt);
        illumination = max(illumination, smoothstep(0.78, 1.0, glowAmt) * (1.0 - miss * 0.35));
        color = mix(color, vec3(0.97), clamp(illumination, 0.0, 1.0));
        float alpha = mix(appear * edge, appear * (0.22 + illumination), miss);
        alpha = max(alpha, appear * illumination * 0.85);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, alpha);
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
    seek(phase, camera, spinExtra = 0) {
      const grow = phase.spiralIn || 0;
      mesh.visible = grow > 0.012 && (phase.white || 0) < 0.97;
      if (!mesh.visible) return;
      const aspect = camera.aspect || 1;
      const height = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance;
      const width = height * aspect;
      mesh.position.copy(camera.position);
      mesh.quaternion.copy(camera.quaternion);
      mesh.translateZ(-distance);
      mesh.scale.set(width * 0.5, height * 0.5, 1);
      material.uniforms.uAspect.value = aspect;
      material.uniforms.uFov.value = camera.fov || 46;
      material.uniforms.uGrow.value = grow * (aspect < 0.85 ? 1.2 : 1);
      material.uniforms.uColor.value = phase.color || 0;
      material.uniforms.uGlow.value = phase.glow || 0;
      const heldSpin = (phase.spiralIn || 0) * 4 + (phase.suction || 0) * 18 + (phase.color || 0) * 4;
      const spinElapsed = Math.max(0, Number(spinExtra) || 0);
      material.uniforms.uSpin.value = heldSpin + (22 * 0.44) / 2.05 * spinElapsed;
    },
  };
}
