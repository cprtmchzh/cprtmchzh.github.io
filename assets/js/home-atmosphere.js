/* Pause decorative motion while the page is hidden. No pointer/scroll tracking. */
(() => {
  const sync = () => document.documentElement.classList.toggle('home-motion-paused', document.hidden);
  document.addEventListener('visibilitychange', sync);
  sync();
})();
