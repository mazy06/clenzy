import { addIntegration, replayIntegration } from '@sentry/react';

/** Le module de capture visuelle n'entre dans le bundle qu'après le planning. */
export function startBaitlyReplay(): void {
  addIntegration(replayIntegration());
}
