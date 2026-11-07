/* Pause decorative motion while the page is hidden. No pointer/scroll tracking. */
(() => {
  // Only the first home visit in this tab receives the outline prelude.
  try {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && location.hash !== '#explore' && !sessionStorage.getItem('portfolio-home-outline-v2')) {
      document.documentElement.classList.add('home-intro-pending');
      setTimeout(() => document.documentElement.classList.remove('home-intro-pending'), 2400);
    }
  } catch (_) {}
  const sync = () => document.documentElement.classList.toggle('home-motion-paused', document.hidden);
  document.addEventListener('visibilitychange', sync);
  sync();
})();
