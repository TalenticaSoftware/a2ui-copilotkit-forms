import { useAgent, useCopilotKit } from '@copilotkit/react-core/v2'

/**
 * Say something to the agent as if the person had typed it, so the transcript
 * explains where a form came from.
 *
 * Through `copilotkit.runAgent`, NOT `agent.runAgent`: CopilotKit's core
 * assembles the run context, and the A2UI catalog id lives there. Without it the
 * middleware falls back to a catalog this client does not have, and the turn dies
 * with "Catalog not found" (F33).
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
