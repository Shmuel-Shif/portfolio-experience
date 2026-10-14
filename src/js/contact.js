import { bindContactPassage, consumeContactReturn, landOnPortfolio } from './contact-passage.js';

export function mountContact(root) {
  const section = root.querySelector('[data-contact]');
  if (!section) return;
  const year = section.querySelector('[data-contact-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  const cta = section.querySelector('[data-contact-cta]');
  if (cta) bindContactPassage(cta);
  const returning = consumeContactReturn();
  if (returning) landOnPortfolio(root);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
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
    return visibleBottom - visibleTop > 72;
  }

  function sync() {
    if (!inFrame()) return;
    section.dataset.shown = 'true';
    watch.disconnect();
    window.removeEventListener('resize', sync);
  }

  const watch = new MutationObserver(sync);
  watch.observe(root, { attributes: true, attributeFilter: ['data-scroll-offset', 'data-sealed'] });
  window.addEventListener('resize', sync);
  sync();
}
