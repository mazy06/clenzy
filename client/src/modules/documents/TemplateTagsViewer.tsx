import React, { useMemo } from 'react';
import {
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Box,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { DocumentTemplateTag } from '../../services/api/documentsApi';

interface TemplateTagsViewerProps {
  tags: DocumentTemplateTag[];
}

const CATEGORY_COLORS: Record<string, string> = {
  CLIENT: '#3b82f6',
  PROPERTY: '#10b981',
  INTERVENTION: '#f59e0b',
  DEVIS: '#8b5cf6',
  FACTURE: '#ef4444',
  PAIEMENT: '#ec4899',
  ENTREPRISE: '#6366f1',
  SYSTEM: '#6b7280',
};

const CATEGORY_LABELS: Record<string, string> = {
  CLIENT: 'Client',
  PROPERTY: 'Bien immobilier',
  INTERVENTION: 'Intervention',
  DEVIS: 'Devis',
  FACTURE: 'Facture',
  PAIEMENT: 'Paiement',
  ENTREPRISE: 'Entreprise',
  SYSTEM: 'Système',
};

const TYPE_LABELS: Record<string, string> = {
  SIMPLE: 'Texte',
  LIST: 'Liste',
  CONDITIONAL: 'Conditionnel',
  DATE: 'Date',
  MONEY: 'Montant',
  IMAGE: 'Image',
};

const TemplateTagsViewer: React.FC<TemplateTagsViewerProps> = ({ tags }) => {
  const groupedTags = useMemo(() => {
    const groups: Record<string, DocumentTemplateTag[]> = {};
    for (const tag of tags) {
      const cat = tag.tagCategory || 'SYSTEM';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tag);
    }
    return groups;
  }, [tags]);

  const categories = Object.keys(groupedTags).sort();

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Tags détectés</Typography>
        <Chip label={`${tags.length} tags`} size="small" color="info" />
      </Box>

      {categories.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          Aucun tag détecté dans ce template
        </Typography>
      ) : (
        categories.map((cat) => (
          <Accordion key={cat} defaultExpanded={categories.length <= 4}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{
                  width: 12, height: 12, borderRadius: '50%',
                  bgcolor: CATEGORY_COLORS[cat] || '#6b7280',
                }} />
                <Typography fontWeight={500}>
                  {CATEGORY_LABELS[cat] || cat}
                </Typography>
                <Chip label={groupedTags[cat].length} size="small" sx={{ ml: 1 }} />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Table size="small">
                <TableBody>
                  {groupedTags[cat].map((tag) => (
                    <TableRow key={tag.id ?? `${cat}-${tag.tagName}`}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: CATEGORY_COLORS[cat] || '#6b7280' }}>
                        {'${' + tag.tagName + '}'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={TYPE_LABELS[tag.tagType] || tag.tagType}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        {tag.required && (
                          <Chip label="Requis" size="small" color="warning" sx={{ fontSize: '0.7rem' }} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
        ))
      )}
    </Paper>
  );
};

export default TemplateTagsViewer;
