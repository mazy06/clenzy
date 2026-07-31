import { useState } from 'react';
import { ButtonBase } from '@mui/material';
import type { StudioConfigState } from '../useStudioConfig';
import PropertySelectionPanel from './PropertySelectionPanel';
import ContentAiPanel from './ContentAiPanel';

/**
 * Section « Contenu » du Studio : regroupe la curation des propriétés affichées (persistée dans
 * la config, consommée par le rendu public) et la génération de contenu IA.
 */

type ContentTab = 'properties' | 'ai';

export default function ContentSection({ cfg }: { cfg: StudioConfigState }) {
  const [tab, setTab] = useState<ContentTab>('properties');

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center px-3 h-[48px] border-b border-[var(--line)] shrink-0">
        <div className="inline-flex p-0.5 gap-0.5 bg-[var(--field)] rounded-[var(--radius-md)]">
          {([{ value: 'properties', label: 'Propriétés affichées' }, { value: 'ai', label: 'Génération IA' }] as const).map((o) => {
            const active = o.value === tab;
            return (
              <ButtonBase
                key={o.value}
                onClick={() => setTab(o.value)}
                sx={{
                  height: 28, px: 1.75, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', cursor: 'pointer',
                  fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
                  color: active ? 'var(--ink)' : 'var(--muted)',
                  bgcolor: active ? 'var(--card)' : 'transparent',
                  boxShadow: active ? 'var(--shadow-card)' : 'none',
                  transition: 'color var(--duration-fast) var(--ease-out)',
                  '&:hover': { color: 'var(--ink)' },
                  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
                }}
              >
                {o.label}
              </ButtonBase>
            );
          })}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {tab === 'properties' ? <PropertySelectionPanel cfg={cfg} /> : <ContentAiPanel />}
      </div>
    </div>
  );
}
