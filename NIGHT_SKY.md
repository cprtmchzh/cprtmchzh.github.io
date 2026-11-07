# Dark homepage: quieter night and constellations

- Dark mode background: `#0b0e17` (slightly deeper than `#0e111c` on all pages). Neon card colors and light mode are unchanged.
- Home dark mode: **167 static stars, 20 softly twinkling stars** (down from 264 + 36), two faint connected constellations (**Cassiopeia**, **Big Dipper**), a gentle haze and the existing occasional shooting star.
- Constellations adjust positions on narrow screens to remain visible above/below the Home cards. All night sky elements remain behind content, `aria-hidden` and `pointer-events:none`.
- The lightbulb inverse-theme reveal includes the constellations automatically because it clones the full Home main and CSS.
- `prefers-reduced-motion: reduce` keeps stars static and disables the shooting star.
- Files: `assets/css/night-sky.css`, `assets/css/theme-switch.css`, `assets/js/theme-switch.js`, `assets/illustrations/{night-stars,night-twinkle,cassiopeia,big-dipper}.svg`, `_layouts/home.html`.
