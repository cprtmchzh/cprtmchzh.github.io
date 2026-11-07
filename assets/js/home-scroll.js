/* Home only: reveal a varied content mosaic, snap wheel gestures by section,
   keep normal touch scrolling and support reduced motion. */
(() => {
  function init() {
    const landing = document.querySelector('.home-landing');
    const explore = document.querySelector('.home-explore');
    if (!landing || !explore) return;
    const tiles = [...explore.querySelectorAll('.home-tile')];
    const panels = tiles;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const small = matchMedia('(max-width: 980px)');
    // Panels unfold as one bordered rectangle; no independently animated
    // guide lines or sibling overlay strokes are created.
    if ('IntersectionObserver' in window && !reduced.matches) {
      const directions = ['left','up','right','down'];
      function togglePanel(panel, open) {
        panel.classList.toggle('is-visible', open);
      }
      for (const panel of panels) {
        panel.dataset.foldDir = directions[Math.floor(Math.random() * directions.length)];
        panel.classList.add('fold-panel');
      }
      const tileObserver = new IntersectionObserver(entries => {
        for (const entry of entries) togglePanel(entry.target,entry.isIntersecting);
      },{rootMargin:'0px 0px -2% 0px',threshold:0});
      requestAnimationFrame(() => {
        tiles.forEach(tile => tileObserver.observe(tile));
      });
    }
    // Translate vertical wheel input to horizontal project-card browsing only while
    // more cards remain in that direction. Native touch/trackpad x-scrolling still works.
    const projectRail = explore.querySelector('.home-tile__projects-list');
    if (projectRail) projectRail.addEventListener('wheel', e => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || Math.abs(e.deltaY) < 2) return;
      const remaining = projectRail.scrollWidth - projectRail.clientWidth;
      if (remaining < 3) return;
      const next = Math.max(0, Math.min(remaining, projectRail.scrollLeft + e.deltaY));
      if (Math.abs(next - projectRail.scrollLeft) < 1) return;
      e.preventDefault();
      projectRail.scrollLeft = next;
    }, {passive:false});
    // Navigation from a dashboard article remembers where the user came from.
    explore.querySelectorAll('a[href]').forEach(link => {
      if (!link.closest('.home-tile--archive,.home-tile--feature,.home-tile--projects')) return;
      link.addEventListener('click', () => {
        try {
          const destination = new URL(link.href,location.href);
          if(destination.origin !== location.origin) return;
          sessionStorage.setItem('portfolio-explore-return',JSON.stringify({
            target:destination.pathname,
            home:new URL('#explore',location.href).href
          }));
        } catch (_) {}
      });
    });
    // Clear obsolete return origin after landing back on Home (including BFCache).
    const clearDashboardReturn = () => {
      try { sessionStorage.removeItem('portfolio-explore-return'); } catch (_) {}
    };
    clearDashboardReturn();
    window.addEventListener('pageshow',event => {
      if (event.persisted) clearDashboardReturn();
    });
    if (location.hash === '#explore') {
      const restore = () => explore.scrollIntoView({behavior:'instant',block:'start'});
      requestAnimationFrame(restore);
      window.addEventListener('pageshow',restore,{once:true});
    }
    // RAF-throttled sky parallax, updated only while scrolling in the home page.
    let skyTick = false;
    const moveStars = () => {
      if (skyTick) return;
      skyTick=true;
      requestAnimationFrame(() => {
        skyTick=false;
        if(reduced.matches) return;
        const progress=Math.max(0,Math.min(window.scrollY,explore.offsetTop));
        const sky=document.querySelector('.night-sky');
        if(sky){
          sky.style.setProperty('--sky-scroll-shift',`${Math.round(progress*.14)}px`);
          sky.style.setProperty('--sky-constellation-shift',`${Math.round(progress*.085)}px`);
        }
      });
    };
    window.addEventListener('scroll',moveStars,{passive:true});
    moveStars();
    const updatePosition = () => {
      document.body.classList.toggle('is-exploring',window.scrollY > Math.min(innerHeight * .48,explore.offsetTop - 80));
    };
    window.addEventListener('scroll',updatePosition,{passive:true});
    window.addEventListener('resize',updatePosition,{passive:true});
    updatePosition();

    // One wheel gesture always selects the requested screen, even if a prior
    // scroll or snap left the document at an intermediate offset. Avoid the old
    // half-screen threshold and time lock which sometimes ate the first gesture.
    let snapDestination = null;
    function snapTo(target) {
      const top = target.offsetTop;
      // Track the destination so wheel streams do not restart an in-flight
      // smooth scroll. A reverse gesture always starts the opposite journey.
      if (snapDestination === top && Math.abs(window.scrollY-top)>4) return;
      document.dispatchEvent(new Event('portfolio:before-home-scroll'));
      snapDestination = top;
      window.scrollTo({top,behavior:reduced.matches?'instant':'smooth'});
      updatePosition();
    }
    window.addEventListener('scrollend',()=>{snapDestination=null;},{passive:true});
    window.addEventListener('wheel',e=>{
      if(e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaY)<2 || Math.abs(e.deltaX)>Math.abs(e.deltaY)) return;
      const nested=e.target instanceof Element && e.target.closest('.home-tile__notes,.home-tile__projects-list,.home-tile__tags');
      if(nested){
        // Allow scrolling its contents first, but let a wheel gesture at the
        // boundary escape. Otherwise one-note Archives swallow upward scroll
        // gestures forever and the user cannot return to the landing.
        if(nested.matches('.home-tile__projects-list')){
          const max=nested.scrollWidth-nested.clientWidth;
          if(e.deltaY>0 && nested.scrollLeft<max-2) return;
          if(e.deltaY<0 && nested.scrollLeft>2) return;
        }else{
          const max=nested.scrollHeight-nested.clientHeight;
          if(e.deltaY>0 && nested.scrollTop<max-2) return;
          if(e.deltaY<0 && nested.scrollTop>2) return;
        }
      }
      const y=window.scrollY,at=explore.offsetTop;
      // On narrow screens the Explore section is taller than one viewport:
      // keep native scrolling inside its content, snap only at its entrance.
      const withinExploreTop=Math.abs(y-at)<36;
      if(e.deltaY>0 && y<at-3){ e.preventDefault();snapTo(explore); }
      else if(e.deltaY<0 && y>3 && (!small.matches || withinExploreTop || y<at)){
        e.preventDefault();snapTo(landing);
      }
    },{passive:false});

    document.querySelectorAll('.home-scroll-cue').forEach(link => {
      link.addEventListener('click',e => {
        e.preventDefault();
        snapTo(explore);
      });
    });
    reduced.addEventListener?.('change', () => {
      if (!reduced.matches) return;
      panels.forEach(panel => panel.classList.add('is-visible'));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
