import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        auth: {
          navy: '#08172F',
          blue: '#002CE8',
          blueHover: '#0025C5',
          surface: '#FFFFFF',
          border: '#E2E8F0',
          muted: '#64748B',
        },
        customer: {
          orange: '#DE5803',
          orangeHover: '#C64E02',
          badgeBg: '#FFF7ED',
          badgeText: '#C2410C',
        },
        staff: {
          orange: '#EF5301',
          orangeHover: '#D44A01',
          red: '#DC2626',
          green: '#16A34A',
          amber: '#D97706',
        },
        owner: {
          orange: '#FD5001',
          peach: '#FEDFCE',
        },
        admin: {
          blue: '#005CFE',
          blueHover: '#004FD6',
          badgeBg: '#EFF6FF',
        },
      },
    },
  },
  plugins: [],
};

export default config;
