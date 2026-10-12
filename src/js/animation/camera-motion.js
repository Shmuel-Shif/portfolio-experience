import { PATH_SPAN, phases } from './timeline.js';

export function applyCamera(camera, progress, reduced, narrow) {
  const phase = phases(progress);
  const sway = reduced ? 0.12 : 1;
  const travel = phase.flight * PATH_SPAN;
  const cruiseZ = 8 - travel;
  const coreZ = -PATH_SPAN - 2;
  const pull = phase.suction;
  const x = Math.sin(phase.flight * Math.PI * 3) * (narrow ? 0.5 : 0.9) * sway * (1 - pull);
  const y = 0.32 + Math.sin(phase.flight * Math.PI * 2) * 0.42 * sway * (1 - pull);
  const z = cruiseZ * (1 - pull) + (coreZ + 6.2) * pull;
  camera.position.set(x, y * (1 - pull) + 0.15 * pull, z);
  camera.lookAt(
    x * 0.1 * (1 - pull),
    0.08 * (1 - pull),
    (cruiseZ - 11) * (1 - pull) + coreZ * pull
  );
  return { cruiseZ, coreZ, phase };
}
