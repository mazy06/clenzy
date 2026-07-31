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
      <div className="border border-[var(--line)] rounded-[11px] bg-[var(--field)] p-2">
        {/* En-tête : titre + total */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <span className="inline-flex text-[var(--accent)]">
              <Receipt size={16} strokeWidth={1.75} />
            </span>
            <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
              Devis
            </p>
          </div>
          <div className="flex items-baseline gap-0.5">
            <p className="cn-text-body1 text-[10px] font-semibold text-[var(--faint)] uppercase tracking-[.04em]">
              Total estimé
            </p>
            <p className="cn-text-body1 font-[var(--font-display)] text-[0.9375rem] font-bold text-[var(--ink)] tabular-nums">
              {convertAndFormat(total, 'EUR')}
            </p>
          </div>
        </div>

        {/* Lignes */}
        {value.length > 0 && (
          <div className="flex flex-col gap-0.5 mb-1.5">
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
                  key={h || 'actions'}
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
                <p className="cn-text-body1 text-[12px] font-semibold text-[var(--ink)] text-end tabular-nums pe-0.5">
                  {convertAndFormat(lineTotal(line), 'EUR')}
                </p>
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
          </div>
        )}

        {/* Ajouts : raccourcis + ligne vierge */}
        {!disabled && (
          <div className="flex items-center gap-1 flex-wrap">
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
          </div>
        )}

        {value.length === 0 && disabled && (
          <p className="cn-text-body1 text-[11.5px] text-[var(--faint)] italic">
            Aucune ligne de devis
          </p>
        )}
      </div>
    );
  },
);

ServiceRequestQuoteEditor.displayName = 'ServiceRequestQuoteEditor';

export default ServiceRequestQuoteEditor;
