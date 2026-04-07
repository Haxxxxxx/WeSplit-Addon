/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary WeSplit brand colors (from website)
        green: '#A5EA15',
        greenBlue: '#53EF97',
        // Background colors
        bg: '#020300',
        black: '#061113',
        // White opacity variants
        white5: 'rgba(255, 255, 255, 0.05)',
        white10: 'rgba(255, 255, 255, 0.10)',
        white20: 'rgba(255, 255, 255, 0.20)',
        white30: 'rgba(255, 255, 255, 0.30)',
        white50: 'rgba(255, 255, 255, 0.50)',
        white60: 'rgba(255, 255, 255, 0.60)',
        white70: 'rgba(255, 255, 255, 0.70)',
        white80: 'rgba(255, 255, 255, 0.80)',
        // Green opacity
        green10: 'rgba(165, 234, 21, 0.1)',
        // Semantic colors
        error: '#DC3434',
        warning: '#FFD700',
        info: '#2196F3',
      },
      fontFamily: {
        satoshi: ['Satoshi', 'Inter', 'system-ui', 'sans-serif'],
        archivo: ['"Archivo SemiExpanded"', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        md: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
        '5xl': '48px',
        '6xl': '56px',
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        bold: '700',
        black: '900',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '40px',
        '3xl': '48px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        pill: '48px',
        full: '100px',
      },
      boxShadow: {
        'green-glow': '0 1px 3px 0 rgba(83, 239, 151, 0.24), 0 2px 6px 0 rgba(83, 239, 151, 0.24), 0 4px 8px 0 rgba(83, 239, 151, 0.12), 0 16px 32px -8px rgba(83, 239, 151, 0.48)',
        'card': '0 8px 32px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 8px 32px rgba(165, 234, 21, 0.1)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(174deg, #A5EA15 -0.01%, #53EF97 100.01%)',
        'gradient-card': 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.00) 50%, rgba(255, 255, 255, 0.05) 100%)',
      },
    },
  },
  plugins: [],
}
