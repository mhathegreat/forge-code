/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0a0b',
          900: '#0f0f11',
          850: '#141417',
          800: '#1a1a1f',
          750: '#202027',
          700: '#2a2a33',
          600: '#3a3a45',
        },
        accent: {
          DEFAULT: '#7c5cff',
          hover: '#8d70ff',
          dim: '#5b43c4',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
