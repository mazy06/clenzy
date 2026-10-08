import React from 'react';
import { Button, Skeleton } from '../../components/ui';
import { PROPERTY_ART } from './propertyArtwork';
import { InventoryThumbnail } from './inventory/InventoryThumbnail';
import './propertyTabs.css';
import { useTranslation } from '../../hooks/useTranslation';
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

export default function PropertyInventoryTab({ propertyId, canEdit }: Props) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useTabKeyParam(INVENTORY_SUBTABS, { param: 'subtab' });
  const subtabs = [
    { label: t('inventoryLibrary.inventory'), catalogKey: 'sofa-two' },
    { label: t('inventoryLibrary.laundry'), catalogKey: 'bath-towel' },
    { label: t('inventoryLibrary.quotes'), art: PROPERTY_ART.quotes },
    { label: t('inventoryLibrary.stock'), art: PROPERTY_ART.stock },
  ];

  const {
    inventoryItems, laundryItems, catalog, quotes,
    loadingItems, itemsError, refetchItems, loadingLaundry, loadingQuotes,
    addItem, addItems, updateItem, deleteItem,
    addLaundryItem, updateLaundryItem, deleteLaundryItem,
    generateQuote, confirmQuote,
  } = usePropertyInventory(propertyId);

  const loading = subTab === 0 ? loadingItems : subTab === 1 ? loadingLaundry : subTab === 2 ? loadingQuotes : false;
  return (
    <div className="pdt-nav-layout">
      <nav className="pdt-nav" aria-label={t('inventoryLibrary.inventory')}>
        {subtabs.map((tab,index) => <button key={index} type="button" aria-pressed={subTab === index} onClick={() => setSubTab(index)}>
          {tab.catalogKey ? <InventoryThumbnail name={tab.label} catalogKey={tab.catalogKey} size={32} /> : <img src={tab.art} alt="" />}<span>{tab.label}</span>
        </button>)}
      </nav>
      <div className="pdt-inventory-content">
      {loading && <div className="inventory-loading" role="status" aria-label={t('inventoryLibrary.loading')}>
        {[0, 1, 2].map(key => <Skeleton key={key} className="h-20 w-full" />)}
      </div>}
      {!loading && subTab === 0 && itemsError && <div className="inventory-surface" role="alert">
        <p>{t('inventoryLibrary.loadError')}</p><Button variant="outline" onClick={() => void refetchItems()}>{t('inventoryLibrary.retry')}</Button>
      </div>}

      {!loading && !itemsError && subTab === 0 && (
        <InventoryItemsSection
          key={propertyId}
          items={inventoryItems}
          canEdit={canEdit}
          onAdd={addItem}
          onAddMany={addItems}
          onUpdate={updateItem}
          onDelete={deleteItem}
        />
      )}

      {!loading && subTab === 1 && (
        <LaundryItemsSection
          items={laundryItems}
          catalog={catalog}
          canEdit={canEdit}
          onAdd={addLaundryItem}
          onUpdate={updateLaundryItem}
          onDelete={deleteLaundryItem}
        />
      )}

      {!loading && subTab === 2 && (
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
    </div>
  );
}
