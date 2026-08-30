import { useSyncExternalStore } from 'react'
import { CopilotChat } from '@copilotkit/react-core/v2'
import { clearSubmission, getSubmission, subscribe } from '@/form/submissions'
import { Button } from '@/components/ui/button'

/**
 * Chat on the left, submitted values on the right.
 *
 * The form is drawn INSIDE the conversation — an A2UI surface using our own
 * components, registered on the provider in `main.tsx`. This file owns no form
 * logic at all; it only shows what came back out of one.
 */
export default function App() {
  /**
   * Read from the module store rather than component state.
   *
   * The form lives inside a chat message, which CopilotKit remounts as messages
   * stream. A submit handler closing over this component's setState would be
   * writing into whichever instance existed when the catalog was built.
   */
  const submission = useSyncExternalStore(subscribe, getSubmission, getSubmission)

  return (
    <main className="flex h-svh flex-col lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col border-b lg:border-r lg:border-b-0">
        <header className="flex flex-col gap-0.5 border-b px-5 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Prompt to form</h1>
          <p className="text-muted-foreground text-sm">
            Ask for a form — "I need a register form". Nothing is saved anywhere.
          </p>
        </header>
        <div className="min-h-0 flex-1">
          <CopilotChat />
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium">Result</h2>
            <p className="text-muted-foreground text-xs">What a submitted form produced.</p>
          </div>
          {submission && (
            <Button variant="outline" size="sm" onClick={clearSubmission}>
              Clear
            </Button>
          )}
        </header>

        <div className="p-5">
          {submission ? (
            <div className="flex flex-col gap-2">
              <pre className="bg-muted overflow-x-auto rounded-md p-4 font-mono text-xs">
                {JSON.stringify(submission.values, null, 2)}
              </pre>
              <p className="text-muted-foreground text-xs">
                That is the whole submit — the values are shown and discarded.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Ask for a form in the chat, fill it in, and the answers appear here.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
