import React from 'react';
import { Spinner } from '../../../components/ui';
import { Box, Checkbox, Button, Divider, Chip, Alert } from '@mui/material';
import {
  ShoppingCart,
  Payment,
  CheckCircle,
} from '../../../icons';
import type { UsePanelPaymentReturn } from './usePanelPayment';
import { Money } from '../../../components/Money';

interface PanelPaymentCartProps {
  payment: UsePanelPaymentReturn;
}

const PanelPaymentCart: React.FC<PanelPaymentCartProps> = ({ payment }) => {
  const {
    cartItems,
    toggleCartItem,
    selectAll,
    deselectAll,
    selectedTotal,
    selectedIds,
    paying,
    paymentError,
    paymentSuccess,
    initiatePayment,
  } = payment;

  if (cartItems.length === 0) {
    return (
      <div className="py-1.5">
        <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground italic">
          Aucune intervention en attente de paiement
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-0.5">
          <span className="inline-flex text-primary"><ShoppingCart size={16} strokeWidth={1.75} /></span>
          <p className="cn-text-body1 text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            Panier ({cartItems.length})
          </p>
        </div>
        <div className="flex gap-0.5">
          <Button size="small" onClick={selectAll} sx={{ fontSize: '0.5625rem', textTransform: 'none', minWidth: 0, p: '2px 6px' }}>
            Tout
          </Button>
          <Button size="small" onClick={deselectAll} sx={{ fontSize: '0.5625rem', textTransform: 'none', minWidth: 0, p: '2px 6px' }}>
            Aucun
          </Button>
        </div>
      </div>

      {/* Cart items */}
      <div className="flex flex-col gap-0.5 mb-2">
        {cartItems.map((item) => (
          <Box
            key={item.interventionId}
            onClick={() => toggleCartItem(item.interventionId)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              p: 0.75,
              border: '1px solid',
              borderColor: item.selected ? 'primary.main' : 'divider',
              borderRadius: 1,
              cursor: 'pointer',
              backgroundColor: item.selected ? 'action.selected' : 'transparent',
              '&:hover': { backgroundColor: 'action.hover' },
            }}
          >
            <Checkbox
              checked={item.selected}
              size="small"
              sx={{ p: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              onChange={() => toggleCartItem(item.interventionId)}
            />
            <div className="flex-1 min-w-0">
              <p className="cn-text-body1 text-[0.6875rem] font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                {item.title}
              </p>
            </div>
            <p className="cn-text-body1 text-[0.75rem] font-bold">
              <Money value={item.cost} decimals={0} />
            </p>
          </Box>
        ))}
      </div>

      <Divider sx={{ mb: 1.5 }} />

      {/* Total */}
      <div className="flex justify-between items-center mb-2">
        <p className="cn-text-body1 text-[0.75rem] font-semibold">Total sélectionné</p>
        <p className="cn-text-body1 text-[1rem] font-bold text-primary">
          <Money value={selectedTotal} />
        </p>
      </div>

      {/* Errors / Success */}
      {paymentError && (
        <Alert severity="error" sx={{ fontSize: '0.6875rem', mb: 1 }}>{paymentError}</Alert>
      )}
      {paymentSuccess && (
        <Alert severity="success" icon={<CheckCircle size={18} strokeWidth={1.75} />} sx={{ fontSize: '0.6875rem', mb: 1 }}>
          Paiement effectué avec succès !
        </Alert>
      )}

      {/* Pay button */}
      <Button
        variant="contained"
        fullWidth
        size="small"
        startIcon={paying ? <Spinner className="size-3.5" /> : <Payment size={16} strokeWidth={1.75} />}
        onClick={initiatePayment}
        disabled={paying || selectedIds.length === 0}
        sx={{ textTransform: 'none', fontSize: '0.75rem' }}
      >
        {paying ? 'Paiement en cours...' : <>Payer <Money value={selectedTotal} /></>}
      </Button>
    </div>
  );
};

export default PanelPaymentCart;
