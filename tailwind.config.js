/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2E7D32',
          50: '#E8F5E9',
          100: '#C8E6C9',
          200: '#A5D6A7',
          300: '#81C784',
          400: '#66BB6A',
          500: '#4CAF50',
          600: '#43A047',
          700: '#2E7D32',
          800: '#1B5E20',
          900: '#0B3D12',
        },
        secondary: {
          DEFAULT: '#FFA000',
          50: '#FFF8E1',
          100: '#FFECB3',
          200: '#FFE082',
          300: '#FFD54F',
          400: '#FFCA28',
          500: '#FFC107',
          600: '#FFB300',
          700: '#FFA000',
          800: '#FF8F00',
          900: '#FF6F00',
        },
        ink: {
          950: '#070B08',
          900: '#0B120D',
          800: '#0F1C14',
          700: '#13251A',
          600: '#1A3323',
          500: '#223F2D',
        },
        glass: {
          1: 'rgba(255, 255, 255, 0.06)',
          2: 'rgba(255, 255, 255, 0.09)',
          3: 'rgba(255, 255, 255, 0.12)',
        },
        stroke: {
          1: 'rgba(255, 255, 255, 0.10)',
          2: 'rgba(46, 125, 50, 0.35)',
          3: 'rgba(255, 160, 0, 0.35)',
        },
      },
      boxShadow: {
        glass:
          '0 12px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        glowPrimary: '0 0 0 1px rgba(46, 125, 50, 0.35), 0 18px 60px rgba(46, 125, 50, 0.15)',
        glowSecondary: '0 0 0 1px rgba(255, 160, 0, 0.35), 0 18px 60px rgba(255, 160, 0, 0.14)',
      },
      backgroundImage: {
        agroMesh:
          'radial-gradient(1000px 650px at 10% 10%, rgba(46,125,50,0.35), transparent 50%), radial-gradient(900px 550px at 90% 10%, rgba(255,160,0,0.22), transparent 45%), radial-gradient(1100px 800px at 50% 95%, rgba(46,125,50,0.18), transparent 55%)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
}

