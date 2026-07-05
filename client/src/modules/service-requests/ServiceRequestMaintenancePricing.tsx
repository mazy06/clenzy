import React, { useCallback } from 'react';
import { Box, Typography, TextField, Chip } from '@mui/material';
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
      <Box>
        <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', mb: 1 }}>
          Chiffrage
        </Typography>

        {/* Sélecteur de mode */}
        <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
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
        </Box>

        {/* Contenu selon le mode */}
        {pricingMode === 'DIAGNOSTIC' ? (
          <Box
            sx={{
              border: '1px solid var(--line)',
              borderRadius: '11px',
              bgcolor: 'var(--field)',
              p: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Box>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.04em', mb: 0.5 }}>
                  Montant du diagnostic (€)
                </Typography>
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
              </Box>
              <Typography sx={{ flex: 1, minWidth: 180, fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.4 }}>
                L'artisan facture d'abord ce diagnostic pour évaluer sur place, puis
                établit le devis après la visite. Optionnel — laisse vide pour chiffrer plus tard.
              </Typography>
            </Box>
          </Box>
        ) : (
          <ServiceRequestQuoteEditor value={quoteLines} onChange={handleQuoteChange} disabled={disabled} />
        )}
      </Box>
    );
  },
);

ServiceRequestMaintenancePricing.displayName = 'ServiceRequestMaintenancePricing';

export default ServiceRequestMaintenancePricing;
