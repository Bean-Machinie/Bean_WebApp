/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        geist: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        border: 'var(--border)',
        background: 'var(--bg)',
        foreground: 'var(--text)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--text-contrast)',
        },
        secondary: {
          DEFAULT: 'var(--bg-tertiary)',
          foreground: 'var(--text)',
        },
        muted: {
          DEFAULT: 'var(--card-muted)',
          foreground: 'var(--text-muted)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--text)',
        },
      },
      animation: {
        'element': 'fadeSlideIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-right': 'slideRightIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'testimonial': 'testimonialIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
    },
  },
  plugins: [],
}
