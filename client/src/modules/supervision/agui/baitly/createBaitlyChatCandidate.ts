import { buildApiUrl } from '../../../../config/api';
import keycloak, { getAccessToken } from '../../../../keycloak';
import { BaitlyChatAdapter } from './BaitlyChatAdapter';
import { BaitlyAgUiClient } from './BaitlyAgUiClient';
import { BaitlyAgUiError } from './BaitlyAgUiProtocol';

/** Factory performs no I/O; mounting reads only recovery, discovery precedes an explicit send. */
export function createBaitlyChatCandidate(conversationId: number|null, maxFrameBytes: number): BaitlyChatAdapter {
  const headers = (): Record<string, string> => {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };
  return new BaitlyChatAdapter({ conversationId,
    loadRecovery: async (id=conversationId ?? undefined) => {
      if(id===undefined) return {version:1,resumePolicy:'durable-decision-v1',conversationId:null,canStart:true,actions:[]};
      const response = await fetch(buildApiUrl(`/agui/recovery?conversationId=${id}`), {
        credentials: 'include', headers: { ...headers(), Accept: 'application/json' },
      });
      if (!response.ok) { try { await response.body?.cancel(); } catch { /* no body diagnostic */ }
        throw new BaitlyAgUiError('HTTP', response.status); }
      try { return await response.json(); } catch { throw new BaitlyAgUiError('INVALID_STREAM'); }
    },
    createClient: () => new BaitlyAgUiClient({ url: buildApiUrl('/agui/run'), getHeaders: headers, maxFrameBytes,
      beforeSend:async()=>{
        try { await keycloak.updateToken(30); } catch { /* HttpOnly cookie remains authoritative. */ }
        const response=await fetch(buildApiUrl('/agui/info'),{credentials:'include',headers:{...headers(),Accept:'application/json'},cache:'no-store'});
        if(!response.ok) { await response.body?.cancel(); throw new BaitlyAgUiError('HTTP',response.status); }
        const info:unknown=await response.json();
        if(!info || typeof info!=='object' || !('agents' in info) || !Array.isArray(info.agents)
          || !info.agents.some((agent:unknown)=>agent && typeof agent==='object' && 'name' in agent && agent.name==='clenzy-supervisor'))
          throw new BaitlyAgUiError('PROTOCOL');
      },
    }),
  });
}
