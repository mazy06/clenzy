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
      <div className="flex items-center px-3 h-[48px] border-b border-border shrink-0">
        <div className="inline-flex p-0.5 gap-0.5 bg-muted rounded-lg">
          {([{ value: 'properties', label: 'Propriétés affichées' }, { value: 'ai', label: 'Génération IA' }] as const).map((o) => {
            const active = o.value === tab;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(o.value)}
                className={cn(
                  'inline-flex h-7 items-center justify-center px-[10.5px] rounded-md',
                  'text-xs cursor-pointer appearance-none border-none',
                  'transition-colors duration-200 ease-out',
                  'hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  active
                    ? 'font-semibold text-foreground bg-card shadow-sm'
                    : 'font-medium text-muted-foreground bg-transparent shadow-none',
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
