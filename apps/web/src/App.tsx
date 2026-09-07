import { CopilotChat } from '@copilotkit/react-core/v2'

/**
 * The chat, and nothing else.
 *
 * No header, no shell. Everything the person sees — forms, tables, the results
 * of a save — is drawn INSIDE the conversation as an A2UI surface, so a frame
 * around it would only be a frame around a chat. This file holds no form state,
 * no submit handler and no result pane; each of those belongs to the component
 * that owns it.
 */
export default function App() {
  return (
    <main className="mx-auto h-svh max-w-3xl">
      <CopilotChat />
    </main>
  )
}
