import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAgent, useAgentContext } from '@copilotkit/react-core/v2'
import { CATALOG_ID } from '@/a2ui/catalog/definitions'

/**
 * Which surface is the live one, so a table from six turns ago cannot still be
 * acted on. Counted by SURFACE, not by agent turn: words about a form — "that
 * email is invalid" — must not disable the form you need to correct.
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
   * The catalog id, stated again. The renderer holds exactly one catalog and
   * matches by exact id, so naming the wrong one is fatal with no fallback.
   * Only the browser knows this id; the runtime must not.
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

/** Claim a place in the order. Descendants read `useStale` so they share their surface's fate. */
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

/** Dimmed as well as inert: a control that silently does nothing is worse than one that cannot. */
export const staleClass = (stale: boolean) =>
  stale ? 'pointer-events-none opacity-55 select-none' : undefined
