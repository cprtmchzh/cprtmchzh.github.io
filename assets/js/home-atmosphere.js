/* Brief first-visit title screen and decorative-motion visibility state. */
(() => {
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const key = 'portfolio-home-loader-v1';
  let exitTimer;
  let finishTimer;
  const finish = () => {
    if (!root.classList.contains('home-loading')) return;
    clearTimeout(exitTimer);
    clearTimeout(finishTimer);
    root.classList.remove('home-loading');
    document.dispatchEvent(new Event('portfolio:home-ready'));
    // Keep the departing tiles hidden until the overlay has faded away.
    setTimeout(() => root.classList.remove('home-loader-exiting'),220);
  };
  const beginExit = () => {
    if (!root.classList.contains('home-loading')) return;
    root.classList.add('home-loader-exiting');
    finishTimer = setTimeout(finish,480);
  };
  try {
    if (!motion.matches && location.hash !== '#explore' && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key,'seen');
      root.classList.add('home-loading');
      // Never leave the page covered when another asset fails or loads slowly.
      setTimeout(finish,4500);
      // 1.3s hold + 480ms staggered tile exit + 220ms overlay fade = 2s.
      document.addEventListener('DOMContentLoaded',() => {
        if (root.classList.contains('home-loading')) exitTimer = setTimeout(beginExit,1300);
      },{once:true});
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
