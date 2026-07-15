import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Inventory2, LocalLaundryService, Receipt } from '../../icons';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { usePropertyInventory } from '../../hooks/usePropertyInventory';
import InventoryItemsSection from './inventory/InventoryItemsSection';
import LaundryItemsSection from './inventory/LaundryItemsSection';
import LaundryQuotesSection from './inventory/LaundryQuotesSection';

interface Props {
  propertyId: number;
  canEdit: boolean;
}

// Sous-onglet imbrique dans PropertyDetails > Inventaire : persiste dans l'URL via ?subtab=<key>
// (param distinct du ?tab= top-level). Cles : items / laundry / quotes.
const INVENTORY_SUBTABS = [{ key: 'items' }, { key: 'laundry' }, { key: 'quotes' }];

// Sous-onglets niveau 2 — pattern pilules .s-subtab (fond --field, actif accent-soft/accent).
const subtabs = [
  { label: 'Inventaire du logement', icon: <Inventory2 size={15} strokeWidth={1.75} /> },
  { label: 'Linge de maison', icon: <LocalLaundryService size={15} strokeWidth={1.75} /> },
  { label: 'Devis / Factures', icon: <Receipt size={15} strokeWidth={1.75} /> },
];

export default function PropertyInventoryTab({ propertyId, canEdit }: Props) {
  const [subTab, setSubTab] = useTabKeyParam(INVENTORY_SUBTABS, { param: 'subtab' });

  const {
    inventoryItems, laundryItems, catalog, quotes,
    isLoading,
    addItem, updateItem, deleteItem,
    addLaundryItem, updateLaundryItem, deleteLaundryItem,
    generateQuote, confirmQuote,
  } = usePropertyInventory(propertyId);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      <Box role="tablist" sx={{ display: 'flex', gap: '6px', mb: 2, flexWrap: 'wrap' }}>
        {subtabs.map((st, i) => {
          const active = subTab === i;
          return (
            <Box
              key={st.label}
              component="button"
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(i)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                height: 30,
                px: '13px',
                borderRadius: 999,
                border: '1px solid transparent',
                bgcolor: active ? 'var(--accent-soft)' : 'var(--field)',
                color: active ? 'var(--accent)' : 'var(--muted)',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                transition: 'background-color .14s, color .14s',
                '&:hover': { color: active ? 'var(--accent)' : 'var(--body)' },
                '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
              }}
            >
              {st.icon}
              {st.label}
            </Box>
          );
        })}
      </Box>

      {subTab === 0 && (
        <InventoryItemsSection
          items={inventoryItems}
          canEdit={canEdit}
          onAdd={addItem}
          onUpdate={updateItem}
          onDelete={deleteItem}
        />
      )}

      {subTab === 1 && (
        <LaundryItemsSection
          items={laundryItems}
          catalog={catalog}
          canEdit={canEdit}
          onAdd={addLaundryItem}
          onUpdate={updateLaundryItem}
          onDelete={deleteLaundryItem}
        />
      )}

      {subTab === 2 && (
        <LaundryQuotesSection
          quotes={quotes}
          hasLaundryItems={laundryItems.length > 0}
          canEdit={canEdit}
          onGenerate={generateQuote}
          onConfirm={confirmQuote}
        />
      )}
    </Box>
  );
}
