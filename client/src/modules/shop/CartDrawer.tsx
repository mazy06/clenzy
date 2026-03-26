import React from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  Button,
  Divider,
} from '@mui/material';
import {
  Close,
  Add,
  Remove,
  Delete,
  ShoppingCartOutlined,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { SHOP_PRODUCTS } from './shopProducts';

// ─── Props ───────────────────────────────────────────────────────────────────

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: Map<string, number>;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const { t } = useTranslation();

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

  const cartItems = Array.from(cart.entries())
    .map(([id, qty]) => {
      const product = SHOP_PRODUCTS.find((p) => p.id === id);
      return product ? { product, quantity: qty } : null;
    })
    .filter(Boolean) as { product: (typeof SHOP_PRODUCTS)[number]; quantity: number }[];

  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const isEmpty = cartItems.length === 0;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400 }, maxWidth: '100vw' },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.5,
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>
            {t('shop.cart')}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Cart items */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
          {isEmpty ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <ShoppingCartOutlined sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                {t('shop.cartEmpty')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                {t('shop.cartEmptyDesc')}
              </Typography>
            </Box>
          ) : (
            cartItems.map(({ product, quantity }) => (
              <Box key={product.id} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  {/* Product info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.875rem' }}>
                      {product.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      {formatPrice(product.price)} {t('shop.perUnit')}
                    </Typography>
                  </Box>

                  {/* Quantity controls */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    <IconButton
                      size="small"
                      onClick={() => onUpdateQuantity(product.id, -1)}
                      sx={{ border: '1px solid', borderColor: 'divider', width: 28, height: 28 }}
                    >
                      <Remove sx={{ fontSize: 14 }} />
                    </IconButton>
                    <Typography
                      fontWeight={700}
                      sx={{ minWidth: 20, textAlign: 'center', fontSize: '0.8125rem' }}
                    >
                      {quantity}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => onUpdateQuantity(product.id, 1)}
                      sx={{ border: '1px solid', borderColor: 'divider', width: 28, height: 28 }}
                    >
                      <Add sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>

                  {/* Line total + delete */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                    <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.875rem' }}>
                      {formatPrice(product.price * quantity)}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => onRemoveItem(product.id)}
                      sx={{ color: 'error.main', mt: 0.25, p: 0.25 }}
                    >
                      <Delete sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
                <Divider sx={{ mt: 1.5 }} />
              </Box>
            ))
          )}
        </Box>

        {/* Footer: totals + checkout */}
        {!isEmpty && (
          <Box
            sx={{
              borderTop: '1px solid',
              borderColor: 'divider',
              px: 2.5,
              py: 2,
            }}
          >
            {/* Subtotal */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {t('shop.subtotal')}
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {formatPrice(subtotal)}
              </Typography>
            </Box>

            {/* Shipping info */}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', display: 'block', mb: 0.25 }}>
              {t('shop.shipping')}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.625rem', display: 'block', mb: 1.5 }}>
              {t('shop.shippingIntl')}
            </Typography>

            <Divider sx={{ mb: 1.5 }} />

            {/* Total */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {t('shop.total')}
              </Typography>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#4A9B8E' }}>
                {formatPrice(subtotal)}
              </Typography>
            </Box>

            {/* Checkout button */}
            <Button
              variant="contained"
              fullWidth
              onClick={onCheckout}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                py: 1.2,
                bgcolor: '#4A9B8E',
                '&:hover': { bgcolor: '#4A9B8E', filter: 'brightness(0.9)' },
              }}
            >
              {t('shop.checkout')}
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default CartDrawer;
