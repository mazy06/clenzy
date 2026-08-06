import React from 'react';
import StatusChip from '../../../components/StatusChip';


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
        <div className="p-3 rounded-xl border border-border bg-card text-center">
          <p className="text-xs text-muted-foreground">
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
        <p className="block mb-1 text-2xs font-bold uppercase tracking-[.05em] text-faint">
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
    ? ['var(--color-success-ink)', 'var(--color-success-soft)']
    : relevance >= 0.6
      ? ['var(--color-info-ink)', 'var(--color-info-soft)']
      : ['var(--color-faint)', 'var(--color-accent)'];

  return (
    <div className="px-2 py-1.5 rounded-lg border border-border bg-card flex flex-col gap-0.5">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <p className="text-xs font-semibold text-foreground">
          {item.title || item.sourcePath || 'Document'}
        </p>
        <StatusChip size="sm" tokens={{ color: relevanceColor, bg: relevanceBg }} label={`${relevancePct}%`} className="text-2xs tabular-nums" />
      </div>
      {item.snippet && (
        <p className="text-xs text-muted-foreground leading-[1.5]">
          {item.snippet}
        </p>
      )}
      {item.sourcePath && (
        <p className="text-2xs text-faint italic">
          {item.sourcePath}
        </p>
      )}
    </div>
  );
};
