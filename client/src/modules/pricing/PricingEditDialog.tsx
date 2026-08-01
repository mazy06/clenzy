import React, { useState } from 'react';
import { Button, Spinner } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  FieldError,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PricingEditDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (price: number) => Promise<void>;
  selectedDates: string[];
  loading: boolean;
  currency?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return '';
  if (dates.length === 1) return dates[0];

  const sorted = [...dates].sort();
  return `${sorted[0]} - ${sorted[sorted.length - 1]}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PricingEditDialog: React.FC<PricingEditDialogProps> = ({
  open,
  onClose,
  onApply,
  selectedDates,
  loading,
  currency = 'EUR',
}) => {
  const { t } = useTranslation();
  const [price, setPrice] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleApply = async () => {
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setError(t('common.error'));
      return;
    }
    setError('');
    await onApply(numericPrice);
    setPrice('');
    onClose();
  };

  const handleClose = () => {
    setPrice('');
    setError('');
    onClose();
  };

  return (
    // maxWidth="xs" MUI = 444 px.
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="sm:max-w-[444px]">
        <DialogHeader>
          <DialogTitle>{t('dynamicPricing.calendar.editPrice')}</DialogTitle>
        </DialogHeader>
        <div className="pt-1.5 flex flex-col gap-3">
          <p className="cn-text-body2 text-muted-foreground">
            {formatDateRange(selectedDates)}
            {selectedDates.length > 1 && (
              <span className="cn-text-body2 text-muted-foreground ms-1.5">
                ({selectedDates.length} {t('common.date')}s)
              </span>
            )}
          </p>

          <Field>
            <FieldLabel htmlFor="pricing-price-per-night">
              {t('dynamicPricing.calendar.pricePerNight')}
            </FieldLabel>
            <InputGroup className="w-full">
              <InputGroupInput
                id="pricing-price-per-night"
                type="number"
                min={0}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                autoFocus
                aria-invalid={!!error}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText className="text-muted-foreground">{currency}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            {error && <FieldError>{error}</FieldError>}
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleApply} disabled={loading || !price}>
            {loading && <Spinner className="size-4" />}
            {t('dynamicPricing.calendar.applyRange')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PricingEditDialog;
