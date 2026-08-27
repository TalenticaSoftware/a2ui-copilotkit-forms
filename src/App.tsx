import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FormRenderer } from '@/components/FormRenderer'
import { SAMPLES } from '@/lib/sample-specs'
import type { FormValues } from '@/lib/catalog'

/**
 * A bench for the renderer, not the product.
 *
 * Step 2 of the plan: draw a form from a hand-written recipe, with no agent and
 * no server, so that when the agent arrives there is exactly one new thing to
 * debug. The chat box replaces all of this later.
 */
export default function App() {
  const [current, setCurrent] = useState<(typeof SAMPLES)[number]['id']>('register')
  const [submitted, setSubmitted] = useState<FormValues | null>(null)

  const sample = SAMPLES.find((entry) => entry.id === current)!

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-6 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Prompt to form</h1>
        <p className="text-muted-foreground text-sm">
          Renderer bench — hand-written recipes, no agent yet.
        </p>
      </header>

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

      {/* Keyed on the sample so switching forms remounts rather than carrying
          one form's answers into another's fields. */}
      <FormRenderer key={sample.id} spec={sample.spec} onSubmit={setSubmitted} />

      {submitted && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Submitted</h2>
          {/* The whole submit. Nothing is stored, and nothing is sent. */}
          <pre className="bg-muted overflow-x-auto rounded-md p-4 font-mono text-xs">
            {JSON.stringify(submitted, null, 2)}
          </pre>
        </section>
      )}
    </main>
  )
}
