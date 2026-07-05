import React, { useCallback, useMemo } from 'react';
import { Box, Typography, TextField, IconButton, Chip } from '@mui/material';
import { Add, Close, Receipt } from '../../icons';
import type { QuoteLine } from '../../schemas/serviceRequestSchema';
import { useCurrency } from '../../hooks/useCurrency';

// ─── Devis structuré (maintenance) ──────────────────────────────────────────
//
// Éditeur de lignes de devis : chaque ligne = désignation + quantité + prix
// unitaire, total de ligne = quantité × PU. Le total du devis alimente le
// montant estimé de la demande (recalculé côté serveur). Les montants sont
// saisis en euros (devise de référence des tarifs).

interface ServiceRequestQuoteEditorProps {
  value: QuoteLine[];
  onChange: (lines: QuoteLine[]) => void;
  disabled?: boolean;
}

/** Raccourcis de désignation les plus courants pour une intervention technique. */
const PRESETS = ['Main d’œuvre', 'Pièces / matériel', 'Déplacement'];

function lineTotal(line: QuoteLine): number {
  const q = Number.isFinite(line.quantity) ? line.quantity : 0;
  const pu = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
  return q * pu;
}

const NUM_INPUT_SX = {
  '& .MuiOutlinedInput-root': {
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
    bgcolor: 'var(--card)',
  },
  '& input': { textAlign: 'right' as const, py: '7px' },
  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
    WebkitAppearance: 'none',
    margin: 0,
  },
  '& input[type=number]': { MozAppearance: 'textfield' },
};

const ServiceRequestQuoteEditor: React.FC<ServiceRequestQuoteEditorProps> = React.memo(
  ({ value, onChange, disabled = false }) => {
    const { convertAndFormat } = useCurrency();

    const total = useMemo(
      () => value.reduce((sum, line) => sum + lineTotal(line), 0),
      [value],
    );

    const updateLine = useCallback(
      (index: number, patch: Partial<QuoteLine>) => {
        onChange(value.map((line, i) => (i === index ? { ...line, ...patch } : line)));
      },
      [value, onChange],
    );

    const removeLine = useCallback(
      (index: number) => {
        onChange(value.filter((_, i) => i !== index));
      },
      [value, onChange],
    );

    const addLine = useCallback(
      (label = '') => {
        onChange([...value, { label, quantity: 1, unitPrice: 0 }]);
      },
      [value, onChange],
    );

    return (
      <Box
        sx={{
          border: '1px solid var(--line)',
          borderRadius: '11px',
          bgcolor: 'var(--field)',
          p: 1.5,
        }}
      >
        {/* En-tête : titre + total */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}>
              <Receipt size={16} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)' }}>
              Devis
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Typography sx={{ fontSize: '10px', fontWeight: 600, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Total estimé
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {convertAndFormat(total, 'EUR')}
            </Typography>
          </Box>
        </Box>

        {/* Lignes */}
        {value.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
            {/* En-têtes de colonnes */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 56px 88px 84px 28px',
                gap: 0.75,
                px: 0.25,
              }}
            >
              {['Désignation', 'Qté', 'PU (€)', 'Total', ''].map((h, i) => (
                <Typography
                  key={i}
                  sx={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '.04em',
                    color: 'var(--faint)',
                    textAlign: i === 0 ? 'left' : i === 4 ? 'center' : 'right',
                  }}
                >
                  {h}
                </Typography>
              ))}
            </Box>

            {value.map((line, index) => (
              <Box
                key={index}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 56px 88px 84px 28px',
                  gap: 0.75,
                  alignItems: 'center',
                }}
              >
                <TextField
                  value={line.label}
                  onChange={(e) => updateLine(index, { label: e.target.value })}
                  placeholder="Désignation…"
                  disabled={disabled}
                  size="small"
                  sx={{ '& .MuiOutlinedInput-root': { fontSize: '12px', bgcolor: 'var(--card)' }, '& input': { py: '7px' } }}
                />
                <TextField
                  value={Number.isFinite(line.quantity) ? line.quantity : ''}
                  onChange={(e) => updateLine(index, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
                  type="number"
                  inputProps={{ min: 0, step: 0.5 }}
                  disabled={disabled}
                  size="small"
                  sx={NUM_INPUT_SX}
                />
                <TextField
                  value={Number.isFinite(line.unitPrice) ? line.unitPrice : ''}
                  onChange={(e) => updateLine(index, { unitPrice: e.target.value === '' ? 0 : Number(e.target.value) })}
                  type="number"
                  inputProps={{ min: 0, step: 1 }}
                  disabled={disabled}
                  size="small"
                  sx={NUM_INPUT_SX}
                />
                <Typography
                  sx={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--ink)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    pr: 0.25,
                  }}
                >
                  {convertAndFormat(lineTotal(line), 'EUR')}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => removeLine(index)}
                  disabled={disabled}
                  sx={{ p: 0.25, color: 'var(--faint)', '&:hover': { color: 'var(--err)' } }}
                  aria-label="Supprimer la ligne"
                >
                  <Close size={14} strokeWidth={1.75} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {/* Ajouts : raccourcis + ligne vierge */}
        {!disabled && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip
              icon={<Add size={14} strokeWidth={1.75} />}
              label="Ligne"
              onClick={() => addLine()}
              size="small"
              sx={{
                height: 26,
                fontSize: '11.5px',
                fontWeight: 600,
                color: 'var(--accent)',
                border: '1px solid var(--accent)',
                bgcolor: 'var(--accent-soft)',
                '& .MuiChip-icon': { fontSize: 14, ml: 0.5, color: 'var(--accent)' },
                '&:hover': { bgcolor: 'var(--accent-soft)' },
                cursor: 'pointer',
              }}
            />
            {PRESETS.map((preset) => (
              <Chip
                key={preset}
                label={preset}
                onClick={() => addLine(preset)}
                size="small"
                variant="outlined"
                sx={{
                  height: 26,
                  fontSize: '11.5px',
                  fontWeight: 500,
                  color: 'var(--muted)',
                  borderColor: 'var(--line-2)',
                  bgcolor: 'var(--card)',
                  '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)', bgcolor: 'var(--hover)' },
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>
        )}

        {value.length === 0 && disabled && (
          <Typography sx={{ fontSize: '11.5px', color: 'var(--faint)', fontStyle: 'italic' }}>
            Aucune ligne de devis
          </Typography>
        )}
      </Box>
    );
  },
);

ServiceRequestQuoteEditor.displayName = 'ServiceRequestQuoteEditor';

export default ServiceRequestQuoteEditor;
