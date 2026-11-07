document.addEventListener('DOMContentLoaded', () => {
  const buttons = Array.from(document.querySelectorAll('[data-project-filter]'));
  const grid = document.querySelector('.project-grid');
  if (!buttons.length || !grid) return;

  function setFilter(category) {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.projectFilter === category)));
    let visible = 0;
    const cards = Array.from(grid.querySelectorAll('[data-project-category]'));
    cards.forEach(card => {
      card.hidden = category !== 'all' && card.dataset.projectCategory !== category;
      if (!card.hidden) visible += 1;
    });
    const empty = grid.querySelector('#project-empty-state');
    if (empty) empty.hidden = visible !== 0;
    const scrollable = visible >= 6;
    grid.classList.toggle('has-internal-scroll', scrollable);
    grid.scrollTop = 0;
    if (scrollable) {
      grid.tabIndex = 0; // scrollable area is keyboard accessible
      grid.setAttribute('role', 'region');
      grid.setAttribute('aria-label', '프로젝트 목록: 내부 스크롤 가능');
    } else {
      grid.removeAttribute('tabindex');
      grid.removeAttribute('role');
      grid.removeAttribute('aria-label');
    }
  }

  buttons.forEach(button => button.addEventListener('click', () => setFilter(button.dataset.projectFilter)));
  setFilter(buttons.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.projectFilter || 'all');
});
