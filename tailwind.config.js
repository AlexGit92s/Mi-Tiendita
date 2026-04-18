/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'lamour-blush': '#F5D1D1',
        'lamour-stone': '#735858',
        'lamour-gold': '#775a19',
      },
      fontFamily: {
        serif: ['"Noto Serif"', 'serif'],
        sans: ['"Manrope"', 'sans-serif'],
      }
    }
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        lamour: {
          "primary": "#F5D1D1", /* Blush */
          "secondary": "#735858", /* Stone */
          "accent": "#775a19", /* Gold */
          "neutral": "#ffffff",
          "base-100": "#fcfcfc",
          "base-content": "#333333",
        },
      },
    ],
  },
}
