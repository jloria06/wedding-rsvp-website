/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        powder: {
          50: '#f5f9fc',
          100: '#eaf2f8',
          200: '#d5e6f1',
          300: '#b7d3e6',
          400: '#8fb8d2',
          500: '#6fa0bf',
          600: '#5885a3',
          700: '#486b84',
          800: '#3f5b6e',
          900: '#384d5d',
        },
        gold: {
          400: '#c5a56a',
          500: '#ad8b50',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Arial', 'sans-serif'],
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
}