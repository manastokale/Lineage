import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", ["VITE_", "FRIENDSOS_"])
  const apiTarget = env.VITE_API_URL || "http://127.0.0.1:8000"

  return {
    envDir: "..",
    envPrefix: ["VITE_", "FRIENDSOS_"],
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
      watch: {
        ignored: [
          "**/package.json",
          "**/postcss.config.js",
          "**/tailwind.config.js",
          "**/tsconfig.json",
          "**/tsconfig.app.json",
          "**/tsconfig.node.json",
        ],
        awaitWriteFinish: {
          stabilityThreshold: 1200,
          pollInterval: 100,
        },
      },
    },
    optimizeDeps: {
      holdUntilCrawlEnd: false,
      noDiscovery: true,
      include: ["react", "react-dom/client", "react-router-dom", "zustand"],
    },
  }
})
