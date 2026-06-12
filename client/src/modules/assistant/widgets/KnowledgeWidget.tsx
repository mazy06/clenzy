import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

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
      <Box sx={{ mt: 1, mb: 1.5 }}>
        <Box sx={{
          p: 2, borderRadius: '12px',
          border: '1px solid var(--line)',
          bgcolor: 'var(--card)',
          textAlign: 'center',
        }}>
          <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)' }}>
            Aucun resultat dans la documentation
            {data.query ? ` pour « ${data.query} »` : ''}.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {data.title && (
        <Typography sx={{
          display: 'block', mb: 0.75, fontSize: '10.5px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.05em',
          color: 'var(--faint)',
        }}>
          {data.title}{data.query ? ` · « ${data.query} »` : ''}
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {items.map((item, idx) => (
          <KbCard key={`${item.documentId}-${idx}`} item={item} />
        ))}
      </Box>
    </Box>
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
    <Box
      sx={{
        px: 1.25, py: 1,
        borderRadius: '10px',
        border: '1px solid var(--line)',
        bgcolor: 'var(--card)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{
          fontSize: '12.5px', fontWeight: 600,
          color: 'var(--ink)',
        }}>
          {item.title || item.sourcePath || 'Document'}
        </Typography>
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
      </Box>
      {item.snippet && (
        <Typography sx={{
          fontSize: '11.5px',
          color: 'var(--muted)',
          lineHeight: 1.5,
        }}>
          {item.snippet}
        </Typography>
      )}
      {item.sourcePath && (
        <Typography sx={{
          fontSize: '10.5px',
          color: 'var(--faint)',
          fontStyle: 'italic',
        }}>
          {item.sourcePath}
        </Typography>
      )}
    </Box>
  );
};
