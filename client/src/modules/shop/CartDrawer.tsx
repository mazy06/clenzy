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
  CheckCircleOutline,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { SHOP_PRODUCTS } from './shopProducts';
import ProductHero from './ProductHero';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: Map<string, number>;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const { t } = useTranslation();
  const { convertAndFormat } = useCurrency();

  const formatPrice = (cents: number) => convertAndFormat(cents / 100, 'EUR');

  const cartItems = Array.from(cart.entries())
    .map(([id, qty]) => {
      const product = SHOP_PRODUCTS.find((p) => p.id === id);
      return product ? { product, quantity: qty } : null;
    })
    .filter(Boolean) as { product: (typeof SHOP_PRODUCTS)[number]; quantity: number }[];

  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const isEmpty = cartItems.length === 0;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 420 }, maxWidth: '100vw' },
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight={600} sx={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', letterSpacing: '-0.01em', color: 'var(--ink)' }}>
              {t('shop.cart')}
            </Typography>
            {totalItems > 0 && (
              <Box
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  px: 0.875,
                  py: 0.125,
                  borderRadius: '5px',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.02em',
                }}
              >
                {totalItems}
              </Box>
            )}
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="Fermer"
            sx={{
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <Close size={18} strokeWidth={1.75} />
          </IconButton>
        </Box>

        {/* Cart items */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
          {isEmpty ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  mx: 'auto',
                  mb: 2,
                  borderRadius: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                <ShoppingCartOutlined size={28} strokeWidth={1.5} />
              </Box>
              <Typography fontWeight={600} sx={{ fontSize: '0.95rem', mb: 0.5 }}>
                {t('shop.cartEmpty')}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  color: 'text.secondary',
                  lineHeight: 1.5,
                  maxWidth: 240,
                  mx: 'auto',
                }}
              >
                {t('shop.cartEmptyDesc')}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {cartItems.map(({ product, quantity }) => (
                <Box
                  key={product.id}
                  sx={{
                    display: 'flex',
                    gap: 1.25,
                    p: 1,
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'border-color 0.18s cubic-bezier(.16,1,.3,1)',
                    '&:hover': { borderColor: 'var(--line-2)' },
                  }}
                >
                  {/* Thumbnail */}
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <ProductHero product={product} height={62} />
                  </Box>

                  {/* Info + controls */}
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          fontWeight={600}
                          sx={{
                            fontSize: '0.82rem',
                            lineHeight: 1.25,
                            color: 'text.primary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={product.name}
                        >
                          {product.name}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.6875rem',
                            color: 'text.disabled',
                            letterSpacing: '0.04em',
                            fontVariantNumeric: 'tabular-nums',
                            textTransform: 'uppercase',
                          }}
                        >
                          {product.sku}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => onRemoveItem(product.id)}
                        aria-label="Retirer du panier"
                        sx={{
                          color: 'text.disabled',
                          p: 0.25,
                          '&:hover': { color: 'var(--err)', backgroundColor: 'var(--err-soft)' },
                        }}
                      >
                        <Delete size={14} strokeWidth={1.75} />
                      </IconButton>
                    </Box>

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mt: 'auto',
                        pt: 0.5,
                      }}
                    >
                      {/* Quantity controls */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => onUpdateQuantity(product.id, -1)}
                          aria-label="Diminuer"
                          sx={{
                            width: 24,
                            height: 24,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: '6px',
                            color: 'text.primary',
                            '&:hover': { borderColor: 'var(--faint)', backgroundColor: 'var(--hover)' },
                          }}
                        >
                          <Remove size={12} strokeWidth={2} />
                        </IconButton>
                        <Typography
                          fontWeight={700}
                          sx={{
                            minWidth: 22,
                            textAlign: 'center',
                            fontSize: '0.78rem',
                            color: 'text.primary',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {quantity}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => onUpdateQuantity(product.id, 1)}
                          aria-label="Augmenter"
                          sx={{
                            width: 24,
                            height: 24,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: '6px',
                            color: 'text.primary',
                            '&:hover': { borderColor: 'var(--faint)', backgroundColor: 'var(--hover)' },
                          }}
                        >
                          <Add size={12} strokeWidth={2} />
                        </IconButton>
                      </Box>

                      {/* Line total */}
                      <Typography
                        fontWeight={700}
                        sx={{
                          fontSize: '0.85rem',
                          color: 'text.primary',
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {formatPrice(product.price * quantity)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Footer */}
        {!isEmpty && (
          <Box
            sx={{
              borderTop: '1px solid',
              borderColor: 'divider',
              px: 2.5,
              py: 2,
              backgroundColor: 'background.paper',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                {t('shop.subtotal')}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'text.primary',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatPrice(subtotal)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.25 }}>
              <Box sx={{ color: 'var(--ok)', display: 'inline-flex' }}>
                <CheckCircleOutline size={12} strokeWidth={2} />
              </Box>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                {t('shop.shipping')}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: '0.66rem',
                color: 'text.disabled',
                display: 'block',
                mb: 1.5,
                ml: 2.25,
              }}
            >
              {t('shop.shippingIntl')}
            </Typography>

            <Divider sx={{ mb: 1.25, borderColor: 'divider' }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 2 }}>
              <Typography fontWeight={700} sx={{ fontSize: '0.95rem' }}>
                {t('shop.total')}
              </Typography>
              <Typography
                fontWeight={600}
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.15rem',
                  color: 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.01em',
                }}
              >
                {formatPrice(subtotal)}
              </Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={onCheckout}
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
