import { useState } from 'react'
import { CopilotChat } from '@copilotkit/react-core/v2'
import { Button } from '@/components/ui/button'
import { FormRenderer } from '@/components/FormRenderer'
import { SAMPLES } from '@/lib/sample-specs'
import type { FormValues } from '@/lib/catalog'

/**
 * Two panes, and they do not talk to each other yet.
 *
 * Left is the chat box, wired to the runtime. Right is the renderer bench from
 * step 2, still fed by hand-written recipes. Joining them — so a recipe from the
 * agent draws with OUR components rather than CopilotKit's default A2UI
 * renderer — is step 5, and keeping them apart until then means the two halves
 * can be proven separately.
 */
export default function App() {
  const [current, setCurrent] = useState<(typeof SAMPLES)[number]['id']>('register')
  const [submitted, setSubmitted] = useState<FormValues | null>(null)

  const sample = SAMPLES.find((entry) => entry.id === current)!

  return (
    <main className="flex h-svh flex-col lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col border-b lg:border-r lg:border-b-0">
        <header className="flex flex-col gap-0.5 border-b px-5 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Prompt to form</h1>
          <p className="text-muted-foreground text-sm">
            Ask for a form. Nothing is saved anywhere.
          </p>
        </header>
        <div className="min-h-0 flex-1">
          <CopilotChat />
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium">Renderer bench</h2>
            <p className="text-muted-foreground text-xs">
              Hand-written recipes — not yet fed by the agent.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((entry) => (
              <Button
                key={entry.id}
                variant={entry.id === current ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setCurrent(entry.id)
                  setSubmitted(null)
                }}
              >
                {entry.label}
              </Button>
            ))}
          </div>
        </header>

        <div className="flex flex-col gap-6 p-5">
          {/* Keyed on the sample so switching remounts rather than carrying one
              form's answers into another's fields. */}
          <FormRenderer key={sample.id} spec={sample.spec} onSubmit={setSubmitted} />

          {submitted && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Submitted</h3>
              <pre className="bg-muted overflow-x-auto rounded-md p-4 font-mono text-xs">
                {JSON.stringify(submitted, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
