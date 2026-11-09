document.addEventListener('DOMContentLoaded', () => {
  const buttons = Array.from(document.querySelectorAll('[data-project-filter]'));
  const grid = document.querySelector('.project-grid');
  if (!buttons.length || !grid) return;
  const cards = Array.from(grid.querySelectorAll('[data-project-category]'));
  const empty = grid.querySelector('#project-empty-state');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = buttons.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.projectFilter || 'all';
  let generation = 0;
  let animation = null;

  function applyFilter(category) {
    let visible = 0;
    cards.forEach(card => {
      card.hidden = category !== 'all' && card.dataset.projectCategory !== category;
      if (!card.hidden) visible += 1;
    });
    if (empty) empty.hidden = visible !== 0;
    const scrollable = visible >= 6;
    grid.classList.toggle('has-internal-scroll', scrollable);
    grid.scrollTop = 0;
    if (scrollable) {
      grid.tabIndex = 0;
      grid.setAttribute('role', 'region');
      grid.setAttribute('aria-label', '프로젝트 목록: 내부 스크롤 가능');
    } else {
      grid.removeAttribute('tabindex');
      grid.removeAttribute('role');
      grid.removeAttribute('aria-label');
    }
  }

  async function setFilter(category) {
    if (category === selected) return;
    selected = category;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.projectFilter === category)));
    const unchanged = cards.every(card => card.hidden === (category !== 'all' && card.dataset.projectCategory !== category));
    if (unchanged && !animation) return;

    const run = ++generation;
    const style = getComputedStyle(grid);
    const from = {opacity: style.opacity, transform: style.transform};
    if (animation) animation.cancel();
    animation = null;
    // First-load card delays must not replay during interactive filtering.
    grid.classList.add('has-filtered');
    if (reduced.matches || !grid.animate) {
      applyFilter(category);
      grid.removeAttribute('aria-busy');
      return;
    }
    grid.setAttribute('aria-busy', 'true');
    if (!unchanged) {
      const exit = grid.animate([from, {opacity: 0, transform: 'translateY(5px)'}], {
        duration: 120, easing: 'ease-in', fill: 'both'
      });
      animation = exit;
      await exit.finished.catch(() => {});
      if (run !== generation) return;
      applyFilter(category);
      exit.cancel();
    }
    const entry = grid.animate([
      unchanged ? from : {opacity: 0, transform: 'translateY(8px)'},
      {opacity: 1, transform: 'translateY(0)'}
    ], {duration: 240, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'both'});
    animation = entry;
    await entry.finished.catch(() => {});
    if (run !== generation) return;
    entry.cancel();
    animation = null;
    grid.removeAttribute('aria-busy');
  }

  buttons.forEach(button => button.addEventListener('click', () => setFilter(button.dataset.projectFilter)));
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    generation += 1;
    if (animation) animation.cancel();
    animation = null;
    applyFilter(selected);
    grid.removeAttribute('aria-busy');
  });
  applyFilter(selected);
});
