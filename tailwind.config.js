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
        'lamour-bg': '#FAF9F6',
      },
      fontFamily: {
        serif: ['"Noto Serif"', 'serif'],
        sans: ['"Manrope"', 'sans-serif'],
      },
      borderRadius: {
        'lamour': '8px',
      },
      boxShadow: {
        'luxe': '0 40px 60px -10px rgba(26,28,28,0.05)',
      },
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
          "base-100": "#FAF9F6",
          "base-content": "#333333",
        },
      },
    ],
  },
}
