import React from 'react';
import { Chip } from '@mui/material';

interface KnowledgeItem {
  documentId?: number;
  title?: string;
  sourcePath?: string;
  snippet?: string;
  relevance?: number; // 0..1
}

interface KnowledgeData {
  title?: string;
  query?: string;
  items?: KnowledgeItem[];
  count?: number;
}

interface KnowledgeWidgetProps {
  data: KnowledgeData;
}

/**
 * Widget de rendu pour {@code displayHint="knowledge"} — resultats RAG du tool
 * {@code search_knowledge_base}.
 *
 * <p>Liste de cartes hairline compactes : titre, snippet, source path + chip
 * relevance fond `-soft` (pattern statut « Signature »).</p>
 */
export const KnowledgeWidget: React.FC<KnowledgeWidgetProps> = ({ data }) => {
  const items = data.items ?? [];

  if (items.length === 0) {
    return (
      <div className="mt-1.5 mb-2">
        <div className="p-3 rounded-[12px] border border-[var(--line)] bg-[var(--card)] text-center">
          <p className="cn-text-body1 text-[12.5px] text-[var(--muted)]">
            Aucun resultat dans la documentation
            {data.query ? ` pour « ${data.query} »` : ''}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 mb-2">
      {data.title && (
        <p className="cn-text-body1 block mb-1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
          {data.title}{data.query ? ` · « ${data.query} »` : ''}
        </p>
      )}

      <div className="flex flex-col gap-1">
        {items.map((item, idx) => (
          <KbCard key={`${item.documentId}-${idx}`} item={item} />
        ))}
      </div>
    </div>
  );
};

const KbCard: React.FC<{ item: KnowledgeItem }> = ({ item }) => {
  const relevance = item.relevance ?? 0;
  const relevancePct = Math.round(relevance * 100);
  const [relevanceColor, relevanceBg] = relevance >= 0.8
    ? ['var(--ok)', 'var(--ok-soft)']
    : relevance >= 0.6
      ? ['var(--info)', 'var(--info-soft)']
      : ['var(--faint)', 'var(--hover)'];

  return (
    <div className="px-2 py-1.5 rounded-[10px] border border-[var(--line)] bg-[var(--card)] flex flex-col gap-0.5">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <p className="cn-text-body1 text-[12.5px] font-semibold text-[var(--ink)]">
          {item.title || item.sourcePath || 'Document'}
        </p>
        <Chip
          label={`${relevancePct}%`}
          size="small"
          sx={{
            height: 18, fontSize: '10.5px', fontWeight: 700,
            bgcolor: relevanceBg,
            color: relevanceColor,
            fontVariantNumeric: 'tabular-nums',
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      </div>
      {item.snippet && (
        <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] leading-[1.5]">
          {item.snippet}
        </p>
      )}
      {item.sourcePath && (
        <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] italic">
          {item.sourcePath}
        </p>
      )}
    </div>
  );
};
