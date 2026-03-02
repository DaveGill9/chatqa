/** Split actual into chat turns. Follow-ups are prefixed with [Follow-up N]: */
const RESPONSE_SEPARATOR = '\n---\n';
const FOLLOWUP_REGEX = /^\[Follow-up \d+\]:\s*/;

export function parseChatTurns(
  input: string,
  actual: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (!input?.trim() && !actual?.trim()) return turns;

  turns.push({ role: 'user', content: (input || '').trim() || '—' });

  if (!actual?.trim()) return turns;

  const chunks = actual.split(RESPONSE_SEPARATOR).map((s) => s.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const followupMatch = chunk.match(FOLLOWUP_REGEX);
    if (followupMatch) {
      const userMessage = chunk.replace(FOLLOWUP_REGEX, '').trim();
      if (userMessage) turns.push({ role: 'user', content: userMessage });
    } else {
      turns.push({ role: 'assistant', content: chunk });
    }
  }
  return turns;
}
