/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0d0e0e',
        surface: '#1b1c1d',
        'surface-light': '#2a2b2c',
        border: '#2a2b2c',
        primary: '#c3ff2d',
        'primary-dark': '#a0cc25', // Darker shade of primary for better contrast
        'text-primary': '#ffffff',
        'text-secondary': '#9ca3af',
        positive: '#00c805',
        negative: '#ff5000',
      },
    },
  },
  plugins: [],
}