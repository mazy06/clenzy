import React, { useCallback, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { Badge } from '../../components/ui';
import { IconButton } from '@mui/material';
import { Input } from '../../components/ui';
import { Add, Close, Receipt } from '../../icons';
import type { QuoteLine } from '../../schemas/serviceRequestSchema';
import { useCurrency } from '../../hooks/useCurrency';
import StatusChip from '../../components/StatusChip';

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

const TEXT_INPUT_CLASS = 'text-[12px] bg-[var(--card)]';

// Colonnes chiffrees : alignees a droite, chiffres de meme chasse, et sans les
// fleches natives du champ number qui mangeraient la largeur de la colonne.
const NUM_INPUT_CLASS =
  `${TEXT_INPUT_CLASS} text-end tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0`;

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
            <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[0.9375rem] font-bold text-[var(--ink)] tabular-nums">
              {convertAndFormat(total, 'EUR')}
            </p>
          </div>
        </div>

        {/* Lignes */}
        {value.length > 0 && (
          <div className="flex flex-col gap-0.5 mb-1.5">
            {/* En-têtes de colonnes */}
            <div className="grid grid-cols-[1fr_56px_88px_84px_28px] gap-[4.5px] px-[1.5px]">
              {['Désignation', 'Qté', 'PU (€)', 'Total', ''].map((h, i) => (
                <p className={cn('cn-text-body1 text-[9.5px] font-bold uppercase tracking-[.04em] text-[var(--faint)]', i === 0 ? 'text-start' : i === 4 ? 'text-center' : 'text-end')} key={h || 'actions'}>
                  {h}
                </p>
              ))}
            </div>

            {value.map((line, index) => (
              <div className="grid grid-cols-[1fr_56px_88px_84px_28px] gap-[4.5px] items-center" key={index}>
                {/* Pas de libelle par champ : ce sont des colonnes, l'intitule est
                    en tete de grille — d'ou l'aria-label qui nomme la ligne. */}
                <Input
                  aria-label={`Désignation ligne ${index + 1}`}
                  value={line.label}
                  onChange={(e) => updateLine(index, { label: e.target.value })}
                  placeholder="Désignation…"
                  disabled={disabled}
                  className={TEXT_INPUT_CLASS}
                />
                <Input
                  aria-label={`Quantité ligne ${index + 1}`}
                  value={Number.isFinite(line.quantity) ? line.quantity : ''}
                  onChange={(e) => updateLine(index, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
                  type="number"
                  min={0}
                  step={0.5}
                  disabled={disabled}
                  className={NUM_INPUT_CLASS}
                />
                <Input
                  aria-label={`Prix unitaire ligne ${index + 1}`}
                  value={Number.isFinite(line.unitPrice) ? line.unitPrice : ''}
                  onChange={(e) => updateLine(index, { unitPrice: e.target.value === '' ? 0 : Number(e.target.value) })}
                  type="number"
                  min={0}
                  step={1}
                  disabled={disabled}
                  className={NUM_INPUT_CLASS}
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
              </div>
            ))}
          </div>
        )}

        {/* Ajouts : raccourcis + ligne vierge */}
        {!disabled && (
          <div className="flex items-center gap-1 flex-wrap">
            {/* `border-solid` est indispensable : le gabarit de la primitive pose
                `border-none` (border-STYLE), que `border` (border-WIDTH) ne
                supplante pas — la bordure resterait invisible. */}
            <StatusChip
              tone="accent"
              icon={<Add size={14} strokeWidth={1.75} />}
              label="Ligne"
              onClick={() => addLine()}
              className="h-[26px] text-[11.5px] border border-solid border-[var(--accent)]"
            />
            {PRESETS.map((preset) => (
              <Badge variant="outline" className="h-[26px] text-[11.5px] font-medium text-[var(--muted)] border-[var(--line-2)] bg-[var(--card)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--hover)] cursor-pointer" key={preset} onClick={() => addLine(preset)}>{preset}</Badge>
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
