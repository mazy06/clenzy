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

interface TemplateTagsViewerProps {
  tags: DocumentTemplateTag[];
}

// ─── Tons sémantiques (tokens Signature — pattern TONES/chipSx) ──────────────

interface Tone { c: string; bg: string }

const TONES: Record<'ok' | 'accent' | 'warn' | 'err' | 'info' | 'muted', Tone> = {
  ok:     { c: 'var(--ok)',     bg: 'var(--ok-soft)' },
  accent: { c: 'var(--accent)', bg: 'var(--accent-soft)' },
  warn:   { c: 'var(--warn)',   bg: 'var(--warn-soft)' },
  err:    { c: 'var(--err)',    bg: 'var(--err-soft)' },
  info:   { c: 'var(--info)',   bg: 'var(--info-soft)' },
  muted:  { c: 'var(--muted)',  bg: 'var(--hover)' },
};

const chipSx = (tone: Tone) => ({ color: tone.c, bgcolor: tone.bg, '& .MuiChip-icon': { color: tone.c } });

// Mapping catégorie → ton sémantique (remplace l'ancienne palette hex Baitly :
// bleu doux → info, teal → ok, warm → warn, rouge doux → err, primary/violet → accent).
const CATEGORY_TONES: Record<string, Tone> = {
  CLIENT: TONES.info,
  PROPERTY: TONES.ok,
  INTERVENTION: TONES.warn,
  DEVIS: TONES.accent,
  FACTURE: TONES.err,
  PAIEMENT: TONES.ok,
  ENTREPRISE: TONES.accent,
  SYSTEM: TONES.muted,
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
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 'var(--radius-lg)', borderColor: 'var(--line)', boxShadow: 'none' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Tags détectés</Typography>
        <Chip label={`${tags.length} tags`} size="small" sx={chipSx(TONES.accent)} />
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
                  bgcolor: (CATEGORY_TONES[cat] ?? TONES.muted).c,
                }} />
                <Typography fontWeight={500}>
                  {CATEGORY_LABELS[cat] || cat}
                </Typography>
                <Chip
                  label={groupedTags[cat].length}
                  size="small"
                  sx={{ ml: 1, ...chipSx(CATEGORY_TONES[cat] ?? TONES.muted) }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Table size="small">
                <TableBody>
                  {groupedTags[cat].map((tag) => (
                    <TableRow key={tag.id ?? `${cat}-${tag.tagName}`}>
                      <TableCell sx={{ fontFamily: '"SF Mono", Menlo, Consolas, monospace', fontSize: '0.85rem', color: (CATEGORY_TONES[cat] ?? TONES.muted).c }}>
                        {'${' + tag.tagName + '}'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={TYPE_LABELS[tag.tagType] || tag.tagType}
                          size="small"
                          sx={chipSx(TONES.muted)}
                        />
                      </TableCell>
                      <TableCell>
                        {tag.required && (
                          <Chip label="Requis" size="small" sx={chipSx(TONES.warn)} />
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
