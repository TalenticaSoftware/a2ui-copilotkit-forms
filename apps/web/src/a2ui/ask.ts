import { useAgent, useCopilotKit } from '@copilotkit/react-core/v2'

/**
 * Say something to the agent as if the person had typed it.
 *
 * Row actions used to `dispatchAction` an event, which worked and read badly:
 * pressing Edit made a form appear from nowhere, with nothing in the transcript
 * saying why. A conversation should be able to explain itself when scrolled
 * back through, so the button says "Edit Ada Okonkwo" out loud and the agent
 * answers the question it was actually asked.
 *
 * The run goes through `copilotkit.runAgent`, NOT `agent.runAgent`, and the
 * difference is not cosmetic. CopilotKit's core is what assembles the run's
 * context, and one of those entries carries the A2UI catalog id — the
 * middleware finds it by description and reads `catalogId` from it. Started
 * straight off the agent, the run carries no context, the middleware falls back
 * to its hardcoded default, and the surface is created against
 * `https://a2ui.org/specification/v0_9/basic_catalog.json` — a catalog this
 * client does not have. The renderer holds exactly one catalog and matches by
 * exact id, so there is nothing to fall back to and the whole turn dies with
 * "Catalog not found" (F33).
 *
 * The extra context this carries is also why the two routes into editing — a
 * row action and typing the request — are genuinely the same route, rather than
 * two that merely look alike.
 */
export function useAsk() {
  const { agent } = useAgent()
  const { copilotkit } = useCopilotKit()

  return (text: string) => {
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: text })
    // Not awaited: the caller is a click handler, and the surface it belongs to
    // is about to go stale anyway. Failures surface in the conversation.
    void copilotkit.runAgent({ agent })
  }
}
