import React, { useState } from 'react';
import { Box, Typography, IconButton, Checkbox } from '@mui/material';
import { Remove, Add, ChevronRight } from '../../../icons';
import type { ResolvedTokens } from '../types/bookingEngine';
import { fmt } from '../types/bookingEngine';
import type { BookingI18n } from '../sdk/i18n';
import type { BookingServiceCategory, SelectedServiceOption } from '../../../services/api/bookingServiceOptionsApi';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BookingServiceOptionsSectionProps {
  tk: ResolvedTokens;
  i18n: BookingI18n;
  categories: BookingServiceCategory[];
  selectedOptions: SelectedServiceOption[];
  onOptionChange: (options: SelectedServiceOption[]) => void;
  adults: number;
  children: number;
  nights: number;
  defaultCurrency: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getQuantity(options: SelectedServiceOption[], itemId: number): number {
  return options.find(o => o.serviceItemId === itemId)?.quantity ?? 0;
}

function setQuantity(options: SelectedServiceOption[], itemId: number, qty: number): SelectedServiceOption[] {
  const filtered = options.filter(o => o.serviceItemId !== itemId);
  return qty > 0 ? [...filtered, { serviceItemId: itemId, quantity: qty }] : filtered;
}

function computeItemPrice(
  unitPrice: number, quantity: number, pricingMode: string,
  adults: number, children: number, nights: number,
): number {
  switch (pricingMode) {
    case 'PER_PERSON': return unitPrice * quantity * (adults + children);
    case 'PER_NIGHT': return unitPrice * quantity * nights;
    default: return unitPrice * quantity;
  }
}

function pricingLabel(pricingMode: string, i18n: BookingI18n): string {
  switch (pricingMode) {
    case 'PER_PERSON': return i18n.t('cart.perPerson');
    case 'PER_NIGHT': return i18n.t('cart.perNight');
    default: return i18n.t('cart.perBooking');
  }
}

// ─── Section Accordion (local) ──────────────────────────────────────────────

const CategoryAccordion: React.FC<{
  title: string; children: React.ReactNode; defaultOpen?: boolean; tk: ResolvedTokens;
}> = ({ title, children, defaultOpen = true, tk }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ borderBottom: `1px solid ${tk.border}` }}>
      <Box onClick={() => setOpen(!open)} sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2, cursor: 'pointer',
      }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: tk.text, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {title}
        </Typography>
        <Box component="span" sx={{ display: 'inline-flex', color: tk.textLabel, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}><ChevronRight size={18} strokeWidth={1.75} /></Box>
      </Box>
      {open && <Box sx={{ pb: 2 }}>{children}</Box>}
    </Box>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

const BookingServiceOptionsSection: React.FC<BookingServiceOptionsSectionProps> = ({
  tk, i18n, categories, selectedOptions, onOptionChange,
  adults, children, nights, defaultCurrency,
}) => {
  if (categories.length === 0) return null;

  return (
    <>
      {categories.map(cat => (
        <CategoryAccordion key={cat.id} title={cat.name} tk={tk}>
          {cat.description && (
            <Typography sx={{ fontSize: 12, color: tk.textLabel, mb: 1.5 }}>{cat.description}</Typography>
          )}
          {cat.items.map(item => {
            const qty = getQuantity(selectedOptions, item.id);
            const price = computeItemPrice(item.price, Math.max(qty, 1), item.pricingMode, adults, children, nights);

            return (
              <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, borderBottom: `1px solid ${tk.border}22` }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: tk.text }}>
                    {item.name}
                    {item.mandatory && (
                      <Typography component="span" sx={{ fontSize: 10, color: tk.primary, ml: 0.5, fontWeight: 700 }}>
                        ({i18n.t('cart.mandatory')})
                      </Typography>
                    )}
                  </Typography>
                  {item.description && (
                    <Typography sx={{ fontSize: 11, color: tk.textLabel }}>{item.description}</Typography>
                  )}
                  <Typography sx={{ fontSize: 12, color: tk.primary, fontWeight: 600 }}>
                    {fmt(item.price, defaultCurrency)} / {pricingLabel(item.pricingMode, i18n)}
                  </Typography>
                </Box>

                {/* Price total for this item */}
                {qty > 0 && (
                  <Typography sx={{ fontSize: 14, fontWeight: 300, color: tk.primary, whiteSpace: 'nowrap' }}>
                    {fmt(computeItemPrice(item.price, qty, item.pricingMode, adults, children, nights), defaultCurrency)}
                  </Typography>
                )}

                {/* Input: CHECKBOX or QUANTITY */}
                {item.inputType === 'CHECKBOX' ? (
                  <Checkbox
                    size="small"
                    checked={qty > 0}
                    disabled={item.mandatory}
                    onChange={(e) => onOptionChange(setQuantity(selectedOptions, item.id, e.target.checked ? 1 : 0))}
                    sx={{ color: tk.border, '&.Mui-checked': { color: tk.primary } }}
                  />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => onOptionChange(setQuantity(selectedOptions, item.id, Math.max(item.mandatory ? 1 : 0, qty - 1)))}
                      sx={{ border: `1px solid ${tk.border}`, width: 26, height: 26 }}
                    >
                      <Remove size={14} strokeWidth={1.75} />
                    </IconButton>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, minWidth: 18, textAlign: 'center' }}>{qty}</Typography>
                    <IconButton
                      size="small"
                      onClick={() => onOptionChange(setQuantity(selectedOptions, item.id, Math.min(item.maxQuantity ?? 99, qty + 1)))}
                      sx={{ border: `1px solid ${tk.border}`, width: 26, height: 26 }}
                    >
                      <Add size={14} strokeWidth={1.75} />
                    </IconButton>
                  </Box>
                )}
              </Box>
            );
          })}
        </CategoryAccordion>
      ))}
    </>
  );
};

export default BookingServiceOptionsSection;

// ─── Utility export ─────────────────────────────────────────────────────────

export function computeOptionsTotal(
  categories: BookingServiceCategory[],
  selectedOptions: SelectedServiceOption[],
  adults: number, children: number, nights: number,
): number {
  let total = 0;
  for (const cat of categories) {
    for (const item of cat.items) {
      const qty = getQuantity(selectedOptions, item.id);
      if (qty > 0) {
        total += computeItemPrice(item.price, qty, item.pricingMode, adults, children, nights);
      }
    }
  }
  return total;
}
