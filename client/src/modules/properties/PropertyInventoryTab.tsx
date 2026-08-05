import React from 'react';
import { Spinner } from '../../components/ui';
import { cn } from '../../utils/cn';
import { Inventory2, LocalLaundryService, Receipt } from '../../icons';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { usePropertyInventory } from '../../hooks/usePropertyInventory';
import InventoryItemsSection from './inventory/InventoryItemsSection';
import LaundryItemsSection from './inventory/LaundryItemsSection';
import LaundryQuotesSection from './inventory/LaundryQuotesSection';
import PropertyStockSection from './inventory/PropertyStockSection';

interface Props {
  propertyId: number;
  canEdit: boolean;
}

// Sous-onglet imbrique dans PropertyDetails > Inventaire : persiste dans l'URL via ?subtab=<key>
// (param distinct du ?tab= top-level). Cles : items / laundry / quotes.
const INVENTORY_SUBTABS = [{ key: 'items' }, { key: 'laundry' }, { key: 'quotes' }, { key: 'stock' }];

// Sous-onglets niveau 2 — pattern pilules .s-subtab (fond --field, actif accent-soft/accent).
const subtabs = [
  { label: 'Inventaire du logement', icon: <Inventory2 size={15} strokeWidth={1.75} /> },
  { label: 'Linge de maison', icon: <LocalLaundryService size={15} strokeWidth={1.75} /> },
  { label: 'Devis / Factures', icon: <Receipt size={15} strokeWidth={1.75} /> },
  { label: 'Stock consommable', icon: <Inventory2 size={15} strokeWidth={1.75} /> },
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
      <div className="flex justify-center py-9">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-1.5 mb-3 flex-wrap" role="tablist">
        {subtabs.map((st, i) => {
          const active = subTab === i;
          return (
            <button
              key={st.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(i)}
              className={cn(
                'inline-flex items-center gap-[7px] h-[30px] px-[13px] rounded-full',
                'border border-solid border-transparent',
                'text-xs font-semibold font-[family-name:var(--font-sans)] cursor-pointer',
                'transition-colors duration-150 motion-reduce:transition-none',
                'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
                active
                  ? 'bg-primary-soft text-primary'
                  : 'bg-field text-muted-foreground hover:text-foreground',
              )}
            >
              {st.icon}
              {st.label}
            </button>
          );
        })}
      </div>

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

      {subTab === 3 && (
        <PropertyStockSection propertyId={propertyId} canEdit={canEdit} />
      )}
    </div>
  );
}
