/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary, #2563EB)',
          hover: 'var(--color-primary-hover, #1D4ED8)',
          light: 'var(--color-primary-light, #EFF6FF)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary, #1E40AF)',
          hover: 'var(--color-secondary-hover, #1E3A8A)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Ethiopic', 'system-ui', 'sans-serif'],
        ethiopic: ['Noto Sans Ethiopic', 'Nyala', 'Abyssinica SIL', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
