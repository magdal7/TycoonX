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
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--c-surface-2) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        gold: 'rgb(var(--c-gold) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 44px -14px rgb(var(--c-primary) / 0.5)',
        gold: '0 0 34px -16px rgb(var(--c-gold) / 0.55)',
        card: '0 18px 40px -24px rgba(0,0,0,0.85)'
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        sheen: { '0%': { transform: 'translateX(-100%)' }, '55%,100%': { transform: 'translateX(100%)' } },
        'reward-rise': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.92)' },
          '16%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '72%': { opacity: '1', transform: 'translateY(-4px) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-14px) scale(1.02)' }
        },
        'pop': { '0%': { transform: 'scale(0.96)' }, '60%': { transform: 'scale(1.02)' }, '100%': { transform: 'scale(1)' } }
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        'slide-up': 'slide-up 0.4s ease-out both',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        sheen: 'sheen 3.5s ease-in-out infinite',
        reward: 'reward-rise 1.6s ease-out both',
        pop: 'pop 0.22s ease-out both'
      }
    }
  },
  plugins: []
}
