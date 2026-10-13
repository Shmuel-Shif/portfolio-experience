export const PATH_SPAN = 548;
export const FLIGHT_END = 0.58;
const SUCTION_SPAN = 0.08;
const SUCTION_END = FLIGHT_END + SUCTION_SPAN;

export function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function gentleStep(value) {
  const t = clamp01(value);
  return t * 0.22 + smoothstep(t) * 0.78;
}

export function phases(progress) {
  const t = clamp01(progress);
  const flightU = clamp01(t / FLIGHT_END);
  const flight = flightU + (smoothstep(flightU) - flightU) * 0.15;
  const suction = gentleStep((t - FLIGHT_END) / SUCTION_SPAN);
  const spiralIn = smoothstep(clamp01((t - FLIGHT_END) / 0.045));
  const color = smoothstep(clamp01((t - (SUCTION_END - 0.03)) / 0.1));
  const shrink = smoothstep(clamp01((t - (SUCTION_END - 0.005)) / 0.018));
  const glow = smoothstep(clamp01((t - (SUCTION_END - 0.009)) / 0.056));
  const white = smoothstep(clamp01((t - (SUCTION_END + 0.022)) / 0.008));
  const line = smoothstep(clamp01((t - (SUCTION_END + 0.02)) / 0.012));
  const lineOut = smoothstep(clamp01((t - (SUCTION_END + 0.048)) / 0.008));
  const lineIn = smoothstep(clamp01((t - (SUCTION_END + 0.056)) / 0.01));
  const lineExit = smoothstep(clamp01((t - (SUCTION_END + 0.074)) / 0.008));
  const night = smoothstep(clamp01((t - (SUCTION_END + 0.08)) / 0.008));
  const logo = smoothstep(clamp01((t - (SUCTION_END + 0.084)) / 0.008));
  const header = smoothstep(clamp01((t - (SUCTION_END + 0.086)) / 0.006));
  const site = smoothstep(clamp01((t - (SUCTION_END + 0.088)) / 0.012));
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

export const ILLUSION_GATE = FLIGHT_END;
export const ILLUSION_DONE = SUCTION_END + 0.033;
const SUCTION_SLOW = 1.45;
const ILLUSION_SUCK = 10;
const ILLUSION_HOLD = 2.05;
const ILLUSION_EXTEND = 2.2;
const ILLUSION_FINISH = 1.15 * SUCTION_SLOW;

export function illusionProgress(elapsed, origin = ILLUSION_GATE) {
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const start = Math.min(0.84, Math.max(ILLUSION_GATE, origin));
  const suckEnd = 0.7;
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
    const u = time / suck;
    return from + (suckEnd - from) * (u * 0.22 + smoothstep(u) * 0.78);
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
