(() => {
  'use strict';
  const search = document.querySelector('#archive-search');
  const items = Array.from(document.querySelectorAll('.entry'));
  const buttons = Array.from(document.querySelectorAll('[data-archive-filter]'));
  const rows = Array.from(document.querySelectorAll('.category-line'));
  const count = document.querySelector('#result-count');
  const empty = document.querySelector('#empty-state');
  const list = document.querySelector('#posts-list');
  if (!search || !buttons.length || !count || !list) return;

  const valid = new Set(buttons.map(button => button.dataset.archiveFilter));
  const fromURL = new URLSearchParams(location.search).get('category');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = valid.has(fromURL) ? fromURL : 'all';
  let animation = null;
  let transitionId = 0;

  function updateCategoryControls() {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.archiveFilter === current)));
    rows.forEach(row => row.classList.toggle('is-active', row.querySelector('button')?.dataset.archiveFilter === current));
  }

  function draw() {
    const query = search.value.trim().toLocaleLowerCase('ko-KR');
    let total = 0;
    items.forEach(item => {
      const byCategory = current === 'all' || item.dataset.category === current;
      const byText = !query || (item.dataset.search || item.textContent).toLocaleLowerCase('ko-KR').includes(query);
      item.hidden = !(byCategory && byText);
      if (!item.hidden) total += 1;
    });
    updateCategoryControls();
    count.textContent = `${total} / ${items.length} ${items.length === 1 ? 'note' : 'notes'}`;
    if (empty) empty.hidden = total !== 0;
    list.classList.toggle('is-empty', total === 0);
    const scrollable = total >= 6;
    list.classList.toggle('has-internal-scroll', scrollable);
    list.scrollTop = 0;
    if (scrollable) {
      list.tabIndex = 0;
      list.setAttribute('role', 'region');
      list.setAttribute('aria-label', '게시글 목록: 내부 스크롤 가능');
    } else {
      list.removeAttribute('tabindex');
      list.removeAttribute('role');
      list.removeAttribute('aria-label');
    }
  }

  function cancelTransition() {
    transitionId += 1;
    if (animation) {
      animation.cancel();
      animation = null;
    }
    list.removeAttribute('aria-busy');
  }

  // Fade the old result set out, switch its visibility, and gently raise the
  // new result set. Animate the list as a unit so empty states also transition.
  function animateResultsChange() {
    // Preserve the visible opacity when a user clicks a second category
    // halfway through a transition, avoiding a flash back to fully visible.
    const previousOpacity = Number.parseFloat(getComputedStyle(list).opacity);
    cancelTransition();
    if (reducedMotion.matches || typeof list.animate !== 'function') {
      draw();
      return;
    }

    const id = transitionId;
    const currentOpacity = Number.isFinite(previousOpacity) ? previousOpacity : 1;
    list.setAttribute('aria-busy', 'true');
    animation = list.animate([
      {opacity: currentOpacity, transform: 'translateY(0px)'},
      {opacity: 0, transform: 'translateY(-5px)'}
    ], {duration: 135, easing: 'ease-in', fill: 'forwards'});

    animation.finished.then(() => {
      if (id !== transitionId) return;
      animation.cancel();
      animation = null;
      draw();
      animation = list.animate([
        {opacity: 0, transform: 'translateY(8px)'},
        {opacity: 1, transform: 'translateY(0px)'}
      ], {duration: 245, easing: 'cubic-bezier(.18,.75,.25,1)', fill: 'both'});
      return animation.finished.then(() => {
        if (id !== transitionId) return;
        animation.cancel();
        animation = null;
        list.removeAttribute('aria-busy');
      });
    }).catch(() => {
      // Superseded by another category selection or by an immediate search.
    });
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    const next = button.dataset.archiveFilter;
    if (next === current) return;
    current = next;
    const url = new URL(location.href);
    if (current === 'all') url.searchParams.delete('category');
    else url.searchParams.set('category', current);
    history.replaceState({}, '', url);
    updateCategoryControls();
    animateResultsChange();
  }));

  // Search stays immediate so typing never waits for a category animation.
  search.addEventListener('input', () => {
    cancelTransition();
    draw();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    event.preventDefault(); search.focus();
  });
  window.addEventListener('popstate', () => {
    const cat = new URLSearchParams(location.search).get('category');
    const next = valid.has(cat) ? cat : 'all';
    if (next === current) return;
    current = next;
    updateCategoryControls();
    animateResultsChange();
  });
  reducedMotion.addEventListener?.('change', () => {
    if (!reducedMotion.matches) return;
    cancelTransition();
    draw();
  });
  draw();
})();
