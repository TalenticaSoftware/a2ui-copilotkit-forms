import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `import.meta.dirname`, not `__dirname`: Vite's native config loader does
    // not support the CJS global and warns that it is going away.
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  // Stated here rather than left to Vite's default, so the port the launch
  // config opens and the port the server binds cannot drift apart. Portal-Lite
  // next door already owns 5173.
  server: { port: 5174, strictPort: true },
})
