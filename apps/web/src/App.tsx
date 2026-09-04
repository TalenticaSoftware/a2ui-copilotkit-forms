import { CopilotChat } from '@copilotkit/react-core/v2'

/**
 * The chat, and nothing else.
 *
 * The form is drawn INSIDE the conversation as an A2UI surface, so this file
 * holds no form state, no submit handler and no result pane. The submit button
 * posts to the API from its own renderer and the agent narrates what came back
 * — neither of which needs a shell around them.
 */
export default function App() {
  return (
    <main className="mx-auto flex h-svh max-w-3xl flex-col">
      <header className="flex flex-col gap-0.5 border-b px-5 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Prompt to form</h1>
        <p className="text-muted-foreground text-sm">
          Say what you want to do — "I want to add a user". The form comes from
          the API's own schema, and saving really saves.
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <CopilotChat />
      </div>
    </main>
  )
}
