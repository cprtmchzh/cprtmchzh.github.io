# Homepage grid and interaction refinements

This ZIP is based on `portfolio-asymmetric-github-pages(3).zip`.

- Removed the Home page's visible name and tagline in `_layouts/home.html`.
- Kept the original asymmetric tile composition in `index.html`.
- Grid lines now share the exact CSS square-cell origins with Home tiles.
- Eliminated main-card hover lift and shadows, including dark-mode glow.
- Added `assets/illustrations/home-hover-curves.svg` for black hover/focus curves.
- Dark mode hides construction lines; hovering the bulb reveals the light-mode lines through the circular opposite-theme preview.

Chromium preview checks were performed on the shared Home assets and interactions. Jekyll build execution is NOT included (Jekyll isn't installed in the test runtime).
