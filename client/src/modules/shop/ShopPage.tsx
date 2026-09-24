import React, { useState, useMemo, useCallback } from 'react';
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui';
import { ShoppingCartOutlined, Memory, CheckCircleOutline } from '../../icons';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import { SHOP_PRODUCTS, CATEGORIES } from './shopProducts';
import type { ProductCategory } from './shopProducts';
import ProductCard from './ProductCard';
import CartDrawer from './CartDrawer';
import PageHeader from '../../components/PageHeader';
import { BaitlyCatalog, CatalogFilterGroup, CatalogFilter, CatalogResults, type CatalogView } from '../../components/catalog/BaitlyCatalog';
import { useScreenSearch } from '../../components/ScreenChrome';
import { useUserPreference } from '../../hooks/useUserPreference';
import EmptyState from '../../components/EmptyState';
import NavCountBadge from '../../components/NavCountBadge';
import { PackageSearch, Package, AudioLines, LockKeyhole, Thermometer, Boxes } from 'lucide-react';

const CATEGORY_ICONS = { all: Package, kit: Boxes, noise: AudioLines, lock: LockKeyhole, environment: Thermometer };
type Sort = 'catalog' | 'priceAsc' | 'priceDesc';

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

  const [selectedCategory, setSelectedCategory] = useUserPreference<'all' | ProductCategory>('baitly.shop.category', 'all');
  const [view, setView] = useUserPreference<CatalogView>('baitly.catalog.view', 'cards');
  const [sort, setSort] = useUserPreference<Sort>('baitly.shop.sort', 'catalog');
  const [search, setSearch] = useState('');
  useScreenSearch(search, setSearch, t('baitlyCatalog.searchProducts'));
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);

  const cartCount = useMemo(
    () => Array.from(cart.values()).reduce((sum, qty) => sum + qty, 0),
    [cart],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const filtered = SHOP_PRODUCTS.filter(product =>
      (selectedCategory === 'all' || product.category === selectedCategory) &&
      (!q || [t(product.nameKey), t(product.shortDescriptionKey), product.sku].some(value => value.toLocaleLowerCase().includes(q))));
    if (sort === 'priceAsc') return filtered.sort((a, b) => a.price - b.price);
    if (sort === 'priceDesc') return filtered.sort((a, b) => b.price - a.price);
    return [...filtered.filter(p => p.category === 'kit'), ...filtered.filter(p => p.category !== 'kit')];
  }, [selectedCategory, search, sort, t]);

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
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t('shop.title')}
        subtitle={t('shop.subtitle')}
        iconBadge={<Memory />}
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
            <NavCountBadge count={cartCount} className="absolute -top-1 -end-1" />
          </Button>
        )}
      />

      <BaitlyCatalog title={t(categoryTranslationKeys[selectedCategory])} count={filteredProducts.length}
        view={view} onViewChange={setView}
        toolbar={<Select value={sort} onValueChange={value => setSort(value as Sort)}>
          <SelectTrigger size="sm" className="w-40 cursor-pointer" aria-label={t('baitlyCatalog.sort')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="catalog">{t('baitlyCatalog.catalogOrder')}</SelectItem>
            <SelectItem value="priceAsc">{t('baitlyCatalog.priceAsc')}</SelectItem>
            <SelectItem value="priceDesc">{t('baitlyCatalog.priceDesc')}</SelectItem>
          </SelectContent>
        </Select>}
        filters={<>
          <CatalogFilterGroup title={t('baitlyCatalog.categories')}>
            {CATEGORIES.map(category => {
              const Icon = CATEGORY_ICONS[category.id];
              return <CatalogFilter key={category.id} label={t(categoryTranslationKeys[category.id])}
                count={categoryCounts[category.id]} active={selectedCategory === category.id}
                icon={<Icon />} onClick={() => setSelectedCategory(category.id)} />;
            })}
          </CatalogFilterGroup>
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <CheckCircleOutline size={18} className="text-foreground" />
            <p>{t('shop.infoBanner')}</p>
          </div>
        </>}>
        {filteredProducts.length ? <CatalogResults view={view}>
          {filteredProducts.map(product => <ProductCard key={product.id} product={product}
            quantity={cart.get(product.id) ?? 0} onAddToCart={() => handleAddToCart(product.id)}
            onRemoveFromCart={() => handleRemoveFromCart(product.id)} />)}
        </CatalogResults> : <EmptyState variant="transparent" icon={<PackageSearch />}
          title={t('baitlyCatalog.empty')} description={t('baitlyCatalog.emptyHelp')}
          action={<Button variant="outline" onClick={() => { setSearch(''); setSelectedCategory('all'); }}>
            {t('baitlyCatalog.reset')}
          </Button>} />}
      </BaitlyCatalog>

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
