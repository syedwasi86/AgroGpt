import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, './package.json'), 'utf-8')
)
const buildVersion = new Date().toISOString().split('T')[0] + '-1'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
  ],
  optimizeDeps: {
    include: ['react-is']
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_VERSION__: JSON.stringify(buildVersion),
  }
})
