import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  base: '/',

  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],

  server: {
    host: true,
    port: 5173,

    allowedHosts: [
      'app.dsnexus.dpdns.org',
      '.dpdns.org',
      'www.dsinvest.in',
      'dsinvest.in',
      '.trycloudflare.com',
    ],
  },
})