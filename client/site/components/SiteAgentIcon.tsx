import type { ComponentProps } from 'react';
import type { AgentIcon } from '../../src/modules/supervision/renderers/agentIcon';
import type { AgentIconToken } from '../../src/modules/supervision/constants';
import type { AgentId } from '../../src/modules/supervision/types';
import { SiteAgentPortrait } from './SiteProductVisuals';

const AGENT_BY_TOKEN = {
  chat: 'com', 'trend-up': 'rev', broom: 'ops', bank: 'fin', star: 'rep',
  'calendar-sync': 'sync', shield: 'cmp', concierge: 'gst', handshake: 'own', megaphone: 'gro',
} satisfies Record<AgentIconToken, AgentId>;

/** Existing demos now share the static PMS portraits. */
export default function SiteAgentIcon({ token, size = 32 }: ComponentProps<typeof AgentIcon>) {
  return <SiteAgentPortrait agent={AGENT_BY_TOKEN[token]} size={Math.max(size, 28)} />;
}
