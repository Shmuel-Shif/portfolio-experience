export function mountWorksRail(rail) {
  if (!rail) return;
  const viewport = rail.querySelector('[data-works-viewport]');
  const cards = Array.from(rail.querySelectorAll('[data-work]'));
  const status = rail.querySelector('[data-works-status]');
  if (!viewport || cards.length === 0) return;

  let focus = 0;
  let touch = null;
  let settleTimer = 0;

  function wrapIndex(value) {
    const count = cards.length;
    return ((value % count) + count) % count;
  }

  function deltaFor(itemIndex, shown) {
    let delta = itemIndex - shown;
    const count = cards.length;
    delta = ((delta % count) + count) % count;
    if (delta > count / 2) delta -= count;
    return delta;
  }

  function gap() {
    const width = viewport.clientWidth || 1;
    return Math.min(260, Math.max(130, width * 0.3));
  }

  function paint() {
    const shown = wrapIndex(focus);
    cards.forEach((card, itemIndex) => {
      const delta = deltaFor(itemIndex, shown);
      const distance = Math.abs(delta);
      const depth = -Math.min(distance, 2) * 150;
      const turn = Math.max(-1.15, Math.min(1.15, delta)) * 34;
      const shift = -delta * gap();
      const active = distance < 0.5;
      card.dataset.active = active ? 'true' : 'false';
      card.style.opacity = String(Math.max(0.28, 1 - distance * 0.28));
      card.style.zIndex = String(20 - Math.round(distance * 8));
      card.style.transform = `translate(-50%, -50%) translateX(${shift.toFixed(1)}px) translateZ(${depth.toFixed(1)}px) rotateY(${turn.toFixed(2)}deg)`;
      card.setAttribute('aria-current', active ? 'true' : 'false');
    });
    const nearest = wrapIndex(Math.round(focus));
    const title = cards[nearest] ? cards[nearest].querySelector('.work-card__title') : null;
    if (status && title) status.textContent = title.textContent;
  }

  function move(amount) {
    focus += amount;
    rail.dataset.dragging = 'true';
    paint();
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      focus = Math.round(focus);
      rail.dataset.dragging = 'false';
      paint();
    }, 160);
  }

  viewport.addEventListener('wheel', (event) => {
    const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const amount = sideways ? event.deltaX : (event.shiftKey ? event.deltaY : 0);
    if (!amount) return;
    event.preventDefault();
    event.stopPropagation();
    move(amount / gap());
  }, { passive: false });

  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || event.button !== 0) return;
    touch = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: '' };
    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    if (!touch || touch.id !== event.pointerId) return;
    const deltaX = touch.x - event.clientX;
    const deltaY = touch.y - event.clientY;
    if (!touch.axis) {
      if (Math.hypot(deltaX, deltaY) < 8) return;
      touch.axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }
    if (touch.axis === 'y') return;
    event.preventDefault();
    touch.x = event.clientX;
    touch.y = event.clientY;
    move(deltaX / gap());
  });

  function endPointer(event) {
    if (!event || event.pointerType === 'touch') return;
    touch = null;
  }

  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  viewport.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) return;
    const point = event.touches[0];
    touch = { id: point.identifier, x: point.clientX, y: point.clientY, axis: '' };
  }, { passive: true });

  viewport.addEventListener('touchmove', (event) => {
    if (!touch || event.touches.length !== 1) return;
    const point = event.touches[0];
    if (point.identifier !== touch.id) return;
    const deltaX = touch.x - point.clientX;
    const deltaY = touch.y - point.clientY;
    if (!touch.axis) {
      if (Math.hypot(deltaX, deltaY) < 12) return;
      touch.axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }
    if (touch.axis === 'y') return;
    event.preventDefault();
    event.stopPropagation();
    touch.x = point.clientX;
    touch.y = point.clientY;
    move(deltaX / gap());
  }, { passive: false });

  viewport.addEventListener('touchend', () => {
    touch = null;
  });
  viewport.addEventListener('touchcancel', () => {
    touch = null;
  });

  paint();
}
