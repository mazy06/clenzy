import React, { useState } from 'react';
import { Box, Tabs, Tab, CircularProgress } from '@mui/material';
import { Inventory2, LocalLaundryService, Receipt } from '@mui/icons-material';
import { usePropertyInventory } from '../../hooks/usePropertyInventory';
import InventoryItemsSection from './inventory/InventoryItemsSection';
import LaundryItemsSection from './inventory/LaundryItemsSection';
import LaundryQuotesSection from './inventory/LaundryQuotesSection';

interface Props {
  propertyId: number;
  canEdit: boolean;
}

export default function PropertyInventoryTab({ propertyId, canEdit }: Props) {
  const [subTab, setSubTab] = useState(0);

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
      <Tabs
        value={subTab}
        onChange={(_, v) => setSubTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 40,
          mb: 2,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            minHeight: 40,
            py: 0.5,
            fontSize: '0.84rem',
            textTransform: 'none',
          },
        }}
      >
        <Tab
          icon={<Inventory2 sx={{ fontSize: 17 }} />}
          iconPosition="start"
          label="Inventaire du logement"
        />
        <Tab
          icon={<LocalLaundryService sx={{ fontSize: 17 }} />}
          iconPosition="start"
          label="Linge de maison"
        />
        <Tab
          icon={<Receipt sx={{ fontSize: 17 }} />}
          iconPosition="start"
          label="Devis / Factures"
        />
      </Tabs>

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
