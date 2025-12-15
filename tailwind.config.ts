import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cyber-Cozy dark theme colors
        'lyra-bg': '#0f0f1a',
        'lyra-surface': '#1a1a2e',
        'lyra-accent': '#4a4a6a',
        'lyra-text': '#e0e0e8',
        'lyra-muted': '#8888a0',
        'lyra-orb-1': '#DDD6FE',
        'lyra-orb-2': '#C4B5FD',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(221, 214, 254, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(196, 181, 253, 0.6)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
