import React, { useMemo, useState, useEffect } from 'react';
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
import { ExpandMore } from '../../icons';
import { DocumentTemplateTag } from '../../services/api/documentsApi';
import { softChipSx } from '../../utils/statusUtils';

interface TemplateTagsViewerProps {
  tags: DocumentTemplateTag[];
}

// Palette Baitly (alignee sur les accents valides) — primary bleu-gris,
// teal pour propriete/intervention, warm sand pour DEVIS, neutral pour SYSTEM.
const CATEGORY_COLORS: Record<string, string> = {
  CLIENT: '#7BA3C2',       // bleu doux
  PROPERTY: '#4A9B8E',     // teal Baitly
  INTERVENTION: '#D4A574', // warm sand
  DEVIS: '#8b5cf6',        // violet (reste branche pour les docs commerciaux)
  FACTURE: '#C97A7A',      // rouge doux Baitly
  PAIEMENT: '#ec4899',     // pink (documents financiers)
  ENTREPRISE: '#6B8A9A',   // primary Baitly
  SYSTEM: '#8A8378',       // neutral warm-gray Baitly
};

const NEUTRAL = '#8A8378';
const WARM = '#D4A574';
const PRIMARY = '#6B8A9A';

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

  // Comportement single-open : un seul accordeon ouvert a la fois.
  // Par defaut, le premier accordeon (ordre alphabetique) est ouvert.
  // Si l'utilisateur clique sur celui deja ouvert, il se referme (false).
  const [expanded, setExpanded] = useState<string | false>(false);

  useEffect(() => {
    if (categories.length > 0 && expanded === false) {
      setExpanded(categories[0]);
    }
    // Si la categorie ouverte n'existe plus (re-scan), retomber sur la 1ere
    if (typeof expanded === 'string' && !categories.includes(expanded) && categories.length > 0) {
      setExpanded(categories[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.join('|')]);

  const handleChange = (cat: string) => (_e: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? cat : false);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, boxShadow: 'none' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Tags détectés</Typography>
        <Chip label={`${tags.length} tags`} size="small" sx={softChipSx(PRIMARY)} />
      </Box>

      {categories.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          Aucun tag détecté dans ce template
        </Typography>
      ) : (
        categories.map((cat) => (
          <Accordion
            key={cat}
            expanded={expanded === cat}
            onChange={handleChange(cat)}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{
                  width: 12, height: 12, borderRadius: '50%',
                  bgcolor: CATEGORY_COLORS[cat] || '#6b7280',
                }} />
                <Typography fontWeight={500}>
                  {CATEGORY_LABELS[cat] || cat}
                </Typography>
                <Chip
                  label={groupedTags[cat].length}
                  size="small"
                  sx={{ ml: 1, ...softChipSx(CATEGORY_COLORS[cat] || NEUTRAL) }}
                />
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
                          sx={softChipSx(NEUTRAL)}
                        />
                      </TableCell>
                      <TableCell>
                        {tag.required && (
                          <Chip label="Requis" size="small" sx={softChipSx(WARM)} />
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
