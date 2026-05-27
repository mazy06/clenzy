import React from 'react';
import { Box, Typography, useTheme, alpha, Chip } from '@mui/material';

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
 * <p>Liste de cartes compactes : titre, snippet, source path + chip relevance.
 * Borderless, bg tonal, design aligne aux autres widgets.</p>
 */
export const KnowledgeWidget: React.FC<KnowledgeWidgetProps> = ({ data }) => {
  const theme = useTheme();
  const items = data.items ?? [];

  if (items.length === 0) {
    return (
      <Box sx={{ mt: 1, mb: 1.5 }}>
        <Box sx={{
          p: 2, borderRadius: 2,
          bgcolor: alpha(theme.palette.text.primary, 0.04),
          textAlign: 'center',
        }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
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
        <Typography variant="caption" sx={{
          display: 'block', mb: 0.75, fontSize: '0.7rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: theme.palette.text.secondary,
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
  const theme = useTheme();
  const relevance = item.relevance ?? 0;
  const relevancePct = Math.round(relevance * 100);
  const relevanceColor = relevance >= 0.8
    ? theme.palette.success.main
    : relevance >= 0.6
      ? theme.palette.info.main
      : theme.palette.text.disabled;

  return (
    <Box
      sx={{
        px: 1.25, py: 1,
        borderRadius: 1.5,
        bgcolor: alpha(theme.palette.text.primary, 0.035),
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{
          fontSize: '0.8125rem', fontWeight: 600,
          color: theme.palette.text.primary,
        }}>
          {item.title || item.sourcePath || 'Document'}
        </Typography>
        <Chip
          label={`${relevancePct}%`}
          size="small"
          sx={{
            height: 18, fontSize: '0.65rem', fontWeight: 600,
            bgcolor: alpha(relevanceColor, 0.14),
            color: relevanceColor,
            fontVariantNumeric: 'tabular-nums',
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      </Box>
      {item.snippet && (
        <Typography variant="caption" sx={{
          fontSize: '0.75rem',
          color: theme.palette.text.secondary,
          lineHeight: 1.5,
        }}>
          {item.snippet}
        </Typography>
      )}
      {item.sourcePath && (
        <Typography variant="caption" sx={{
          fontSize: '0.68rem',
          color: theme.palette.text.disabled,
          fontStyle: 'italic',
        }}>
          {item.sourcePath}
        </Typography>
      )}
    </Box>
  );
};
