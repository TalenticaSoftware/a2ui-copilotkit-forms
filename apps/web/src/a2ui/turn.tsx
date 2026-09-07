import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAgent, useAgentContext } from '@copilotkit/react-core/v2'
import { CATALOG_ID } from '@/a2ui/catalog/definitions'

/**
 * Which turn is the live one.
 *
 * A conversation keeps every surface it has ever drawn. Without this, a table
 * from six turns ago still has working Delete buttons, and a form from before
 * the record was renamed still submits — against a transcript that says
 * otherwise. Acting on a stale surface is not a mis-click, it is doing the
 * right thing to the wrong version of the world.
 *
 * The turn number comes from the agent's own run lifecycle rather than from
 * counting messages: a run is the unit that produces a surface, so a surface
 * belongs to exactly one.
 */

const TurnContext = createContext(0)

export function TurnProvider({ children }: { children: ReactNode }) {
  const { agent } = useAgent()
  const [turn, setTurn] = useState(0)

  /**
   * Say the catalog id again, plainly.
   *
   * CopilotKit already advertises it, and the agent still reached for A2UI's
   * BASIC catalog — "Catalog not found:
   * https://a2ui.org/specification/v0_9/basic_catalog.json". That is fatal
   * rather than degraded: the renderer is constructed as
   * `new MessageProcessor([catalog ?? basicCatalog])`, a list of ONE, and a
   * surface is matched by exact id. Name the wrong catalog and there is nothing
   * to fall back to.
   *
   * So this is a second, blunter statement of the same fact, from the only side
   * that knows it. The runtime cannot carry it: a catalog id in the system
   * prompt would be the browser's vocabulary living on the server, which is the
   * coupling this project exists to avoid.
   */
  useAgentContext({
    description: 'The ONLY A2UI catalog this client can render. Every surface must use this id.',
    value: { catalogId: CATALOG_ID },
  })

  useEffect(() => {
    const subscription = agent.subscribe({
      onRunStartedEvent: () => setTurn((current) => current + 1),
    })
    return () => subscription?.unsubscribe?.()
  }, [agent])

  return <TurnContext.Provider value={turn}>{children}</TurnContext.Provider>
}

/**
 * True while the component belongs to the newest turn.
 *
 * Captured once at mount, deliberately: the value is "which turn was running
 * when this was drawn", and that never changes for a given surface. Comparing
 * it to the live turn is what goes stale.
 */
export function useIsCurrentTurn(): boolean {
  const turn = useContext(TurnContext)
  const [mountedAt] = useState(turn)
  return mountedAt === turn
}

/**
 * What a superseded surface looks like: dimmed, and inert to the pointer.
 *
 * Dimmed as well as disabled because a control that silently does nothing is
 * worse than one that visibly cannot be used — the same reason a stuck spinner
 * is the worst failure in `findings.md`.
 */
export const staleClass = (stale: boolean) =>
  stale ? 'pointer-events-none opacity-55 select-none' : undefined
