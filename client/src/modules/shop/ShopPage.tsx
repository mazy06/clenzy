import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { ShoppingCartOutlined, Memory, CheckCircleOutline } from '../../icons';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import { SHOP_PRODUCTS, CATEGORIES } from './shopProducts';
import type { ProductCategory } from './shopProducts';
import ProductCard from './ProductCard';
import CartDrawer from './CartDrawer';
import PageHeader from '../../components/PageHeader';

const ACCENT = '#4A9B8E'; // teinte du badge icône PageHeader (prop hex requise)

const categoryTranslationKeys: Record<string, string> = {
  all: 'shop.allProducts',
  kit: 'shop.kits',
  noise: 'shop.noiseMonitoring',
  lock: 'shop.locks',
  environment: 'shop.environment',
};

const ShopPage: React.FC = () => {
  const { t } = useTranslation();
  const { notify } = useNotification();

  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory>('all');
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);

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

    notify.success(t('common.processing'));
    setDrawerOpen(false);
  }, [cart, notify, t]);

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
    <div>
      <PageHeader
        title={t('shop.title')}
        subtitle={t('shop.subtitle')}
        iconBadge={<Memory />}
        iconBadgeColor={ACCENT}
        backPath="/dashboard"
        showBackButton={false}
        actions={(
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('shop.cart')}
            className="relative rounded-lg border border-solid border-border transition-colors duration-150 hover:border-primary/40 hover:bg-muted motion-reduce:transition-none"
          >
            <span className="inline-flex text-foreground">
              <ShoppingCartOutlined size={20} strokeWidth={1.75} />
            </span>
            {/* Pastille de compteur : le `Badge` du kit est une puce en flux, pas
                une pastille en surimpression — d'ou le positionnement explicite. */}
            {cartCount > 0 && (
              <span
                aria-hidden
                className="pointer-events-none absolute -top-1 -end-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-solid border-card bg-primary px-[3px] text-2xs font-bold leading-none tabular-nums text-primary-foreground"
              >
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Button>
        )}
      />

      {/* Info banner — primitive `Alert` du kit (variante `info`) */}
      <Alert variant="info" className="mb-[15px]">
        <CheckCircleOutline />
        <AlertDescription>
          {t('shop.infoBanner')}
        </AlertDescription>
      </Alert>

      {/* Category filter — pill row */}
      <div className="flex gap-1 mb-3.5 flex-wrap" role="tablist">
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] ?? 0;
          return (
            // Demi-pas de la grille (4,5 / 7,5 / 3,75 px) : la rangee doit rester
            // plus dense que les puces de filtre standard du kit.
            <div
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
              className={cn(
                'inline-flex items-center gap-[4.5px] px-[7.5px] py-[3.75px] cursor-pointer select-none rounded-md border border-solid text-[0.78rem] font-semibold',
                'transition-colors duration-150 motion-reduce:transition-none',
                'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                active
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted',
              )}
            >
              {t(categoryTranslationKeys[cat.id]) || cat.label}
              <span className={cn('min-w-[16px] rounded-sm px-[3.75px] py-[0.75px] text-center text-2xs font-bold tabular-nums', active ? 'bg-primary text-primary-foreground' : 'bg-field text-muted-foreground')}>
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[repeat(2,_1fr)] min-[900px]:grid-cols-[repeat(3,_1fr)] min-[1536px]:grid-cols-[repeat(4,_1fr)] gap-3">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            quantity={cart.get(product.id) ?? 0}
            onAddToCart={() => handleAddToCart(product.id)}
            onRemoveFromCart={() => handleRemoveFromCart(product.id)}
          />
        ))}
      </div>

      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />
    </div>
  );
};

export default ShopPage;
