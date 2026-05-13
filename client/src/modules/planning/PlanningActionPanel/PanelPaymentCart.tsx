import React from 'react';
import {
  Box,
  Typography,
  Checkbox,
  Button,
  Divider,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ShoppingCart,
  Payment,
  CheckCircle,
} from '../../../icons';
import type { UsePanelPaymentReturn } from './usePanelPayment';
import { useCurrency } from '../../../hooks/useCurrency';

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
  const { currencySymbol } = useCurrency();

  if (cartItems.length === 0) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontStyle: 'italic' }}>
          Aucune intervention en attente de paiement
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><ShoppingCart size={16} strokeWidth={1.75} /></Box>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
            Panier ({cartItems.length})
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button size="small" onClick={selectAll} sx={{ fontSize: '0.5625rem', textTransform: 'none', minWidth: 0, p: '2px 6px' }}>
            Tout
          </Button>
          <Button size="small" onClick={deselectAll} sx={{ fontSize: '0.5625rem', textTransform: 'none', minWidth: 0, p: '2px 6px' }}>
            Aucun
          </Button>
        </Box>
      </Box>

      {/* Cart items */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
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
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.title}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
              {item.cost.toFixed(0)} {currencySymbol}
            </Typography>
          </Box>
        ))}
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      {/* Total */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Total sélectionné</Typography>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'primary.main' }}>
          {selectedTotal.toFixed(2)} {currencySymbol}
        </Typography>
      </Box>

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
        startIcon={paying ? <CircularProgress size={14} color="inherit" /> : <Payment size={16} strokeWidth={1.75} />}
        onClick={initiatePayment}
        disabled={paying || selectedIds.length === 0}
        sx={{ textTransform: 'none', fontSize: '0.75rem' }}
      >
        {paying ? 'Paiement en cours...' : `Payer ${selectedTotal.toFixed(2)} ${currencySymbol}`}
      </Button>
    </Box>
  );
};

export default PanelPaymentCart;
