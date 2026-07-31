import React, { useCallback } from 'react';
import { TextField, Chip } from '@mui/material';
import { Receipt, Search } from '../../icons';
import type { QuoteLine } from '../../schemas/serviceRequestSchema';
import ServiceRequestQuoteEditor from './ServiceRequestQuoteEditor';

// ─── Chiffrage maintenance ──────────────────────────────────────────────────
//
// Deux modes, tous deux optionnels :
//  • « Devis direct » : l'artisan chiffre directement (devis structuré).
//  • « Diagnostic d'abord » : l'artisan ne peut pas chiffrer sans voir sur place ;
//    il facture d'abord un diagnostic, le devis est élaboré après la visite.

export type PricingMode = 'DIRECT' | 'DIAGNOSTIC';

export interface MaintenancePricingState {
  pricingMode: PricingMode;
  quoteLines: QuoteLine[];
  diagnosticFee?: number;
  /** Montant à régler d'abord (total devis en direct, montant diagnostic sinon). */
  estimatedCost?: number;
}

interface ServiceRequestMaintenancePricingProps {
  pricingMode: PricingMode;
  quoteLines: QuoteLine[];
  diagnosticFee?: number;
  onChange: (next: MaintenancePricingState) => void;
  disabled?: boolean;
}

function quoteTotal(lines: QuoteLine[]): number {
  const raw = lines.reduce(
    (sum, l) => sum + (Number.isFinite(l.quantity) ? l.quantity : 0) * (Number.isFinite(l.unitPrice) ? l.unitPrice : 0),
    0,
  );
  return Math.round(raw * 100) / 100;
}

const MODES: { value: PricingMode; label: string; icon: React.ReactElement }[] = [
  { value: 'DIRECT', label: 'Devis direct', icon: <Receipt size={15} strokeWidth={1.75} /> },
  { value: 'DIAGNOSTIC', label: 'Diagnostic d’abord', icon: <Search size={15} strokeWidth={1.75} /> },
];

const ServiceRequestMaintenancePricing: React.FC<ServiceRequestMaintenancePricingProps> = React.memo(
  ({ pricingMode, quoteLines, diagnosticFee, onChange, disabled = false }) => {
    const handleModeChange = useCallback(
      (mode: PricingMode) => {
        if (mode === pricingMode) return;
        if (mode === 'DIAGNOSTIC') {
          onChange({ pricingMode: 'DIAGNOSTIC', quoteLines: [], diagnosticFee, estimatedCost: diagnosticFee });
        } else {
          onChange({ pricingMode: 'DIRECT', quoteLines, diagnosticFee: undefined, estimatedCost: quoteTotal(quoteLines) });
        }
      },
      [pricingMode, quoteLines, diagnosticFee, onChange],
    );

    const handleQuoteChange = useCallback(
      (lines: QuoteLine[]) => {
        onChange({ pricingMode: 'DIRECT', quoteLines: lines, diagnosticFee: undefined, estimatedCost: quoteTotal(lines) });
      },
      [onChange],
    );

    const handleDiagnosticChange = useCallback(
      (raw: string) => {
        const fee = raw === '' ? undefined : Math.round(Number(raw) * 100) / 100;
        onChange({ pricingMode: 'DIAGNOSTIC', quoteLines: [], diagnosticFee: fee, estimatedCost: fee });
      },
      [onChange],
    );

    return (
      <div>
        <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)] mb-1.5">
          Chiffrage
        </p>

        {/* Sélecteur de mode */}
        <div className="flex gap-1 mb-2 flex-wrap">
          {MODES.map((m) => {
            const isActive = pricingMode === m.value;
            return (
              <Chip
                key={m.value}
                icon={m.icon}
                label={m.label}
                onClick={disabled ? undefined : () => handleModeChange(m.value)}
                disabled={disabled}
                aria-pressed={isActive}
                sx={{
                  height: 30,
                  fontSize: '11.5px',
                  fontWeight: isActive ? 600 : 500,
                  border: '1px solid',
                  borderColor: isActive ? 'var(--accent)' : 'var(--line-2)',
                  bgcolor: isActive ? 'var(--accent-soft)' : 'var(--card)',
                  color: isActive ? 'var(--accent)' : 'var(--body)',
                  '& .MuiChip-icon': { fontSize: 15, ml: 0.5, color: isActive ? 'var(--accent)' : 'var(--muted)' },
                  '& .MuiChip-label': { px: 0.75 },
                  '&:hover': disabled ? {} : { borderColor: 'var(--accent)', bgcolor: isActive ? 'var(--accent-soft)' : 'var(--hover)' },
                  cursor: disabled ? 'default' : 'pointer',
                  transition: 'background-color .15s, border-color .15s, color .15s',
                }}
              />
            );
          })}
        </div>

        {/* Contenu selon le mode */}
        {pricingMode === 'DIAGNOSTIC' ? (
          <div className="border border-[var(--line)] rounded-[11px] bg-[var(--field)] p-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div>
                <p className="cn-text-body1 text-[10px] font-bold text-[var(--faint)] uppercase tracking-[.04em] mb-0.5">
                  Montant du diagnostic (€)
                </p>
                <TextField
                  value={Number.isFinite(diagnosticFee as number) && diagnosticFee !== undefined ? diagnosticFee : ''}
                  onChange={(e) => handleDiagnosticChange(e.target.value)}
                  type="number"
                  inputProps={{ min: 0, step: 1 }}
                  placeholder="0"
                  disabled={disabled}
                  size="small"
                  sx={{
                    width: 130,
                    '& .MuiOutlinedInput-root': { fontSize: '13px', fontVariantNumeric: 'tabular-nums', bgcolor: 'var(--card)' },
                    '& input': { textAlign: 'right' },
                    '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                    '& input[type=number]': { MozAppearance: 'textfield' },
                  }}
                />
              </div>
              <p className="cn-text-body1 flex-1 min-w-[180px] text-[11.5px] text-[var(--muted)] leading-[1.4]">
                L'artisan facture d'abord ce diagnostic pour évaluer sur place, puis
                établit le devis après la visite. Optionnel — laisse vide pour chiffrer plus tard.
              </p>
            </div>
          </div>
        ) : (
          <ServiceRequestQuoteEditor value={quoteLines} onChange={handleQuoteChange} disabled={disabled} />
        )}
      </div>
    );
  },
);

ServiceRequestMaintenancePricing.displayName = 'ServiceRequestMaintenancePricing';

export default ServiceRequestMaintenancePricing;
