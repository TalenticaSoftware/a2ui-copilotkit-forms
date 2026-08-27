import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  CopilotKitProvider,
  createA2UIMessageRenderer,
  a2uiDefaultTheme,
} from '@copilotkit/react-core/v2'
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
 * Built once, at module scope.
 *
 * The submit handler is a module function rather than a closure over component
 * state, so nothing here captures a value that a later render would replace —
 * the frozen-callback trap Portal-Lite hit when it derived state inside a
 * render callback.
 */
const a2ui = createA2UIMessageRenderer({
  theme: a2uiDefaultTheme,
  catalog: buildClientCatalog(submit),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CopilotKitProvider runtimeUrl={RUNTIME_URL} renderActivityMessages={[a2ui]}>
      <App />
    </CopilotKitProvider>
  </StrictMode>,
)
