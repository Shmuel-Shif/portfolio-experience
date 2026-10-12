import { PATH_SPAN, phases, smoothstep, clamp01 } from './timeline.js';

const MEAT = '41-surreal-burger';
const DAIRY = '42-planet-ice-cream';
const LEAD = 156;

export function assignHomes(actors, rng) {
  const random = rng || (() => 0.5);
  actors.forEach((actor, pathIndex) => {
    placeActor(actor, pathIndex, actors.length, random);
  });
  separateFood(actors, random);
  assignSuctionOrder(actors);
}

function flightEndDistance(actor) {
  const cruiseZ = 8 - PATH_SPAN;
  const centerZ = cruiseZ - 11;
  const ahead = cruiseZ - actor.home.z;
  const along = clamp01((42 - ahead) / 42);
  const curve = along * along * (3 - 2 * along);
  const bow = Math.sin(along * Math.PI);
  const side = actor.exit || 1;
  const lane = Math.max(2.25, actor.lane || 2.4);
  const entryX = side * (actor.entry.x || 0.5);
  const flightX = entryX + (side * lane - entryX) * curve + bow * side * 0.22;
  const flightY = (actor.entry.y || 0) + ((actor.home.y || 0) - (actor.entry.y || 0)) * curve;
  const flightZ = actor.home.z + along * 1.4;
  return Math.hypot(flightX, flightY, flightZ - centerZ);
}

function assignSuctionOrder(actors) {
  const order = actors.map((actor, index) => ({
    actor,
    index,
    dist: flightEndDistance(actor),
  }));
  order.sort((a, b) => a.dist - b.dist || a.index - b.index);
  const last = Math.max(1, order.length - 1);
  order.forEach((item, rank) => {
    item.actor.delay = (rank / last) * 0.84;
  });
}

function placeActor(actor, pathIndex, count, random) {
  const firstZ = 8 - LEAD;
  const lastZ = 8 - PATH_SPAN - 22;
  const gap = (firstZ - lastZ) / Math.max(1, count - 1);
  const side = pathIndex % 2 === 0 ? -1 : 1;
  const lane = 2.35 + (pathIndex % 4) * 0.32;
  const altitude = ((pathIndex % 5) - 2) * 0.5 + Math.cos(pathIndex * 0.73) * 0.18;
  actor.exit = side;
  actor.lane = lane;
  actor.near = pathIndex % 8 === 0;
  actor.home = {
    x: side * lane,
    y: altitude,
    z: firstZ - pathIndex * gap,
  };
  actor.entry = {
    x: 0.48 + (pathIndex % 5) * 0.14,
    y: altitude * 0.22,
  };
  actor.baseScale = actor.near ? 1.02 : 0.84;
  if (actor.kind === 'card') actor.baseScale = actor.variant === 'code' || actor.variant === 'plate' ? 0.9 : 1.02;
  if (actor.kind === 'word') actor.baseScale = actor.variant === 'float' ? 0.62 : 0.78;
  if (actor.kind === 'form') actor.baseScale = 0.78;
  actor.spin = (random() < 0.5 ? -1 : 1) * (0.04 + random() * 0.05);
  actor.roll = (random() - 0.5) * 0.12;
  actor.swirl = random() * Math.PI * 2;
  actor.turns = (random() < 0.5 ? -1 : 1) * (0.85 + random() * 1.15);
  actor.orbit = 1.4 + random() * 2.2;
  actor.sink = 0.8 + random() * 2.2;
  actor.delay = 0;
}

function separateFood(actors, random) {
  const meat = actors.findIndex((actor) => actor.id === MEAT);
  const dairy = actors.findIndex((actor) => actor.id === DAIRY);
  if (meat < 0 || dairy < 0) return;
  if (Math.abs(meat - dairy) >= 16) return;
  const destination = Math.min(actors.length - 1, Math.max(0, dairy + (dairy > meat ? 18 : -18)));
  if (destination === meat) return;
  const swap = actors[destination];
  actors[destination] = actors[dairy];
  actors[dairy] = swap;
  actors.forEach((actor, pathIndex) => placeActor(actor, pathIndex, actors.length, random));
}

function gentlePull(suction, delay) {
  return smoothstep(clamp01((suction - delay) / 0.16));
}

