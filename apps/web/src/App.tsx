import { CopilotChat } from '@copilotkit/react-core/v2'
import { TurnProvider } from '@/a2ui/turn'

/**
 * The chat, and nothing else.
 *
 * No header, no shell. Everything the person sees — forms, tables, the results
 * of a save — is drawn INSIDE the conversation as an A2UI surface, so a frame
 * around it would only be a frame around a chat. This file holds no form state,
 * no submit handler and no result pane; each of those belongs to the component
 * that owns it.
 *
 * `TurnProvider` is the exception, and it has to be here: it tells every
 * surface whether it still belongs to the live turn, and only something wrapping
 * the whole conversation can know that.
 */
export default function App() {
  return (
    <TurnProvider>
      {/*
        No horizontal padding here.
        Cards used to lose their left ring, and this is where I first reached
        for a fix — one level too high to work. The clipping happens inside
        CopilotKit's own scroll viewport, so the inset has to be on the cards
        themselves; see SURFACE in the renderers. Padding here only narrowed the
        conversation.
      */}
      <main className="mx-auto h-svh max-w-3xl">
        <CopilotChat />
      </main>
    </TurnProvider>
  )
}
