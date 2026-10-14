export function mountServices(root) {
  const section = root.querySelector('[data-services]');
  if (!section) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || typeof IntersectionObserver !== 'function') {
    section.dataset.shown = 'true';
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      section.dataset.shown = 'true';
      observer.disconnect();
    });
  }, { threshold: 0.18 });
  observer.observe(section);
}
