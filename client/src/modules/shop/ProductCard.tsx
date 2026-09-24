import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Add, Remove, ShoppingCartOutlined, Wifi } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { Money } from '../../components/Money';
import { CatalogCard } from '../../components/catalog/BaitlyCatalog';
import type { ShopProduct } from './shopProducts';
import ProductHero from './ProductHero';

interface ProductCardProps {
  product: ShopProduct;
  quantity: number;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
}

const CATEGORY_KEYS = { kit: 'kits', noise: 'noiseMonitoring', lock: 'locks', environment: 'environment' };

export default function ProductCard({ product, quantity, onAddToCart, onRemoveFromCart }: ProductCardProps) {
  const { t } = useTranslation();
  const name = t(product.nameKey);
  const savings = product.originalPrice && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100) : null;
  return <CatalogCard title={name} source={t('shop.' + CATEGORY_KEYS[product.category])}
    media={<ProductHero product={product} compact />} description={t(product.shortDescriptionKey)}
    badges={<>
      {product.badge && <Badge variant="secondary">{t('shop.badges.' + product.badge)}</Badge>}
      {savings !== null && <Badge variant="success" className="tabular-nums">−{savings}%</Badge>}
    </>}
    metadata={<>
      {(product.protocol === 'wifi' || product.protocol === 'both') && <span><Wifi size={14} />{t('shop.protocols.wifi')}</span>}
      {(product.protocol === 'zigbee' || product.protocol === 'both') && <span>{t('shop.protocols.zigbee')}</span>}
    </>}
    price={<Money value={product.price / 100} from="EUR" />}
    priceNote={product.originalPrice ? <s><Money value={product.originalPrice / 100} from="EUR" /></s> : t('shop.perUnit')}
    action={quantity === 0 ? <Button variant="outline" size="sm" onClick={onAddToCart}
      aria-label={t('shop.addToCart') + ' : ' + name}>
      <ShoppingCartOutlined size={15} />{t('shop.addToCart')}
    </Button> : <div className="flex items-center gap-2" role="group" aria-label={name}>
      <Button variant="outline" size="icon-sm" onClick={onRemoveFromCart} aria-label={t('shop.decreaseQty') + ' : ' + name}><Remove size={15} /></Button>
      <span className="min-w-5 text-center text-sm font-medium tabular-nums" aria-live="polite">{quantity}</span>
      <Button variant="outline" size="icon-sm" onClick={onAddToCart} aria-label={t('shop.increaseQty') + ' : ' + name}><Add size={15} /></Button>
    </div>}>
    <details className="mt-1 text-xs text-muted-foreground">
      <summary className="w-fit cursor-pointer rounded-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-primary">
        {t(product.category === 'kit' ? 'shop.kitContents' : 'baitlyCatalog.specifications')}
      </summary>
      <ul className="my-2 list-disc space-y-1 ps-4 leading-relaxed">
        {product.featureKeys.map(key => <li key={key}>{t(key)}</li>)}
      </ul>
      <p className="m-0 text-xs tabular-nums">{product.sku}</p>
    </details>
  </CatalogCard>;
}
