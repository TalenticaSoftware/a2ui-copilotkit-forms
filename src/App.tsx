import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Placeholder shell.
 *
 * Deliberately hand-written and static: step 2 of the plan is to get shadcn
 * rendering properly BEFORE any model is involved, so that when the generator
 * arrives there is exactly one new thing to debug rather than two.
 */
export default function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Prompt to form</h1>
        <p className="text-muted-foreground text-sm">
          Describe the form you need. Nothing is saved anywhere.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scaffold check</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="probe">A field, rendered by shadcn/ui</Label>
            <Input id="probe" placeholder="I need a register form" />
          </div>
          <Button className="self-start">Nothing happens yet</Button>
        </CardContent>
      </Card>
    </main>
  )
}
