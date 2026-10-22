/** Replay deliberately unavailable until a separate consent and sensitive-screen review. */
export function startBaitlyReplay(): void {
  // Keep old callers harmless: a delayed import must never reactivate DOM recording.
}
