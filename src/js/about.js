export function mountAbout(root) {
  const section = root.querySelector('[data-about]');
  if (!section) return;
  const bars = section.querySelector('.about__principles');
  const content = root.querySelector('[data-content]');
  if (!bars || !content) {
    section.dataset.shown = 'true';
    section.dataset.complete = 'true';
    return;
  }

  const textObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    section.dataset.shown = 'true';
    textObserver.disconnect();
  }, { root, threshold: 0.2 });
  textObserver.observe(section);

  let started = false;

  function barsInView() {
    if (root.dataset.sealed !== 'true' || content.hidden) return false;
    const rect = bars.getBoundingClientRect();
    const frame = root.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return false;
    const visibleTop = Math.max(rect.top, frame.top);
    const visibleBottom = Math.min(rect.bottom, frame.bottom);
    const visible = visibleBottom - visibleTop;
    return rect.top < frame.bottom - 12 && visible >= Math.min(rect.height, frame.height * 0.35) * 0.65;
  }

  function revealChecks() {
    if (section.dataset.complete === 'true') return;
    section.dataset.complete = 'true';
  }

  function startFill() {
    if (started || !barsInView()) return;
    started = true;
    window.removeEventListener('resize', startFill);
    watch.disconnect();
    barObserver.disconnect();
    const fills = [...bars.querySelectorAll('.about__fill')];
    if (!fills.length || typeof fills[0].animate !== 'function') {
      fills.forEach((fill) => {
        fill.style.width = '100%';
      });
      revealChecks();
      return;
    }
    let pending = fills.length;
    fills.forEach((fill) => {
      fill.getAnimations().forEach((anim) => anim.cancel());
      fill.style.animation = 'none';
      fill.style.width = '0%';
    });
    window.requestAnimationFrame(() => {
      fills.forEach((fill) => {
        const anim = fill.animate(
          [{ width: '0%' }, { width: '100%' }],
          { duration: 5000, easing: 'linear', fill: 'forwards' }
        );
        anim.addEventListener('finish', () => {
          pending -= 1;
          if (pending <= 0) revealChecks();
        });
      });
    });
  }

  const watch = new MutationObserver(startFill);
  watch.observe(root, { attributes: true, attributeFilter: ['data-scroll-offset', 'data-sealed'] });
  window.addEventListener('resize', startFill);
  const barObserver = new IntersectionObserver(() => {
    startFill();
  }, { root, threshold: [0.35, 0.6] });
  barObserver.observe(bars);
}
