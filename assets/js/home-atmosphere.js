/* Set the entrance flag before first paint; returning home stays immediate. */
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  let seen = false;
  try { seen = sessionStorage.getItem('portfolio-home-intro') === 'seen'; } catch (_) {}
  const finishIntro = () => root.classList.remove('home-intro');
  if (!seen && !reduced.matches && location.hash !== '#explore') {
    root.classList.add('home-intro');
    // Always restore normal rendering, even if initialization is interrupted.
    setTimeout(finishIntro, 1400);
  }
  try { sessionStorage.setItem('portfolio-home-intro', 'seen'); } catch (_) {}
  window.addEventListener('pageshow', event => { if (event.persisted) finishIntro(); });
  document.addEventListener('DOMContentLoaded', () => {
    const sky = document.querySelector('.night-sky');
    let frame = 0, x = 0, y = 0;
    const reset = () => {
      x = y = 0;
      sky?.style.setProperty('--sky-pointer-x', '0px');
      sky?.style.setProperty('--sky-pointer-y', '0px');
    };
    window.addEventListener('pointermove', event => {
      if (!sky || reduced.matches || !pointer.matches || root.dataset.theme !== 'dark') return;
      x = (event.clientX / innerWidth - .5) * 16;
      y = (event.clientY / innerHeight - .5) * 10;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sky.style.setProperty('--sky-pointer-x', `${x.toFixed(1)}px`);
        sky.style.setProperty('--sky-pointer-y', `${y.toFixed(1)}px`);
      });
    }, { passive:true });
    document.documentElement.addEventListener('pointerleave', reset);
    document.addEventListener('visibilitychange', () => {
      root.classList.toggle('home-motion-paused', document.hidden);
      if (document.hidden) reset();
    });
    reduced.addEventListener('change', () => { finishIntro();reset(); });
    pointer.addEventListener('change', reset);
    document.querySelector('[data-theme-toggle]')?.addEventListener('click', finishIntro);
  }, { once:true });
})();
