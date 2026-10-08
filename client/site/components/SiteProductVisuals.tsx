import { CircleCheckIcon, Clock3Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AgentId } from '../../src/modules/supervision/types';
import { SITE_AGENT_PORTRAITS, SITE_PRODUCT_ARTWORK } from '../data/productArtwork';
import '../product-visuals.css';

export function SiteAgentPortrait({ agent, size = 40 }: { agent: AgentId; size?: number }) {
  return <img className="site-agent-portrait" data-agent-portrait={agent} src={SITE_AGENT_PORTRAITS[agent]}
    alt="" width={size} height={size} style={{ width: size, height: size }} loading="eager" decoding="async" draggable={false} />;
}

export function SiteAssistantPortrait({ size = 40 }: { size?: number }) {
  return <img className="site-assistant-portrait" src={SITE_PRODUCT_ARTWORK.assistant}
    alt="" width={size} height={size} loading="lazy" decoding="async" draggable={false} />;
}

/** Status remains available to keyboard and screen-reader users, beyond colour. */
export function SiteDemoStatus({ done, label, focusable = true }: { done: boolean; label: string; focusable?: boolean }) {
  return <span className="site-demo-status" data-done={done} role="img" aria-label={label} tabIndex={focusable ? 0 : undefined}>
    {done ? <CircleCheckIcon aria-hidden /> : <Clock3Icon aria-hidden />}
    <span className="site-demo-status-label" aria-hidden>{label}</span>
  </span>;
}

export function SiteDemoKpi({ artwork, label, value, detail }: {
  artwork: keyof typeof SITE_PRODUCT_ARTWORK; label: string; value: ReactNode; detail?: string;
}) {
  return <div className="site-demo-kpi" tabIndex={detail ? 0 : undefined}>
    <img src={SITE_PRODUCT_ARTWORK[artwork]} width={44} height={44} alt="" loading="lazy" decoding="async" />
    <div><span>{label}</span><strong>{value}</strong></div>
    {detail && <p className="site-demo-kpi-detail">{detail}</p>}
  </div>;
}
