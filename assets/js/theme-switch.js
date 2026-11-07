/* Session-wide theme state. Home adds a live opposite-theme bulb preview. */
(function () {
  'use strict';
  const key = 'cprtmchzh-color-mode';
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let theme = 'light';
  try { theme = sessionStorage.getItem(key) === 'dark' ? 'dark' : 'light'; } catch (_) {}
  root.dataset.theme = theme;
  const opposite = value => value === 'dark' ? 'light' : 'dark';
  const save = value => { try { sessionStorage.setItem(key,value); } catch (_) {} };
  function setTheme(value) {
    theme = value;
    root.dataset.theme = theme;
    save(theme);
    const button = document.querySelector('[data-theme-toggle]');
    if (button) {
      button.setAttribute('aria-pressed',String(theme === 'dark'));
      button.setAttribute('aria-label',theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
      button.title = theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환';
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0b0e17' : '#f8f6ef';
  }
  let commitSequence=0;
  function commitTheme(value){
    const seq=++commitSequence;
    root.classList.add('theme-committing');
    setTheme(value);
    // Two painted frames guarantee the final theme colors settle before
    // the normal hover transitions become available again.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (seq === commitSequence) root.classList.remove('theme-committing');
    }));
  }
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('[data-theme-toggle]');
    setTheme(theme);
    if (!button) return;

    const frame = document.createElement('iframe');
    frame.className = 'theme-reveal-frame';
    frame.title = '';
    frame.setAttribute('aria-hidden','true');
    frame.setAttribute('tabindex','-1');
    frame.setAttribute('inert','');
    frame.style.clipPath = 'circle(0px at 50% 50%)';
    const ring = document.createElement('div');
    ring.className = 'theme-preview-ring';
    ring.setAttribute('aria-hidden','true');
    document.body.append(frame,ring);

    let frameReady = false;
    let hovering = false;
    let switching = false;
    let pendingTheme = null;
    let generation = 0;
    let clipAnimation = null;
    let radius = 0;
    let cx = 0, cy = 0;
    let lastPointer = null;
    const circle = r => `circle(${r}px at ${cx}px ${cy}px)`;
    function locate() {
      const r = button.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      ring.style.left = cx+'px';
      ring.style.top = cy+'px';
    }
    function insideBulb() {
      if (button.matches(':hover')) return true;
      if (!lastPointer || lastPointer.type === 'touch') return false;
      const r=button.getBoundingClientRect();
      return lastPointer.x >= r.left && lastPointer.x <= r.right &&
        lastPointer.y >= r.top && lastPointer.y <= r.bottom;
    }
    function frameTheme() {
      try { frame.contentDocument?.documentElement.setAttribute('data-theme', opposite(theme)); } catch (_) {}
    }
    function animateClip(to,ms=150) {
      if (clipAnimation) {
        const current = getComputedStyle(frame).clipPath;
        clipAnimation.cancel();
        clipAnimation = null;
        frame.style.clipPath = current;
      }
      const from = getComputedStyle(frame).clipPath;
      radius = to;
      if (!frameReady) return Promise.resolve();
      const end = circle(to);
      if (motion.matches || ms === 0 || from === end) {
        frame.style.clipPath = end;
        return Promise.resolve();
      }
      const anim = frame.animate([{clipPath:from},{clipPath:end}],{
        duration:ms,easing:'cubic-bezier(.18,.7,.25,1)',fill:'forwards'
      });
      clipAnimation = anim;
      return anim.finished.then(() => {
        if (clipAnimation !== anim) return;
        frame.style.clipPath = end;
        clipAnimation = null;
        anim.cancel();
      }).catch(() => {});
    }
    function syncHover() {
      if (switching) return;
      const show = frameReady && insideBulb();
      if (show === hovering) return;
      hovering = show;
      locate();
      if (show) {
        frameTheme();
        ring.classList.add('is-visible');
        animateClip(208,155);
      } else {
        ring.classList.remove('is-visible');
        animateClip(0,130);
      }
    }
    function closePreview() {
      hovering = false;
      ring.classList.remove('is-visible');
      if (clipAnimation) { clipAnimation.cancel(); clipAnimation=null; }
      locate();
      frame.style.clipPath = circle(0);
      radius = 0;
    }
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"],style[data-home-preview-style]'))
      .map(node => node.tagName === 'STYLE' ? node.outerHTML :
        '<link rel="stylesheet" href="'+node.href.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">').join('');
    const home = document.querySelector('main').outerHTML;
    const src = '<!doctype html><html lang="ko" data-preview-copy="true" data-theme="'+opposite(theme)+'">' +
      '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<base href="'+document.baseURI.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+styles+
      '</head><body>'+home+'</body></html>';
    frame.addEventListener('load', () => {
      frameReady = !!frame.contentDocument;
      frameTheme();
      // The pointer may have entered before CSS and the iframe finished loading.
      syncHover();
    });
    frame.srcdoc = src;

    function recordPointer(event) {
      lastPointer = {x:event.clientX,y:event.clientY,type:event.pointerType};
    }
    button.addEventListener('pointerenter',e => { recordPointer(e); syncHover(); });
    button.addEventListener('pointermove',e => { recordPointer(e); syncHover(); });
    button.addEventListener('pointerleave',e => {
      recordPointer(e);
      // During transitions, record the exit so nothing stale reopens.
      if (!switching) syncHover();
    });
    // A view transition can consume a synthetic enter/leave pair. Tracking real
    // pointer movement restores the preview without forcing a leave/re-enter.
    window.addEventListener('pointermove',e => {
      recordPointer(e);
      if (!switching && (hovering || insideBulb())) syncHover();
    },{passive:true});
    button.addEventListener('focus',syncHover);
    button.addEventListener('blur',syncHover);

    function finishTransition(reopen=true) {
      if (!switching) return;
      generation++;
      commitTheme(pendingTheme || theme);
      pendingTheme=null;
      switching=false;
      closePreview();
      frameTheme();
      if (reopen) syncHover();
    }
    // On navigation/scroll, finish the transition before the viewport moves.
    window.addEventListener('wheel',() => finishTransition(false),{capture:true,passive:true});
    window.addEventListener('touchstart',() => finishTransition(false),{capture:true,passive:true});
    window.addEventListener('scroll',() => finishTransition(false),{passive:true});
    document.addEventListener('portfolio:before-home-scroll',() => finishTransition(false));

    button.addEventListener('click',async () => {
      // Render the opposite theme through the non-interactive iframe. Unlike a
      // top-layer view transition, this never swallows rapid real mouse clicks.
      if (switching) finishTransition(false);
      switching = true;
      const run = ++generation;
      // Continue the already visible bulb preview into the full-page reveal.
      // Resetting it to radius=0 here caused a tiny circle to flash on click.
      locate();
      ring.classList.remove('is-visible');
      if (clipAnimation) {
        const current = getComputedStyle(frame).clipPath;
        clipAnimation.cancel();
        clipAnimation = null;
        frame.style.clipPath = current;
      }
      // The click originates inside the bulb: when the preview has not painted
      // yet (fast re-click), begin at the normal hover-circle size, not at 0px.
      if (frameReady && insideBulb() && radius < 208) {
        frame.style.clipPath = circle(208);
        radius = 208;
      }
      hovering = false;
      const next = opposite(theme);
      pendingTheme = next;
      save(next);
      if (motion.matches || !frameReady) {
        commitTheme(next);
        pendingTheme = null;
        switching = false;
        frameTheme();
        syncHover();
        return;
      }
      frameTheme();
      const max = Math.ceil(Math.max(
        Math.hypot(cx,cy),Math.hypot(innerWidth-cx,cy),
        Math.hypot(cx,innerHeight-cy),Math.hypot(innerWidth-cx,innerHeight-cy)
      )) + 12;
      try {
        await animateClip(max,510);
      } finally {
        if (run === generation) {
          commitTheme(next);
          pendingTheme = null;
          switching = false;
          closePreview();
          frameTheme();
          syncHover();
        }
      }
    });
    window.addEventListener('pagehide',() => {
      if (pendingTheme) commitTheme(pendingTheme);
      pendingTheme=null;
    });
    window.addEventListener('pageshow',event => {
      if (!event.persisted) return;
      let stored=theme;
      try { stored=sessionStorage.getItem(key)==='dark'?'dark':'light'; } catch (_) {}
      finishTransition(false);
      commitTheme(stored);
      frameTheme();
      closePreview();
      syncHover();
    });
    window.addEventListener('resize',() => {
      locate();
      if (!switching && frameReady) frame.style.clipPath=circle(radius);
    },{passive:true});
    locate();
  });
})();
