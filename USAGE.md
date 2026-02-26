# NoviceHall Usage

## Overview
This version focuses on a smoother and more welcoming home page for a nonprofit, open-source trade platform.

## What changed
- Refined layout for the home page mission: train newcomers, support hiring, and guide trade-school decisions.
- Added smoother, GPU-friendly motion (`transform` + `opacity`) and reduced janky scroll logic.
- Implemented a premium multi-layer gradient background with subtle pointer-reactive depth.
- Added both light and dark premium themes.
- Default theme now follows the browser color scheme automatically.
- Added a compact top-right sun/moon toggle for manual theme switching.
- Enforced anti-aliased text rendering site-wide.
- Highlighted community contribution pathways for mentors, employers, and developers.
- Tuned hover interactions for faster response and added subtle accent color glows.
- Added staggered scroll-reveal animations on cards/panels for a more alive experience.
- Added micro-interactions: shimmer on CTA hover, animated nav underline accents, tactile press states, scroll progress line, and pointer-tilt depth on cards/highlights.

## Files
- `Untitled-1.html`: Home page structure and content.
- `framework.css`: Visual system, responsive layout, animation styles, and accessibility-focused motion settings.
- `script.js`: Lightweight interactivity (sticky header state, mobile nav, reveal effects, background drift).

## Accessibility and performance notes
- Respects `prefers-reduced-motion`.
- Keeps transitions on performant properties to avoid jitter.
- Uses semantic sections and accessible nav toggle attributes.
