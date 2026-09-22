import BaitlyTurnstile from './BaitlyTurnstile';
import { runtimeEnvOr } from '../config/runtimeConfig';

export default function TurnstileCaptcha({ onVerified, onInvalidated, resetKey }: {
  onVerified: (token: string) => void;
  onInvalidated: () => void;
  resetKey: number;
}) {
  return <BaitlyTurnstile siteKey={runtimeEnvOr('VITE_TURNSTILE_SITE_KEY', '')}
    action="login" language={document.documentElement.lang || 'fr'} resetKey={resetKey}
    onToken={token => token ? onVerified(token) : onInvalidated()} />;
}
