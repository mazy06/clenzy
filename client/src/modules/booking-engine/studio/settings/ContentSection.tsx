import { useState } from 'react';
import { cn } from '../../../../utils/cn';
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
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(o.value)}
                className={cn(
                  'inline-flex h-7 items-center justify-center px-[10.5px] rounded-[var(--radius-sm)]',
                  'text-[var(--text-sm)] cursor-pointer appearance-none border-none',
                  'transition-[color] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
                  'hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
                  active
                    ? 'font-semibold text-[var(--ink)] bg-[var(--card)] shadow-[var(--shadow-card)]'
                    : 'font-medium text-[var(--muted)] bg-transparent shadow-none',
                )}
              >
                {o.label}
              </button>
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
