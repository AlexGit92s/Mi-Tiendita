---
name: tailwindcss-development
description: Styles applications using Tailwind CSS utilities with design tokens and responsive patterns.
license: MIT
---

# Tailwind CSS latest Development Guidelines

## Project Context
- **Styling**: Tailwind CSS latest
- **Build Tool**: Vite
- **Project Path**: C:\laragon\www\Mi-Tiendita

## Core Principles
- Use Tailwind utility classes exclusively — avoid custom CSS
- Extract components only when patterns repeat 3+ times
- Mobile-first responsive design
- Support dark mode on all new pages if existing pages do

## Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './resources/**/*.blade.php',
    './resources/**/*.js',
    './resources/**/*.vue',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom colors if needed
      },
    },
  },
}
```

## Layout Patterns
```html
<!-- Flexbox layout -->
<div class="flex items-center justify-between gap-4">
  <h1>Title</h1>
  <button>Action</button>
</div>

<!-- Grid layout -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Cards -->
</div>
```

## Spacing
- Use `gap` utilities for spacing between siblings, NOT margins
- Consistent spacing scale: `gap-2` (8px), `gap-4` (16px), `gap-6` (24px)
- Use padding for internal spacing, gap for external

## Dark Mode
- Use `dark:` variant: `dark:bg-gray-800 dark:text-white`
- Check existing page conventions — match them
- New pages MUST support dark mode if the app has it

## Common Patterns
```html
<!-- Card -->
<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
  <h2 class="text-lg font-semibold mb-4">Title</h2>
  <p class="text-gray-600 dark:text-gray-300">Content</p>
</div>

<!-- Button -->
<button class="btn btn-primary">Primary</button>

<!-- Badge -->
<span class="badge badge-success">Active</span>
```

## Common Pitfalls
- ❌ Don't use margins for sibling spacing — use gap
- ❌ Don't forget dark mode variants on new pages
- ❌ Don't add custom CSS when Tailwind utilities work
- ✅ Check existing conventions before adding new patterns
- ✅ Use CSS variables in variables.css for custom values

## When to Use
- Adding or modifying any styles
- Creating new components or pages
- Responsive design work
- Dark mode implementation
