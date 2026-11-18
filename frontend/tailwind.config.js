/** Palette is tuned for text contrast of at least 4.5:1 on its paired background. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17232B', haze: '#EEF1EF', mist: '#D9E0DD', pine: { DEFAULT: '#0F6B5A', dark: '#0A4F42', tint: '#E1F0EC' },
        aqi: {
          good: '#1B7F4B', 'good-bg': '#E3F3E9', moderate: '#7A5F00', 'moderate-bg': '#FBF1C7',
          usg: '#9A4A00', 'usg-bg': '#FDE6CC', unhealthy: '#B42318', 'unhealthy-bg': '#FBDAD6',
          very_unhealthy: '#7A2E8E', 'very_unhealthy-bg': '#EFD9F4', hazardous: '#6B1D2B', 'hazardous-bg': '#F1D3D8',
          unknown: '#4B5963', 'unknown-bg': '#E4E8E6',
        },
      },
      fontFamily: { sans: ['"Atkinson Hyperlegible"', 'ui-sans-serif', 'system-ui', '"Segoe UI"', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
}
