export function mountToolkit(root) {
  const section = root.querySelector('[data-toolkit]');
  if (!section) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || typeof IntersectionObserver !== 'function') {
    section.dataset.shown = 'true';
    return;
  }
  const content = root.querySelector('[data-content]');

  function inFrame() {
    if (content && content.hidden) return false;
    const rect = section.getBoundingClientRect();
    const frame = root.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return false;
    const visibleTop = Math.max(rect.top, frame.top);
    const visibleBottom = Math.min(rect.bottom, frame.bottom);
    return visibleBottom - visibleTop > 48;
  }

  function sync() {
    if (!inFrame()) {
      if (section.dataset.shown === 'true') section.dataset.float = 'false';
      return;
    }
    section.dataset.shown = 'true';
    section.dataset.float = 'true';
  }

  const watch = new MutationObserver(sync);
  watch.observe(root, { attributes: true, attributeFilter: ['data-scroll-offset', 'data-sealed'] });
  window.addEventListener('resize', sync);
  sync();
}
