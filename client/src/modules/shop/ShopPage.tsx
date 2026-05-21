import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Badge,
  Alert,
  Snackbar,
} from '@mui/material';
import { ShoppingCartOutlined, Memory, CheckCircleOutline } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import { SHOP_PRODUCTS, CATEGORIES } from './shopProducts';
import type { ProductCategory } from './shopProducts';
import ProductCard from './ProductCard';
import CartDrawer from './CartDrawer';
import PageHeader from '../../components/PageHeader';

const PRIMARY = '#6B8A9A';
const ACCENT = '#4A9B8E';

const ShopPage: React.FC = () => {
  const { t } = useTranslation();

  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory>('all');
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const cartCount = useMemo(
    () => Array.from(cart.values()).reduce((sum, qty) => sum + qty, 0),
    [cart],
  );

  const filteredProducts = useMemo(() => {
    const filtered =
      selectedCategory === 'all'
        ? SHOP_PRODUCTS
        : SHOP_PRODUCTS.filter((p) => p.category === selectedCategory);

    const kits = filtered.filter((p) => p.category === 'kit');
    const others = filtered.filter((p) => p.category !== 'kit');
    return [...kits, ...others];
  }, [selectedCategory]);

  const handleAddToCart = useCallback((productId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.set(productId, (next.get(productId) ?? 0) + 1);
      return next;
    });
  }, []);

  const handleRemoveFromCart = useCallback((productId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const current = next.get(productId) ?? 0;
      if (current <= 1) {
        next.delete(productId);
      } else {
        next.set(productId, current - 1);
      }
      return next;
    });
  }, []);

  const handleUpdateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const current = next.get(productId) ?? 0;
      const newQty = current + delta;
      if (newQty <= 0) {
        next.delete(productId);
      } else {
        next.set(productId, newQty);
      }
      return next;
    });
  }, []);

  const handleRemoveItem = useCallback((productId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  }, []);

  const handleCheckout = useCallback(async () => {
    const items = Array.from(cart.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    try {
      await apiClient.post('/api/shop/checkout', { items });
    } catch {
      // backend not ready yet
    }

    setSnackbarOpen(true);
    setDrawerOpen(false);
  }, [cart]);

  const categoryTranslationKeys: Record<string, string> = {
    all: 'shop.allProducts',
    kit: 'shop.kits',
    noise: 'shop.noiseMonitoring',
    lock: 'shop.locks',
    environment: 'shop.environment',
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: SHOP_PRODUCTS.length,
      kit: 0,
      noise: 0,
      lock: 0,
      environment: 0,
    };
    SHOP_PRODUCTS.forEach((p) => {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    });
    return counts;
  }, []);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title={t('shop.title')}
        subtitle={t('shop.subtitle')}
        iconBadge={<Memory />}
        iconBadgeColor={ACCENT}
        backPath="/dashboard"
        showBackButton={false}
        actions={(
          <IconButton
            onClick={() => setDrawerOpen(true)}
            aria-label={t('shop.cart')}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '10px',
              p: 1,
              transition: 'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1)',
              '&:hover': {
                borderColor: `${PRIMARY}66`,
                backgroundColor: `${PRIMARY}0A`,
              },
            }}
          >
            <Badge
              badgeContent={cartCount}
              color="primary"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.625rem',
                  height: 16,
                  minWidth: 16,
                  fontWeight: 700,
                  bgcolor: ACCENT,
                  border: '2px solid',
                  borderColor: 'background.paper',
                  padding: 0,
                },
              }}
            >
              <Box component="span" sx={{ display: 'inline-flex', color: 'text.primary' }}>
                <ShoppingCartOutlined size={20} strokeWidth={1.75} />
              </Box>
            </Badge>
          </IconButton>
        )}
      />

      {/* Info banner — restrained, no MUI Alert chrome */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.25,
          p: 1.5,
          mb: 2.5,
          borderRadius: '10px',
          border: '1px solid',
          borderColor: `${ACCENT}33`,
          backgroundColor: `${ACCENT}0A`,
        }}
      >
        <Box sx={{ color: ACCENT, display: 'inline-flex', mt: '1px', flexShrink: 0 }}>
          <CheckCircleOutline size={16} strokeWidth={1.75} />
        </Box>
        <Typography
          sx={{
            fontSize: '0.8rem',
            color: 'text.secondary',
            lineHeight: 1.5,
          }}
        >
          {t('shop.infoBanner')}
        </Typography>
      </Box>

      {/* Category filter — pill row */}
      <Box
        sx={{
          display: 'flex',
          gap: 0.625,
          mb: 2.5,
          flexWrap: 'wrap',
        }}
        role="tablist"
      >
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] ?? 0;
          return (
            <Box
              key={cat.id}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              onClick={() => setSelectedCategory(cat.id as 'all' | ProductCategory)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedCategory(cat.id as 'all' | ProductCategory);
                }
              }}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.625,
                cursor: 'pointer',
                userSelect: 'none',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: active ? PRIMARY : 'divider',
                backgroundColor: active ? PRIMARY : 'transparent',
                color: active ? '#fff' : 'text.primary',
                fontSize: '0.78rem',
                fontWeight: 600,
                letterSpacing: '0.01em',
                transition:
                  'border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), color 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                '&:hover': {
                  borderColor: active ? PRIMARY : `${PRIMARY}66`,
                  backgroundColor: active ? PRIMARY : `${PRIMARY}0A`,
                },
                '&:focus-visible': {
                  outline: `2px solid ${PRIMARY}`,
                  outlineOffset: 2,
                },
              }}
            >
              {t(categoryTranslationKeys[cat.id]) || cat.label}
              <Box
                component="span"
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  px: 0.625,
                  py: 0.125,
                  borderRadius: '5px',
                  backgroundColor: active ? 'rgba(255,255,255,0.18)' : `${PRIMARY}14`,
                  color: active ? 'rgba(255,255,255,0.95)' : PRIMARY,
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 16,
                  textAlign: 'center',
                }}
              >
                {count}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Product grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            xl: 'repeat(4, 1fr)',
          },
          gap: 2,
        }}
      >
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            quantity={cart.get(product.id) ?? 0}
            onAddToCart={() => handleAddToCart(product.id)}
            onRemoveFromCart={() => handleRemoveFromCart(product.id)}
          />
        ))}
      </Box>

      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          sx={{ width: '100%', borderRadius: '8px' }}
        >
          {t('common.processing')}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ShopPage;
