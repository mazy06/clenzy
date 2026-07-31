import React, { useMemo, useState, useEffect } from 'react';
import StatusChip, { STATUS_TONES, type ToneTokens } from '../../components/StatusChip';
import { Card } from '../../components/ui';
import { Accordion, AccordionSummary, AccordionDetails, Box, Table, TableBody, TableCell, TableRow } from '@mui/material';
import { ExpandMore } from '../../icons';
import { DocumentTemplateTag } from '../../services/api/documentsApi';

interface TemplateTagsViewerProps {
  tags: DocumentTemplateTag[];
}

// ─── Tons sémantiques (tokens Signature — pattern TONES/chipSx) ──────────────



// Mapping catégorie → ton sémantique (remplace l'ancienne palette hex Baitly :
// bleu doux → info, teal → ok, warm → warn, rouge doux → err, primary/violet → accent).
const CATEGORY_TONES: Record<string, ToneTokens> = {
  CLIENT: STATUS_TONES.info,
  PROPERTY: STATUS_TONES.ok,
  INTERVENTION: STATUS_TONES.warn,
  DEVIS: STATUS_TONES.accent,
  FACTURE: STATUS_TONES.err,
  PAIEMENT: STATUS_TONES.ok,
  ENTREPRISE: STATUS_TONES.accent,
  SYSTEM: STATUS_TONES.neutral,
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
    <Card className="gap-0 py-0 p-3 border-[var(--line)]">
      <div className="flex justify-between items-center mb-3">
        <h6 className="cn-text-h6">Tags détectés</h6>
        <StatusChip tokens={STATUS_TONES.accent} label={`${tags.length} tags`} />
      </div>

      {categories.length === 0 ? (
        <p className="cn-text-body1 text-muted-foreground py-3 text-center">
          Aucun tag détecté dans ce template
        </p>
      ) : (
        categories.map((cat) => (
          <Accordion
            key={cat}
            expanded={expanded === cat}
            onChange={handleChange(cat)}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <div className="flex items-center gap-1.5">
                <Box sx={{
                  width: 12, height: 12, borderRadius: '50%',
                  bgcolor: (CATEGORY_TONES[cat] ?? STATUS_TONES.neutral).color,
                }} />
                <p className="cn-text-body1 font-medium">
                  {CATEGORY_LABELS[cat] || cat}
                </p>
                <StatusChip tokens={CATEGORY_TONES[cat] ?? STATUS_TONES.neutral} label={groupedTags[cat].length} className="ms-1.5" />
              </div>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Table size="small">
                <TableBody>
                  {groupedTags[cat].map((tag) => (
                    <TableRow key={tag.id ?? `${cat}-${tag.tagName}`}>
                      <TableCell sx={{ fontFamily: '"SF Mono", Menlo, Consolas, monospace', fontSize: '0.85rem', color: (CATEGORY_TONES[cat] ?? STATUS_TONES.neutral).color }}>
                        {'${' + tag.tagName + '}'}
                      </TableCell>
                      <TableCell>
                        <StatusChip tokens={STATUS_TONES.neutral} label={TYPE_LABELS[tag.tagType] || tag.tagType} />
                      </TableCell>
                      <TableCell>
                        {tag.required && (
                          <StatusChip tokens={STATUS_TONES.warn} label="Requis" />
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
    </Card>
  );
};

export default TemplateTagsViewer;
