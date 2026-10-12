import { phases } from './timeline.js';

export function applyBackground(backdrop, progress) {
  const phase = phases(progress);
  const white = phase.white;
  if (!backdrop) return;
  const shade = Math.round(255 * white);
  backdrop.style.background = `rgb(${shade}, ${shade}, ${shade})`;
}
