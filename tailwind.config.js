/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mac: {
          bg: '#1e1e24',
          card: '#282830',
          hover: '#32323d',
          border: '#3f3f4e',
          accent: '#3b82f6',
          accentHover: '#2563eb',
          subtle: '#9ca3af',
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'system-ui',
          'sans-serif'
        ]
      }
    },
  },
  plugins: [],
}
