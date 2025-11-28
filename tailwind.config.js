/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      screens: {
        // Mobile: 360px - 767px (base styles apply)
        'xs': '360px',      // Small mobile (360px+)
        'sm': '480px',      // Large mobile (480px+)
        // Tablet: 768px - 1080px
        'md': '768px',      // Tablet start (768px+)
        'lg': '1024px',     // Tablet end / Laptop start (1024px+)
        // Desktop and larger
        'xl': '1280px',     // Desktop (1280px+)
        '2xl': '1536px',    // Large HD (1536px+)
        '3xl': '1920px',    // Extra large HD (1920px+)
      },
    },
  },
  plugins: [],
};
