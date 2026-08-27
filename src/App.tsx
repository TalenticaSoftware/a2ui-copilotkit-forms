import { useState, useSyncExternalStore } from 'react'
import { CopilotChat } from '@copilotkit/react-core/v2'
import { Button } from '@/components/ui/button'
import { FormRenderer } from '@/components/FormRenderer'
import { SAMPLES } from '@/lib/sample-specs'
import { clearSubmission, getSubmission, subscribe, submit } from '@/lib/submission-store'

/**
 * Chat on the left, results on the right.
 *
 * The form itself is drawn INSIDE the conversation now — an A2UI surface, using
 * our own components via the catalog registered in `main.tsx`. The right pane is
 * no longer a separate bench: it shows what a submitted form produced, and keeps
 * the hand-written recipes as a control, so a broken agent can still be told
 * apart from a broken renderer.
 */
export default function App() {
  const [control, setControl] = useState<(typeof SAMPLES)[number]['id'] | null>(null)

  /**
   * Read from the module store rather than holding submissions in state.
   *
   * The A2UI form lives inside a chat message, which CopilotKit remounts as
   * messages stream. A handler closing over this component's `setState` would
   * be writing into whichever instance existed when the catalog was built.
   */
  const submission = useSyncExternalStore(subscribe, getSubmission, getSubmission)

  const sample = control ? SAMPLES.find((entry) => entry.id === control)! : null

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
            <p className="text-muted-foreground text-xs">
              What a submitted form produced.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* The control group: same renderer, recipe typed by hand. If these
                draw and the agent's does not, the fault is upstream of us. */}
            {SAMPLES.map((entry) => (
              <Button
                key={entry.id}
                variant={entry.id === control ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setControl(entry.id === control ? null : entry.id)
                  clearSubmission()
                }}
              >
                {entry.label}
              </Button>
            ))}
          </div>
        </header>

        <div className="flex flex-col gap-6 p-5">
          {submission ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Submitted</h3>
              <pre className="bg-muted overflow-x-auto rounded-md p-4 font-mono text-xs">
                {JSON.stringify(submission.values, null, 2)}
              </pre>
              <p className="text-muted-foreground text-xs">
                That is the whole submit — the values are shown and discarded.
              </p>
            </div>
          ) : sample ? (
            <FormRenderer key={sample.id} spec={sample.spec} onSubmit={submit} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Ask for a form in the chat, or open one of the hand-written recipes
              above to check the renderer on its own.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
