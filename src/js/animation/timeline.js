export const PATH_SPAN = 168;

export function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function phases(progress) {
  const t = clamp01(progress);
  const flightU = clamp01(t / 0.36);
  const flight = flightU + (smoothstep(flightU) - flightU) * 0.15;
  const suction = smoothstep(clamp01((t - 0.24) / 0.16));
  const spiralIn = smoothstep(clamp01((t - 0.34) / 0.07));
  const color = smoothstep(clamp01((t - 0.44) / 0.38));
  const shrink = smoothstep(clamp01((t - 0.88) / 0.018));
  const glow = smoothstep(clamp01((t - 0.864) / 0.056));
  const white = smoothstep(clamp01((t - 0.922) / 0.008));
  const line = smoothstep(clamp01((t - 0.92) / 0.012));
  const lineOut = smoothstep(clamp01((t - 0.948) / 0.008));
  const lineIn = smoothstep(clamp01((t - 0.956) / 0.01));
  const lineExit = smoothstep(clamp01((t - 0.974) / 0.008));
  const night = smoothstep(clamp01((t - 0.98) / 0.008));
  const logo = smoothstep(clamp01((t - 0.984) / 0.008));
  const header = smoothstep(clamp01((t - 0.986) / 0.006));
  const site = smoothstep(clamp01((t - 0.988) / 0.012));
  return {
    t,
    flight,
    suction,
    spiralIn,
    color,
    shrink,
    spiral: spiralIn * (1 - shrink),
    glow,
    flash: 0,
    white,
    line,
    lineOut,
    lineIn,
    lineExit,
    night,
    logo,
    header,
    site,
    brand: 0,
  };
}

export const ILLUSION_GATE = 0.34;
export const ILLUSION_DONE = 0.933;
const SUCTION_SLOW = 1.45;
const ILLUSION_SUCK = 2.6 * SUCTION_SLOW;
const ILLUSION_HOLD = 2.05;
const ILLUSION_EXTEND = 2.2;
const ILLUSION_FINISH = 1.15 * SUCTION_SLOW;

export function illusionProgress(elapsed, origin = ILLUSION_GATE) {
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const start = Math.min(0.84, Math.max(ILLUSION_GATE, origin));
  const suckEnd = 0.42;
  const holdEnd = 0.86;
  const suck = ILLUSION_SUCK;
  const hold = ILLUSION_HOLD;
  const extend = ILLUSION_EXTEND;
  const finish = ILLUSION_FINISH;
  const afterHold = suck + hold;
  const afterExtend = afterHold + extend;
  if (start >= holdEnd) {
    return start + (ILLUSION_DONE - start) * smoothstep(Math.min(1, time / finish));
  }
  if (time < suck) {
    const from = Math.min(start, suckEnd);
    return from + (suckEnd - from) * smoothstep(time / suck);
  }
  if (time < afterHold) {
    const u = (time - suck) / hold;
    return suckEnd + (holdEnd - suckEnd) * u;
  }
  if (time < afterExtend) return holdEnd;
  const u = smoothstep(Math.min(1, (time - afterExtend) / finish));
  return holdEnd + (ILLUSION_DONE - holdEnd) * u;
}

export function epilogueAt(time) {
  const elapsed = Number.isFinite(time) ? Math.max(0, time) : 0;
  const hold = 3;
  const lineOut = smoothstep(clamp01((elapsed - hold) / 0.42));
  const lineIn = smoothstep(clamp01((elapsed - (hold + 0.42)) / 0.5));
  const lineExit = smoothstep(clamp01((elapsed - (hold + 2.15)) / 0.45));
  const night = smoothstep(clamp01((elapsed - (hold + 2.45)) / 0.75));
  const logo = smoothstep(clamp01((elapsed - (hold + 2.85)) / 0.9));
  const header = smoothstep(clamp01((elapsed - (hold + 3.25)) / 0.65));
  const site = smoothstep(clamp01((elapsed - (hold + 3.55)) / 1.15));
  return {
    line: 1,
    lineOut,
    lineIn,
    lineExit,
    night,
    logo,
    header,
    site,
    white: 1,
    done: site > 0.98,
  };
}
