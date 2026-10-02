import type { ComponentProps } from 'react';
import { BroomFill } from '../../src/icons';
import { AgentIcon } from '../../src/modules/supervision/renderers/agentIcon';

/** Keep the locally registered PMS broom visible in the initial site HTML. */
export default function SiteAgentIcon(props: ComponentProps<typeof AgentIcon>) {
  return props.token === 'broom' ? (
    <BroomFill size={props.size ?? 24} ssr />
  ) : (
    <AgentIcon {...props} />
  );
}
