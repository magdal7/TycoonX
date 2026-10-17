/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../shared/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0B1020',
        primary: '#3478FF',
        accent: '#8B5CF6',
        success: '#16A879'
      }
    }
  },
  plugins: []
}
