NoviceHall - tiny utility-first framework (usage)

Files:
- `framework.css`  — core utilities (spacing, colors, buttons, forms, responsive helpers)
- `script.js`     — optional small helpers: dark-mode toggle, mobile nav toggle, and helper API

How to include in your HTML (keep your HTML unchanged):

1. Include the stylesheet in <head>:

   <link rel="stylesheet" href="framework.css">

2. Include the script (prefer `defer` so it runs after DOM parsing):

   <script src="script.js" defer></script>

What `script.js` does:
- Injects a small **dark-mode toggle** button (top-right). It toggles `data-theme="dark"` on `<html>` and stores the preference in `localStorage`.
- Injects a **mobile nav toggle** button (top-left) that toggles `data-open` on the first `nav[aria-label="Primary navigation"]` found.
- Adds `NH` helpers to `window.NoviceHall` (helpers: `toggleClass`, `setTheme`, `initTheme`, and `toggleNav`).

Notes:
- The script is intentionally non-invasive and **does not** require editing your HTML.
- If you prefer not to have injected buttons, include the script but hide them via CSS, or call the helpers from your own buttons.

Accessibility / Advice:
- Toggle buttons use accessible attributes (`aria-label`, `aria-expanded`) and keyboard handling (Esc to close nav).
- Add `aria-controls` and additional labels to your markup if you later add custom toggles.
