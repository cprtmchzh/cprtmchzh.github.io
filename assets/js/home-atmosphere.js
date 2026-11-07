/* Brief first-visit title screen and decorative-motion visibility state. */
(() => {
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const key = 'portfolio-home-loader-v1';
  const finish = () => {
    if (!root.classList.contains('home-loading')) return;
    root.classList.remove('home-loading');
    document.dispatchEvent(new Event('portfolio:home-ready'));
  };
  try {
    if (!motion.matches && location.hash !== '#explore' && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key,'seen');
      root.classList.add('home-loading');
      // Never leave the page covered when another asset fails or loads slowly.
      setTimeout(finish,4000);
      // 1.82 seconds on screen plus the 180ms fade makes a two-second intro.
      document.addEventListener('DOMContentLoaded',() => setTimeout(finish,1820),{once:true});
      // Navigation and user input always take precedence over the introduction.
      for (const name of ['pointerdown','keydown','wheel','touchstart','focusin']) {
        document.addEventListener(name,finish,{once:true,passive:true});
      }
      window.addEventListener('pagehide',finish,{once:true});
      document.addEventListener('portfolio:before-home-scroll',finish,{once:true});
      motion.addEventListener('change',finish,{once:true});
    }
  } catch (_) {}
  const sync = () => root.classList.toggle('home-motion-paused',document.hidden);
  document.addEventListener('visibilitychange',sync);
  sync();
})();
