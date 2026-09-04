import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CopilotKitProvider } from '@copilotkit/react-core/v2'
import './index.css'
import App from './App.tsx'
import { catalog } from '@/a2ui/catalog'

/**
 * The runtime lives on its own port in development, so the URL is absolute and
 * configurable. Stated in .env.example rather than hard-coded, because a
 * silently wrong default here looks like a chat box that never answers.
 */
const RUNTIME_URL = import.meta.env.VITE_RUNTIME_URL ?? 'http://localhost:4100/api/copilotkit'

/**
 * The catalog goes on the PROVIDER.
 *
 * Only this mounts `A2UICatalogContext`, which tells the agent — in its run
 * context — which catalog ids and custom components this client can render,
 * along with their schemas. That is the negotiation the A2UI spec describes, and
 * it is what CopilotKit's own examples do.
 *
 * `createA2UIMessageRenderer` draws a surface but advertises nothing; passing
 * `renderActivityMessages` by hand is explicitly the wrong move (their skill doc
 * says so) because the provider mounts the renderer itself. That was F10.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CopilotKitProvider runtimeUrl={RUNTIME_URL} a2ui={{ catalog }}>
      <App />
    </CopilotKitProvider>
  </StrictMode>,
)
