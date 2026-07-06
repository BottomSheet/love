import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// base: '/love/' — потому что сайт будет жить на
// https://bottomsheet.github.io/love/ (GitHub Pages отдаёт проектные
// сайты из подпапки с именем репозитория, а не из корня домена).
// Для локальной разработки (`npm run dev`) base остаётся '/', чтобы
// открывать сайт как обычно на http://localhost:5173/
export default defineConfig(({ command }) => ({
  plugins: [vue(), tailwindcss()],
  base: command === 'build' ? '/love/' : '/',
  server: {
    // npm run dev -- --host, чтобы открыть с телефона
    host: true,
  },
}))
