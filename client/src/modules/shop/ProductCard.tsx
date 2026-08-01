import React from 'react';
import StatusChip from '../../components/StatusChip';
import { cn } from '../../utils/cn';
import { Card } from '../../components/ui';
import { Typography, Button, IconButton, Divider } from '@mui/material';
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

// ─── Badge styles (tokens Signature -soft) ───────────────────────────────────

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  new: { bg: 'var(--ok-soft)', color: 'var(--ok)' },
  bestseller: { bg: 'var(--accent-soft)', color: 'var(--accent)' },
  promo: { bg: 'var(--err-soft)', color: 'var(--err)' },
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
    <Card className="gap-0 py-0 relative flex flex-col h-full overflow-hidden border-[var(--line)] bg-[var(--card)] transition-colors duration-200 hover:border-[var(--line-2)]">
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
          <div className="absolute top-[10px] start-[10px] z-[1] px-1.5 py-0.5 rounded-[6px] bg-[var(--ok)] text-[var(--on-accent)] text-[0.6875rem] font-bold tracking-[0.02em] tabular-nums">
            -{savingsPct}%
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 pb-2 flex flex-col flex-1">
        {/* Title + SKU */}
        <Typography
          fontWeight={700}
          sx={{
            fontSize: '0.95rem',
            lineHeight: 1.25,
            color: 'text.primary',
            textWrap: 'balance',
          }}
        >
          {product.name}
        </Typography>
        <p className="cn-text-body1 text-muted-foreground opacity-60 text-[0.6875rem] font-medium tracking-[0.04em] mt-0.5 mb-1.5 tabular-nums uppercase">
          {product.sku}
        </p>

        {/* Description */}
        <p className="cn-text-body1 text-[0.78rem] text-muted-foreground leading-[1.45] mb-2">
          {product.shortDescription}
        </p>

        {/* Price row */}
        <div className="flex items-baseline gap-1.5 mb-2">
          <p className="cn-text-body1 font-[var(--font-display)] text-[1.15rem] font-semibold text-[var(--ink)] tabular-nums tracking-[-0.01em]">
            {formatPrice(product.price)}
          </p>
          {product.originalPrice && (
            <p className="cn-text-body1 line-through text-[var(--faint)] text-[0.8rem] tabular-nums">
              {formatPrice(product.originalPrice)}
            </p>
          )}
        </div>

        {/* Protocol chips */}
        {product.protocol && (
          <div className="flex gap-0.5 mb-2 flex-wrap">
            {(product.protocol === 'wifi' || product.protocol === 'both') && (
              <StatusChip tokens={{ color: 'var(--info)', bg: 'var(--info-soft)' }} label={t('shop.protocols.wifi')} icon={<Wifi size={11} strokeWidth={2} />} className="text-[10.5px] tracking-[0.01em] px-0.5" />
            )}
            {(product.protocol === 'zigbee' || product.protocol === 'both') && (
              <StatusChip tokens={{ color: 'var(--muted)', bg: 'var(--field)' }} label={t('shop.protocols.zigbee')} className="text-[10.5px] tracking-[0.01em]" />
            )}
          </div>
        )}

        {/* Features (kit contents grouped as features for kits) */}
        {/* La teinte du kit est calculee (tint) : bordure et fond passent par style inline */}
        <div
          className={cn('flex-1 mb-[7.5px]', isKit && 'p-[6px] rounded-[6px] border border-dashed')}
          style={isKit ? { borderColor: `${tint}33`, backgroundColor: `${tint}08` } : undefined}
        >
          {isKit && (
            <Typography
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: tint,
                mb: 0.625,
              }}
            >
              {t('shop.kitContents')}
            </Typography>
          )}
          {displayedFeatures.slice(0, 5).map((feature) => (
            <div className="flex items-start gap-1 py-0.5" key={feature}>
              <div className="inline-flex shrink-0 mt-0.5" style={{ color: tint }}>
                <CheckCircleOutline size={13} strokeWidth={1.75} />
              </div>
              <p className="cn-text-body1 text-[0.74rem] text-muted-foreground leading-[1.4]">
                {feature}
              </p>
            </div>
          ))}
          {displayedFeatures.length > 5 && (
            <p className="cn-text-body1 text-muted-foreground opacity-60 text-[0.6875rem] ps-3.5 pt-0.5 italic">
              +{displayedFeatures.length - 5} {t('shop.perUnit')}
            </p>
          )}
        </div>

        <Divider sx={{ mb: 1.25, borderColor: 'divider' }} />

        {/* Add to cart / quantity controls */}
        {quantity === 0 ? (
          <Button
            variant="contained"
            fullWidth
            startIcon={<ShoppingCartOutlined size={14} strokeWidth={2} />}
            onClick={onAddToCart}
          >
            {t('shop.addToCart')}
          </Button>
        ) : (
          /* Compteur — pattern .rm-count : conteneur --field r10 p3, boutons --card r8, valeur display */
          <div className="flex items-center justify-between gap-[3px] p-[3px] rounded-[10px] bg-[var(--field)] border border-solid border-[var(--field-line)]">
            <IconButton
              size="small"
              onClick={onRemoveFromCart}
              sx={{
                width: 30,
                height: 30,
                bgcolor: 'var(--card)',
                borderRadius: '8px',
                color: 'var(--body)',
                '&:hover': { bgcolor: 'var(--card)', color: 'var(--accent)' },
              }}
              aria-label="Diminuer la quantité"
            >
              <Remove size={14} strokeWidth={2} />
            </IconButton>
            <p className="cn-text-body1 font-[var(--font-display)] font-semibold text-[15px] text-[var(--ink)] tabular-nums min-w-[24px] text-center">
              {quantity}
            </p>
            <IconButton
              size="small"
              onClick={onAddToCart}
              sx={{
                width: 30,
                height: 30,
                bgcolor: 'var(--card)',
                borderRadius: '8px',
                color: 'var(--body)',
                '&:hover': { bgcolor: 'var(--card)', color: 'var(--accent)' },
              }}
              aria-label="Augmenter la quantité"
            >
              <Add size={14} strokeWidth={2} />
            </IconButton>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ProductCard;
