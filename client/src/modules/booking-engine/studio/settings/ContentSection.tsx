import { useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, height: 48, borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <Box sx={{ display: 'inline-flex', p: 0.25, gap: 0.25, bgcolor: 'var(--field)', borderRadius: 'var(--radius-md)' }}>
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
        </Box>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {tab === 'properties' ? <PropertySelectionPanel cfg={cfg} /> : <ContentAiPanel />}
      </Box>
    </Box>
  );
}
