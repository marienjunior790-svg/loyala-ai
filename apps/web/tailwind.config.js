/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Surface tokens are translucent so the animated backdrop shows through panels and
      // inputs; an opacity modifier (e.g. bg-card/50) scales the base alpha.
      colors: {
        border: 'hsl(var(--glass-highlight) / calc(<alpha-value> * 0.09))',
        input: 'hsl(var(--glass-highlight) / calc(<alpha-value> * 0.11))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background) / calc(<alpha-value> * 0.4))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / calc(<alpha-value> * 0.7))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / calc(<alpha-value> * 0.7))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / calc(<alpha-value> * 0.55))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          border: 'hsl(var(--glass-highlight) / calc(<alpha-value> * 0.08))',
          accent: 'hsl(var(--glass-highlight) / calc(<alpha-value> * 0.05))',
        },
        gold: 'hsl(var(--gold))',
        loyala: {
          green: '#00C853',
          gold: '#D9AE5B',
          dark: '#040705',
          navy: '#1B3A5C',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.5s infinite',
      },
      boxShadow: {
        glow: '0 0 40px -10px hsl(var(--primary) / 0.35)',
        'glow-lg': '0 0 70px -12px hsl(var(--primary) / 0.55)',
        'glow-gold': '0 0 40px -12px hsl(var(--gold) / 0.45)',
        card: '0 1px 0 0 hsl(0 0% 100% / 0.04) inset',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