function suctionPoint(flightX, flightY, flightZ, pull, actor, basis, portrait, viewAspect) {
  const fov = ((portrait ? 40 : 46) * Math.PI) / 360;
  const aspect = Math.max(portrait ? 0.42 : 0.75, viewAspect || 1);
  const ringDepth = portrait ? 9.2 : 11;
  const half = Math.min(Math.tan(fov) * ringDepth * aspect, Math.tan(fov) * ringDepth);
  const relX = flightX - basis.x;
  const relY = flightY - basis.y;
  const relZ = flightZ - basis.z;
  const rightN = relX * basis.rx + relY * basis.ry + relZ * basis.rz;
  const upN = relX * basis.ux + relY * basis.uy + relZ * basis.uz;
  const angle = Math.atan2(upN, rightN || (actor.exit || 1));
  const band = 0.34 + Math.abs(Math.sin((actor.swirl || 0) * 3.1)) * 0.46;
  const tighten = smoothstep(clamp01((pull - 0.2) / 0.8));
  const radius = half * band * (1 - tighten);
  const depth = ringDepth + (1.15 - ringDepth) * tighten;
  const spin = pull * actor.turns * Math.PI * 2.15;
  const swirlX = basis.x + basis.fx * depth + basis.rx * Math.cos(angle + spin) * radius + basis.ux * Math.sin(angle + spin) * radius;
  const swirlY = basis.y + basis.fy * depth + basis.ry * Math.cos(angle + spin) * radius + basis.uy * Math.sin(angle + spin) * radius;
  const swirlZ = basis.z + basis.fz * depth + basis.rz * Math.cos(angle + spin) * radius + basis.uz * Math.sin(angle + spin) * radius;
  const shoulderR = half * 0.86;
  const shoulderD = ringDepth;
  const shoulderX = basis.x + basis.fx * shoulderD + basis.rx * Math.cos(angle) * shoulderR + basis.ux * Math.sin(angle) * shoulderR * 0.62;
  const shoulderY = basis.y + basis.fy * shoulderD + basis.ry * Math.cos(angle) * shoulderR + basis.uy * Math.sin(angle) * shoulderR * 0.62;
  const shoulderZ = basis.z + basis.fz * shoulderD + basis.rz * Math.cos(angle) * shoulderR + basis.uz * Math.sin(angle) * shoulderR * 0.62;
  const join = smoothstep(clamp01(pull / 0.38));
  const stay = (1 - join) * (1 - join);
  const bend = 2 * (1 - join) * join;
  const arrive = join * join;
  return {
    x: stay * flightX + bend * shoulderX + arrive * swirlX,
    y: stay * flightY + bend * shoulderY + arrive * swirlY,
    z: stay * flightZ + bend * shoulderZ + arrive * swirlZ,
  };
}

export function applyObjects(actors, cameraZ, progress, reduced, portrait, viewAspect, basis) {
  const phase = phases(progress);
  const motion = reduced ? 0.28 : 1;
  let prominent = 0;

  actors.forEach((actor) => {
    if (!actor.ready) {
      actor.object.visible = false;
      return;
    }
    const ahead = cameraZ - actor.home.z;
    const along = clamp01((42 - ahead) / 42);
    const curve = along * along * (3 - 2 * along);
    const bow = Math.sin(along * Math.PI);
    const side = actor.exit || 1;
    const lane = Math.max(portrait ? 1.12 : 2.25, (actor.lane || 2.4) * (portrait ? 0.46 : 1));
    const entryX = side * (actor.entry.x || 0.5) * (portrait ? 0.46 : 1);
    const flightX = (entryX + (side * lane - entryX) * curve + bow * side * (portrait ? 0.12 : 0.22)) * motion;
    const flightY = ((actor.entry.y || 0) + (actor.home.y - (actor.entry.y || 0)) * curve) * (portrait ? 0.7 : 1);
    const flightZ = actor.home.z + along * 1.4;
    const minDist = portrait ? 8.6 : 6.6;
    const pull = gentlePull(phase.suction, actor.delay);
    const aimed = basis && pull > 0
      ? suctionPoint(flightX, flightY, flightZ, pull, actor, basis, portrait, viewAspect)
      : null;
    const x = aimed ? aimed.x : flightX;
    const y = aimed ? aimed.y : flightY;
    const z = aimed ? aimed.z : flightZ;
    const flightDistance = cameraZ - flightZ;
    const closeness = clamp01((28 - Math.max(flightDistance, 0)) / 20);
    const approach = 0.12 + closeness * 0.62;
    const unit = actor.kind === 'card' ? 0.95 : actor.kind === 'word' ? 0.36 : 0.82;
    const halfH = Math.tan(((portrait ? 40 : 46) * Math.PI) / 360) * Math.max(flightDistance, minDist);
    const halfW = halfH * Math.max(portrait ? 0.42 : 0.75, viewAspect || 1);
    const angularCap = (halfW * (portrait ? 0.46 : 0.36)) / unit;
    const flightScale = Math.min(portrait ? 1.12 : 1.02, angularCap, actor.baseScale * approach * (portrait ? 1.05 : 1));
    let compensate = 1;
    if (phase.suction > 0 && flightDistance > 1 && basis) {
      const liveDist = basis.z - flightZ;
      compensate = Math.min(1, Math.max(0.12, liveDist / flightDistance));
    }
    const scale = flightScale * compensate * (1 - smoothstep(clamp01(pull / 0.94)));
    const imagesOpen = smoothstep(clamp01((phase.t - 0.1) / 0.04));
    const body = unit * Math.max(scale, flightScale);
    const outside = Math.abs(flightX) > halfW + body * 0.35 || Math.abs(flightY) > halfH + body * 0.45;
    const waiting = ahead > 42;
    const flying = imagesOpen > 0.02 && pull < 0.02 && ahead > -4 && !waiting && !outside;
    const sucking = pull >= 0.02 && pull < 0.992 && phase.white < 0.01;
    const show = (flying && phase.shrink < 0.01 || sucking) && phase.white < 0.01;
    if (!show) {
      if (actor.object.visible) actor.object.visible = false;
      return;
    }
    const aspect = actor.aspect || 1;
    const span = Math.max(scale, 0.001);
    actor.object.position.set(x, y, z);
    actor.object.rotation.set(
      0,
      0,
      actor.roll + Math.sin(progress * Math.PI * 2 + actor.swirl) * actor.spin * motion * (1 - pull) + pull * actor.turns * Math.PI * 2.15
    );
    if (actor.kind === 'form') actor.object.scale.set(span, span, span);
    else actor.object.scale.set(span * aspect, span, 1);
    if (actor.localPose) actor.localPose(progress, pull, motion);
    if (actor.material) actor.material.opacity = flying ? imagesOpen : 1;
    actor.object.visible = true;
    if (flying && flightDistance > 8 && flightDistance < 22) prominent += 1;
  });

  return prominent;
}
