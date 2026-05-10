import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Badge,
  Alert,
  Snackbar,
} from '@mui/material';
import { ShoppingCartOutlined, Memory } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import { SHOP_PRODUCTS, CATEGORIES } from './shopProducts';
import type { ProductCategory } from './shopProducts';
import ProductCard from './ProductCard';
import CartDrawer from './CartDrawer';

// ─── Component ───────────────────────────────────────────────────────────────

const ShopPage: React.FC = () => {
  const { t } = useTranslation();

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory>('all');

  // Cart: productId → quantity
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const cartCount = useMemo(
    () => Array.from(cart.values()).reduce((sum, qty) => sum + qty, 0),
    [cart],
  );

  // Filter products: kits first, then individual
  const filteredProducts = useMemo(() => {
    const filtered =
      selectedCategory === 'all'
        ? SHOP_PRODUCTS
        : SHOP_PRODUCTS.filter((p) => p.category === selectedCategory);

    const kits = filtered.filter((p) => p.category === 'kit');
    const others = filtered.filter((p) => p.category !== 'kit');
    return [...kits, ...others];
  }, [selectedCategory]);

  // Cart actions
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

  // Category translation keys
  const categoryTranslationKeys: Record<string, string> = {
    all: 'shop.allProducts',
    kit: 'shop.kits',
    noise: 'shop.noiseMonitoring',
    lock: 'shop.locks',
    environment: 'shop.environment',
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Page header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Memory size={24} strokeWidth={1.75} color='#4A9B8E' />
            <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
              {t('shop.title')}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
            {t('shop.subtitle')}
          </Typography>
        </Box>

        {/* Cart icon */}
        <IconButton
          onClick={() => setDrawerOpen(true)}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            p: 1,
          }}
        >
          <Badge
            badgeContent={cartCount}
            color="primary"
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.6875rem',
                height: 18,
                minWidth: 18,
                fontWeight: 700,
              },
            }}
          >
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.primary' }}><ShoppingCartOutlined size={22} strokeWidth={1.75} /></Box>
          </Badge>
        </IconButton>
      </Box>

      {/* Info banner */}
      <Alert
        severity="info"
        sx={{
          mb: 3,
          '& .MuiAlert-message': { fontSize: '0.8125rem' },
          borderRadius: 1.5,
        }}
      >
        {t('shop.infoBanner')}
      </Alert>

      {/* Category filter chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat.id}
            label={t(categoryTranslationKeys[cat.id]) || cat.label}
            onClick={() => setSelectedCategory(cat.id as 'all' | ProductCategory)}
            variant={selectedCategory === cat.id ? 'filled' : 'outlined'}
            sx={{
              fontWeight: 600,
              fontSize: '0.8125rem',
              ...(selectedCategory === cat.id
                ? {
                    bgcolor: '#6B8A9A',
                    color: '#fff',
                    '&:hover': { bgcolor: '#6B8A9A', filter: 'brightness(0.9)' },
                  }
                : {
                    borderColor: 'divider',
                    '&:hover': { borderColor: '#6B8A9A', backgroundColor: '#6B8A9A08' },
                  }),
            }}
          />
        ))}
      </Box>

      {/* Product grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
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

      {/* Cart drawer */}
      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />

      {/* Snackbar confirmation */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {t('common.processing')}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ShopPage;
