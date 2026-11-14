/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          900: '#0f172a',
          950: '#020617',
        },
        accent: {
          cyan: '#22d3ee',
          magenta: '#f472b6',
          lime: '#a3e635',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
