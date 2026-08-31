import { CopilotChat } from '@copilotkit/react-core/v2'

/**
 * The chat, and nothing else.
 *
 * The form is drawn INSIDE the conversation as an A2UI surface, and a completed
 * form is dispatched to the agent rather than caught here — so this file holds
 * no form state, no submit handler and no result pane. What happens to an answer
 * is the agent's business.
 */
export default function App() {
  return (
    <main className="mx-auto flex h-svh max-w-3xl flex-col">
      <header className="flex flex-col gap-0.5 border-b px-5 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Prompt to form</h1>
        <p className="text-muted-foreground text-sm">
          Ask for a form — "I need a register form". Nothing is saved anywhere.
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <CopilotChat />
      </div>
    </main>
  )
}
