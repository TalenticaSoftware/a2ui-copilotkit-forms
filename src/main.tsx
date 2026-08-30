import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CopilotKitProvider } from '@copilotkit/react-core/v2'
import './index.css'
import App from './App.tsx'
import { buildClientCatalog } from '@/lib/a2ui-client-catalog'
import { submit } from '@/lib/submission-store'

/**
 * The runtime lives on its own port in development, so the URL is absolute and
 * configurable. Stated in .env.example rather than hard-coded, because a
 * silently wrong default here looks like a chat box that never answers.
 */
const RUNTIME_URL = import.meta.env.VITE_RUNTIME_URL ?? 'http://localhost:4100/api/copilotkit'

/**
 * Which component catalog the browser offers. Independent of which TOOL the
 * server gives the agent (`RENDER_MODE`), because those are two separate axes:
 *
 *              │ A2UI's tool        │ our renderForm tool
 *   ───────────┼────────────────────┼─────────────────────
 *   basic      │ generic widgets    │ n/a
 *   ours       │ shadcn, A2UI-composed │ shadcn, we compose
 */
const CATALOG = import.meta.env.VITE_CATALOG === 'basic' ? 'basic' : 'ours'

/**
 * The catalog goes on the PROVIDER, not on a message renderer.
 *
 * This is the piece we had wrong. `createA2UIMessageRenderer({ catalog })` can
 * draw a surface, but only the provider's `a2ui.catalog` mounts
 * `A2UICatalogContext` — which is what tells the agent, in its run context,
 * "here are the catalog ids and custom components this client can render",
 * along with their JSON schemas in the v0.9 inline format.
 *
 * That is the `supportedCatalogIds` negotiation the A2UI spec describes, and
 * without it the agent is only ever told about the basic catalog no matter what
 * the browser can actually draw (F10).
 */
const a2ui = CATALOG === 'ours' ? { catalog: buildClientCatalog(submit) } : {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CopilotKitProvider runtimeUrl={RUNTIME_URL} a2ui={a2ui}>
      <App />
    </CopilotKitProvider>
  </StrictMode>,
)
