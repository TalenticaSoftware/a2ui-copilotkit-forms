import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAgent, useAgentContext } from '@copilotkit/react-core/v2'
import { CATALOG_ID } from '@/a2ui/catalog/definitions'

/**
 * Which surface is the live one.
 *
 * A conversation keeps every surface it has ever drawn. Without this, a table
 * from six turns ago still has working Delete buttons, and a form from before
 * the record was renamed still submits — against a transcript that says
 * otherwise. Acting on a stale surface is not a mis-click, it is doing the
 * right thing to the wrong version of the world.
 *
 * Counted by SURFACE, not by agent turn, and the difference matters. Turn-based
 * counting disabled a form the moment the agent said anything at all — including
 * "the email address is invalid", which is precisely when the person needs to
 * correct it and press the button again. They were left with a dead form and no
 * way back except asking for a new one, losing everything they had typed.
 *
 * A surface is superseded when a LATER surface exists, which is what "out of
 * date" actually means. Words about a form do not replace it.
 */

const TurnContext = createContext<{ latest: number; announce: (n: number) => void }>({
  latest: 0,
  announce: () => {},
})

/** Descendants of a surface share its verdict rather than claiming their own. */
const StaleContext = createContext(false)

let sequence = 0

export function TurnProvider({ children }: { children: ReactNode }) {
  const { agent } = useAgent()
  const [latest, setLatest] = useState(0)

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

  // Kept only so a reconnect resets nothing; the count itself is per surface.
  useEffect(() => {
    const subscription = agent.subscribe({})
    return () => subscription?.unsubscribe?.()
  }, [agent])

  const announce = (n: number) => setLatest((current) => (n > current ? n : current))

  return <TurnContext.Provider value={{ latest, announce }}>{children}</TurnContext.Provider>
}

/**
 * Claim a place in the order, and report whether anything newer exists.
 *
 * Called by the components that ARE a surface — a card, a table — and once
 * each. Its descendants read `useStale` instead, so a submit button inside a
 * form shares that form's fate rather than counting as a surface of its own.
 */
export function useSurface(): boolean {
  const { latest, announce } = useContext(TurnContext)
  const [mine] = useState(() => (sequence += 1))
  useEffect(() => announce(mine), [mine, announce])
  return mine < latest
}

/** Whether the surface this component sits inside has been superseded. */
export const useStale = () => useContext(StaleContext)

export function StaleProvider({ stale, children }: { stale: boolean; children: ReactNode }) {
  return <StaleContext.Provider value={stale}>{children}</StaleContext.Provider>
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
