/** Only offer an explanation when it adds text to the summary already shown. */
export function additionalActionReasoning(motif: string | undefined, reasoning: string | undefined): string | undefined {
  const normalize = (text: string) => text.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const explanation = reasoning?.trim();
  if (!explanation || normalize(explanation) === normalize(motif ?? '')) return undefined;
  return explanation;
}
