import { PATH_SPAN, phases, smoothstep, clamp01 } from './timeline.js';

const MEAT = '41-surreal-burger';
const DAIRY = '42-planet-ice-cream';

export function assignHomes(actors, rng) {
  const random = rng || (() => 0.5);
  const last = Math.max(1, actors.length - 1);
  actors.forEach((actor, pathIndex) => {
    const side = pathIndex % 2 === 0 ? -1 : 1;
    const lane = (pathIndex % 5) - 2;
    const near = pathIndex % 6 === 0;
    const far = pathIndex % 6 === 3;
    const drift = random();
    actor.home = {
      x: Math.sin(pathIndex * 1.67 + drift * 2) * (near ? 0.55 : 2.4) + lane * (near ? 0.2 : 0.85),
      y: Math.cos(pathIndex * 1.21 + drift) * (near ? 0.35 : 1.45) + ((pathIndex % 3) - 1) * 0.28,
      z: -42 - (pathIndex / last) * (PATH_SPAN - 26),
    };
    actor.entry = {
      x: side * (0.15 + random() * 0.45),
      y: (random() - 0.5) * 0.4,
    };
    actor.exit = side;
    actor.near = near;
    actor.baseScale = (near ? 1.04 : far ? 0.54 : 0.79) + random() * 0.09;
    if (far) actor.home.x *= 1.45;
    actor.spin = (random() < 0.5 ? -1 : 1) * (0.04 + random() * 0.05);
    actor.roll = (random() - 0.5) * 0.12;
    actor.swirl = random() * Math.PI * 2;
    actor.turns = (random() < 0.5 ? -1 : 1) * (0.85 + random() * 1.15);
    actor.orbit = 0.85 + random() * 2.4;
    actor.sink = 0.8 + random() * 2.2;
    actor.delay = random() * 0.34;
  });
  separateFood(actors);
}

function separateFood(actors) {
  const meat = actors.findIndex((actor) => actor.id === MEAT);
  const dairy = actors.findIndex((actor) => actor.id === DAIRY);
  if (meat < 0 || dairy < 0) return;
  if (Math.abs(meat - dairy) >= 16) return;
  const destination = Math.min(actors.length - 1, Math.max(0, dairy + (dairy > meat ? 18 : -18)));
  if (destination === meat) return;
  const swap = actors[destination];
  actors[destination] = actors[dairy];
  actors[dairy] = swap;
  actors.forEach((actor, pathIndex) => {
    const last = Math.max(1, actors.length - 1);
    actor.home.z = -42 - (pathIndex / last) * (PATH_SPAN - 26);
  });
}

export function applyObjects(actors, cameraZ, progress, reduced, narrow) {
  const phase = phases(progress);
  const motion = reduced ? 0.28 : 1;
  const coreZ = -PATH_SPAN - 2;
  let prominent = 0;

  actors.forEach((actor) => {
    if (!actor.ready) {
      actor.object.visible = false;
      return;
    }
    const ahead = cameraZ - actor.home.z;
    const span = actor.near ? 46 : 62;
    const pass = clamp01((span + 8 - ahead) / span);
    const side = actor.exit || 1;
    const reach = (actor.near ? 7.6 : 9.4) * (narrow ? 0.46 : 1);
    let x = side * (reach - pass * reach * 2) * motion;
    let y = (actor.home.y * Math.sin(pass * Math.PI) + actor.entry.y * (1 - pass)) * (narrow ? 0.78 : 1);
    let z = actor.home.z - (1 - pass) * 6 + pass * 3;
    const pull = smoothstep(clamp01((phase.suction - actor.delay) / Math.max(0.12, 1 - actor.delay)));
    const angle = actor.swirl + pull * pull * actor.turns * Math.PI * 2.6;
    const radius = actor.orbit * (1 - pull);
    x = x * (1 - pull) + Math.cos(angle) * radius;
    y = y * (1 - pull) + Math.sin(angle * 0.85) * radius * 0.62;
    z = z * (1 - pull) + (coreZ - pull * actor.sink) * pull;
    const approach = 0.38 + pass * 0.42;
    const close = actor.near ? smoothstep(clamp01((pass - 0.55) / 0.35)) * 0.22 : 0;
    const scale = Math.min(narrow ? 1.9 : 1.27, actor.baseScale * (approach + close) * (narrow ? 1.48 : 1) * (1 - pull * 0.99));
    const imagesOpen = smoothstep(clamp01((phase.t - 0.1) / 0.04));
    const swallow = smoothstep(clamp01((pull - 0.92) / 0.08));
    const flying = imagesOpen > 0.02 && pull < 0.04 && pass > 0.02 && pass < 0.995 && phase.spiral < 0.35;
    const sucking = pull >= 0.04 && swallow < 0.98 && phase.shrink < 0.01 && phase.white < 0.01 && scale > 0.012;
    const show = (flying || sucking) && phase.white < 0.01 && phase.shrink < 0.01;
    if (!show) {
      if (actor.object.visible) actor.object.visible = false;
      return;
    }
    const aspect = actor.aspect || 1;
    const leave = smoothstep(clamp01((pass - 0.84) / 0.16));
    actor.object.position.set(x, y, z);
    actor.object.rotation.set(
      0,
      0,
      actor.roll + Math.sin(progress * Math.PI * 2 + actor.swirl) * actor.spin * motion * (1 - pull) + pull * pull * actor.turns
    );
    actor.object.scale.set(Math.max(scale, 0.001) * aspect, Math.max(scale, 0.001), 1);
    if (actor.material) actor.material.opacity = (1 - leave * 0.45) * (flying ? imagesOpen : 1) * (1 - swallow);
    actor.object.visible = true;
    if (flying && pass > 0.2 && pass < 0.8) prominent += 1;
  });

  return prominent;
}
