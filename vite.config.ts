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
    /*
      One React, not several.
      pnpm gives @copilotkit/a2ui-renderer its own resolution for React, and two
      copies in one page means every hook call from the second copy throws
      "Invalid hook call" — which reads like a Rules-of-Hooks mistake in our
      code and is not one. Recorded as F7.
    */
    dedupe: ["react", "react-dom"],
  },
  // Stated here rather than left to Vite's default, so the port the launch
  // config opens and the port the server binds cannot drift apart. Portal-Lite
  // next door already owns 5173.
  server: { port: 5174, strictPort: true },
})
