import React from 'react';
import StatusChip from '../../components/StatusChip';
import { cn } from '../../utils/cn';
import { Button, Card, Separator } from '../../components/ui';
import {
  Add,
  Remove,
  CheckCircleOutline,
  Wifi,
  ShoppingCartOutlined,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { Money } from '../../components/Money';
import type { ShopProduct } from './shopProducts';
import ProductHero, { PRODUCT_PALETTE } from './ProductHero';

const SAVINGS_FEATURE_RE = /^\s*économie\s+de\s+\d+\s*%\s*$/i;

// ─── Badge styles (couple Baitly UI fond -soft / encre -ink) ─────────────────
// L'encre est la variante `-ink` : la teinte vive plafonne a ~2,2:1 en clair.

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  new: { bg: 'var(--bui-success-soft)', color: 'var(--bui-success-ink)' },
  bestseller: { bg: 'var(--bui-primary-soft)', color: 'var(--bui-primary)' },
  promo: { bg: 'var(--bui-destructive-soft)', color: 'var(--bui-destructive-ink)' },
};

const DEFAULT_TINT = '#6B8A9A';
const KIT_TINT = '#4A9B8E';

const formatPrice = (cents: number) => <Money value={cents / 100} from="EUR" />;

// ─── Props ───────────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: ShopProduct;
  quantity: number;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  quantity,
  onAddToCart,
  onRemoveFromCart,
}) => {
  const { t } = useTranslation();

  const isKit = product.category === 'kit';
  const badgeStyle = product.badge ? BADGE_STYLES[product.badge] : null;
  const palette = PRODUCT_PALETTE[product.icon];
  const tint = isKit ? KIT_TINT : palette?.tint ?? DEFAULT_TINT;

  const savingsPct =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null;

  // Filter savings line — the -X% badge already conveys it
  const displayedFeatures = product.features.filter((f) => !SAVINGS_FEATURE_RE.test(f));

  return (
    <Card className="gap-0 py-0 relative flex flex-col h-full overflow-hidden border-border bg-card transition-colors duration-200 hover:border-primary/40 motion-reduce:transition-none">
      {/* Hero image */}
      <div className="relative">
        <ProductHero product={product} height={172} />

        {/* Badge floating top-right */}
        {product.badge && badgeStyle && (
          <div className="absolute top-[10px] end-[10px] z-[1]">
            <StatusChip tokens={{ color: badgeStyle.color, bg: badgeStyle.bg }} label={t(`shop.badges.${product.badge}`)} className="text-[10.5px] tracking-[0.02em]" />
          </div>
        )}

        {/* Savings badge floating top-left for promos */}
        {savingsPct !== null && (
          /* Plaque opaque posee sur le visuel : le couple `-ink` / `primary-foreground`
             s'inverse avec le theme et reste au-dessus de 4,5:1 en clair ET en sombre. */
          <div className="absolute top-[10px] start-[10px] z-[1] px-1.5 py-0.5 rounded-md bg-success-ink text-primary-foreground text-[0.6875rem] font-bold tracking-wide tabular-nums">
            -{savingsPct}%
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 pb-2 flex flex-col flex-1">
        {/* Title + SKU */}
        <p className="text-[0.95rem] font-bold leading-[1.25] text-foreground text-balance">
          {product.name}
        </p>
        <p className="mt-0.5 mb-1.5 text-2xs font-medium uppercase tracking-wide tabular-nums text-faint">
          {product.sku}
        </p>

        {/* Description */}
        <p className="mb-2 text-[0.78rem] leading-[1.45] text-muted-foreground">
          {product.shortDescription}
        </p>

        {/* Price row */}
        <div className="flex items-baseline gap-1.5 mb-2">
          <p className="font-[family-name:var(--font-display)] text-[1.15rem] font-semibold tabular-nums tracking-tight text-foreground">
            {formatPrice(product.price)}
          </p>
          {product.originalPrice && (
            <p className="text-[0.8rem] line-through tabular-nums text-faint">
              {formatPrice(product.originalPrice)}
            </p>
          )}
        </div>

        {/* Protocol chips */}
        {product.protocol && (
          <div className="flex gap-0.5 mb-2 flex-wrap">
            {(product.protocol === 'wifi' || product.protocol === 'both') && (
              <StatusChip tokens={{ color: 'var(--bui-info-ink)', bg: 'var(--bui-info-soft)' }} label={t('shop.protocols.wifi')} icon={<Wifi size={11} strokeWidth={2} />} className="text-[10.5px] tracking-[0.01em] px-0.5" />
            )}
            {(product.protocol === 'zigbee' || product.protocol === 'both') && (
              <StatusChip tokens={{ color: 'var(--bui-muted-foreground)', bg: 'var(--bui-field)' }} label={t('shop.protocols.zigbee')} className="text-[10.5px] tracking-[0.01em]" />
            )}
          </div>
        )}

        {/* Features (kit contents grouped as features for kits) */}
        {/* La teinte du kit est calculee (tint) : bordure et fond passent par style inline */}
        <div
          className={cn('flex-1 mb-[7.5px]', isKit && 'p-[6px] rounded-md border border-dashed')}
          style={isKit ? { borderColor: `${tint}33`, backgroundColor: `${tint}08` } : undefined}
        >
          {isKit && (
            <p className="mb-[3.75px] text-[0.65rem] font-bold uppercase tracking-wider" style={{ color: tint }}>
              {t('shop.kitContents')}
            </p>
          )}
          {displayedFeatures.slice(0, 5).map((feature) => (
            <div className="flex items-start gap-1 py-0.5" key={feature}>
              <span className="inline-flex shrink-0 mt-0.5" style={{ color: tint }}>
                <CheckCircleOutline size={13} strokeWidth={1.75} />
              </span>
              <p className="text-[0.74rem] leading-[1.4] text-muted-foreground">
                {feature}
              </p>
            </div>
          ))}
          {displayedFeatures.length > 5 && (
            <p className="ps-3.5 pt-0.5 text-2xs italic text-faint">
              +{displayedFeatures.length - 5} {t('shop.perUnit')}
            </p>
          )}
        </div>

        <Separator className="mb-[7.5px]" />

        {/* Add to cart / quantity controls */}
        {quantity === 0 ? (
          <Button className="w-full shrink" onClick={onAddToCart}>
            <ShoppingCartOutlined size={14} strokeWidth={2} />
            {t('shop.addToCart')}
          </Button>
        ) : (
          /* Compteur : conteneur `bg-field` borde `field-line`, boutons sur `card`, valeur en display */
          <div className="flex items-center justify-between gap-[3px] p-[3px] rounded-lg bg-field border border-solid border-field-line">
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemoveFromCart}
              className="size-[30px] rounded-md bg-card text-foreground hover:bg-card hover:text-primary"
              aria-label="Diminuer la quantité"
            >
              <Remove size={14} strokeWidth={2} />
            </Button>
            <p className="min-w-[24px] text-center font-[family-name:var(--font-display)] text-[15px] font-semibold tabular-nums text-foreground">
              {quantity}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddToCart}
              className="size-[30px] rounded-md bg-card text-foreground hover:bg-card hover:text-primary"
              aria-label="Augmenter la quantité"
            >
              <Add size={14} strokeWidth={2} />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ProductCard;
