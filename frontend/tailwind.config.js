/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      colors: {
        bg:      { DEFAULT: '#0d0d0f', 2: '#141417', 3: '#1c1c21', 4: '#242429' },
        border:  { DEFAULT: '#2a2a32', 2: '#3a3a45' },
        text:    { DEFAULT: '#e8e6f0', 2: '#9896a8', 3: '#5a5868' },
        accent:  { DEFAULT: '#c084fc', 2: '#a855f7', 3: '#7c3aed' },
      },
      borderRadius: { xl: '14px', '2xl': '20px' },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        shimmer: 'shimmer 1.5s infinite',
        slideIn: 'slideIn 0.2s ease',
        fadeIn:  'fadeIn 0.3s ease',
        newPost: 'newPost 2s ease forwards',
      },
      keyframes: {
        shimmer:  { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        slideIn:  { from: { transform: 'translateX(100%)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        fadeIn:   { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        newPost:  { '0%': { borderColor: '#c084fc', boxShadow: '0 0 20px rgba(192,132,252,.3)' }, '100%': { borderColor: '#2a2a32', boxShadow: 'none' } },
      },
    },
  },
  plugins: [],
};
