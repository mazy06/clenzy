import { buildApiUrl } from '../../../../config/api';
import { getAccessToken } from '../../../../keycloak';
import { BaitlyChatAdapter } from './BaitlyChatAdapter';
import { BaitlyAgUiClient } from './BaitlyAgUiClient';
import { BaitlyAgUiError } from './BaitlyAgUiProtocol';

/** Not routed. Calling this factory performs no I/O; mounting only reads recovery. */
export function createBaitlyChatCandidate(conversationId: number, maxFrameBytes: number): BaitlyChatAdapter {
  const headers = (): Record<string, string> => {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };
  return new BaitlyChatAdapter({ conversationId,
    loadRecovery: async () => {
      const response = await fetch(buildApiUrl(`/agui/recovery?conversationId=${conversationId}`), {
        credentials: 'include', headers: { ...headers(), Accept: 'application/json' },
      });
      if (!response.ok) { try { await response.body?.cancel(); } catch { /* no body diagnostic */ }
        throw new BaitlyAgUiError('HTTP', response.status); }
      try { return await response.json(); } catch { throw new BaitlyAgUiError('INVALID_STREAM'); }
    },
    createClient: () => new BaitlyAgUiClient({ url: buildApiUrl('/agui/run'), getHeaders: headers, maxFrameBytes }),
  });
}
