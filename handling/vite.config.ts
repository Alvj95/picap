import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the build works under any sub-path (e.g. GitHub Pages /turnos/).
  base: './',
  plugins: [react()],
})
