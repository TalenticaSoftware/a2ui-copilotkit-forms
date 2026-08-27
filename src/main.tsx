import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CopilotKitProvider } from '@copilotkit/react-core/v2'
import './index.css'
import App from './App.tsx'

/**
 * The runtime lives on its own port in development, so the URL is absolute and
 * configurable. Stated in .env.example rather than hard-coded, because a
 * silently wrong default here looks like a chat box that never answers.
 */
const RUNTIME_URL = import.meta.env.VITE_RUNTIME_URL ?? 'http://localhost:4100/api/copilotkit'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CopilotKitProvider runtimeUrl={RUNTIME_URL}>
      <App />
    </CopilotKitProvider>
  </StrictMode>,
)
