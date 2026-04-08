import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './app/**/*.{vue,js,ts}',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}',
    './composables/**/*.{js,ts}',
    './server/**/*.{js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        abyss: '#050507',
        carbon: '#101010',
        charcoal: '#3d3a39',
        signal: '#00d992',
        mint: '#2fd6a1',
        snow: '#f2f2f2',
        parchment: '#b8b3b0',
        slate: '#8b949e',
        danger: '#fb565b',
        warning: '#ffba00',
        info: '#4cb3d4'
      },
      fontFamily: {
        heading: ['system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      borderRadius: {
        sm: '6px',
        md: '8px'
      },
      boxShadow: {
        ambient: 'rgba(92, 88, 85, 0.2) 0px 0px 15px',
        dramatic: 'rgba(0, 0, 0, 0.7) 0px 20px 60px'
      }
    }
  }
}
