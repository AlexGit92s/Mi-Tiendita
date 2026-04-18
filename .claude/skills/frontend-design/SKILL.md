---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality.
license: MIT
---

# Frontend Design Guidelines

## Core Principles
- **NEVER use generic AI-generated aesthetics** — every generation should vary
- Avoid "AI slop" aesthetics: no Inter/Roboto/Arial as defaults, no purple gradients on white backgrounds
- Choose BOLD aesthetic directions: brutalist, art deco, editorial, neo-brutalist, Swiss design, Japanese minimalism
- Design should feel intentional and opinionated

## Typography
- Use distinctive display fonts paired with refined body fonts
- Avoid system fonts for headings — pick characterful typefaces
- Examples: Poppins + Lora, Space Grotesk + Source Sans 3, Playfair Display + IBM Plex Sans
- Use CSS `@import` or self-hosted fonts via `@font-face`
- Establish clear type scale (e.g., 1.25 ratio)

## Color & Visual Identity
- Go beyond blue-gray-white palettes
- Consider warm neutrals, earth tones, monochrome + accent, split-complementary schemes
- Use CSS custom properties for theming
- Support dark mode with thoughtful color inversions (not just `invert()`)

## Motion & Animation
- Use CSS-only animations where possible (no JS animation libraries)
- Staggered reveals for lists and grids
- Scroll-triggered animations with Intersection Observer
- Micro-interactions on buttons, cards, and form elements
- Use `@keyframes` with `animation-fill-mode: both`

## Spatial Composition
- Use unexpected layouts: asymmetry, diagonal flow, overlapping elements
- Break out of the centered-container pattern
- Use CSS Grid for complex layouts, Flexbox for component-level
- Consider magazine-style compositions with pull quotes and accent elements

## Backgrounds & Textures
- Gradient meshes, noise textures, geometric patterns, grain overlays
- SVG patterns via `<pattern>` elements
- CSS `mix-blend-mode` for layered effects
- Subtle animated backgrounds for hero sections

## Components
- Design tokens: define spacing, colors, radii, shadows as CSS variables
- Component variants: primary, secondary, ghost, destructive
- States: default, hover, active, disabled, loading, error
- Responsive: mobile-first with breakpoints at 640px, 768px, 1024px, 1280px

## Accessibility
- Minimum WCAG AA contrast ratios
- Focus indicators on all interactive elements
- Semantic HTML: `<main>`, `<nav>`, `<article>`, `<section>`
- ARIA labels where semantic HTML is insufficient
- Keyboard navigation support

## When to Use
- Creating any new frontend component or page
- Redesigning existing interfaces
- Building design systems or component libraries
- When design direction is needed for a project
