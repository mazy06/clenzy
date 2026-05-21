import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Add,
  Remove,
  CheckCircleOutline,
  Wifi,
  ShoppingCartOutlined,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import type { ShopProduct } from './shopProducts';
import ProductHero, { PRODUCT_PALETTE } from './ProductHero';

const SAVINGS_FEATURE_RE = /^\s*économie\s+de\s+\d+\s*%\s*$/i;

// ─── Badge styles (palette Clenzy) ───────────────────────────────────────────

const BADGE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  new: { bg: '#4A9B8E14', color: '#4A9B8E', border: '#4A9B8E40' },
  bestseller: { bg: '#6B8A9A14', color: '#6B8A9A', border: '#6B8A9A40' },
  promo: { bg: '#C97A7A14', color: '#C97A7A', border: '#C97A7A40' },
};

const DEFAULT_TINT = '#6B8A9A';
const KIT_TINT = '#4A9B8E';

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
  const { convertAndFormat } = useCurrency();

  const isKit = product.category === 'kit';
  const badgeStyle = product.badge ? BADGE_STYLES[product.badge] : null;
  const palette = PRODUCT_PALETTE[product.icon];
  const tint = isKit ? KIT_TINT : palette?.tint ?? DEFAULT_TINT;

  const formatPrice = (cents: number) => convertAndFormat(cents / 100, 'EUR');

  const savingsPct =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null;

  // Filter savings line — the -X% badge already conveys it
  const displayedFeatures = product.features.filter((f) => !SAVINGS_FEATURE_RE.test(f));

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        transition:
          'border-color 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        '&:hover': {
          borderColor: `${tint}66`,
          boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 6px 16px rgba(45, 55, 72, 0.08)',
          transform: 'translateY(-2px)',
        },
        '&:hover .product-hero-img': {
          transform: 'scale(1.04)',
        },
      }}
    >
      {/* Hero image */}
      <Box sx={{ position: 'relative' }} className="product-hero-img" style={{ transition: 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
        <ProductHero product={product} height={172} />

        {/* Badge floating top-right */}
        {product.badge && badgeStyle && (
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 1,
            }}
          >
            <Chip
              label={t(`shop.badges.${product.badge}`)}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                backgroundColor: badgeStyle.bg,
                color: badgeStyle.color,
                border: `1px solid ${badgeStyle.border}`,
                borderRadius: '6px',
                backdropFilter: 'none',
                '& .MuiChip-label': { px: 0.875 },
              }}
            />
          </Box>
        )}

        {/* Savings badge floating top-left for promos */}
        {savingsPct !== null && (
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              left: 10,
              zIndex: 1,
              px: 0.875,
              py: 0.25,
              borderRadius: '6px',
              backgroundColor: '#4A9B8E',
              color: '#fff',
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            -{savingsPct}%
          </Box>
        )}
      </Box>

      {/* Body */}
      <Box sx={{ p: 2, pb: 1.5, display: 'flex', flexDirection: 'column', flex: 1 }}>
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
        <Typography
          sx={{
            color: 'text.disabled',
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.04em',
            mt: 0.25,
            mb: 1,
            fontVariantNumeric: 'tabular-nums',
            textTransform: 'uppercase',
          }}
        >
          {product.sku}
        </Typography>

        {/* Description */}
        <Typography
          sx={{
            fontSize: '0.78rem',
            color: 'text.secondary',
            lineHeight: 1.45,
            mb: 1.25,
          }}
        >
          {product.shortDescription}
        </Typography>

        {/* Price row */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.25 }}>
          <Typography
            sx={{
              fontSize: '1.15rem',
              fontWeight: 700,
              color: tint,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.01em',
            }}
          >
            {formatPrice(product.price)}
          </Typography>
          {product.originalPrice && (
            <Typography
              sx={{
                textDecoration: 'line-through',
                color: 'text.disabled',
                fontSize: '0.8rem',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatPrice(product.originalPrice)}
            </Typography>
          )}
        </Box>

        {/* Protocol chips */}
        {product.protocol && (
          <Box sx={{ display: 'flex', gap: 0.5, mb: 1.25, flexWrap: 'wrap' }}>
            {(product.protocol === 'wifi' || product.protocol === 'both') && (
              <Chip
                icon={<Wifi size={11} strokeWidth={2} />}
                label={t('shop.protocols.wifi')}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  backgroundColor: '#7BA3C214',
                  color: '#7BA3C2',
                  border: '1px solid #7BA3C233',
                  borderRadius: '6px',
                  px: 0.25,
                  '& .MuiChip-icon': {
                    color: '#7BA3C2 !important',
                    ml: '6px',
                    mr: '-2px',
                  },
                  '& .MuiChip-label': { px: 0.875 },
                }}
              />
            )}
            {(product.protocol === 'zigbee' || product.protocol === 'both') && (
              <Chip
                label={t('shop.protocols.zigbee')}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  backgroundColor: '#8A6E8A14',
                  color: '#8A6E8A',
                  border: '1px solid #8A6E8A33',
                  borderRadius: '6px',
                  '& .MuiChip-label': { px: 0.875 },
                }}
              />
            )}
          </Box>
        )}

        {/* Features (kit contents grouped as features for kits) */}
        <Box
          sx={{
            flex: 1,
            mb: 1.25,
            ...(isKit && {
              p: 1,
              borderRadius: '6px',
              border: '1px dashed',
              borderColor: `${tint}33`,
              backgroundColor: `${tint}08`,
            }),
          }}
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
            <Box
              key={feature}
              sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, py: 0.2 }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  color: tint,
                  flexShrink: 0,
                  mt: '2px',
                }}
              >
                <CheckCircleOutline size={13} strokeWidth={1.75} />
              </Box>
              <Typography
                sx={{
                  fontSize: '0.74rem',
                  color: 'text.secondary',
                  lineHeight: 1.4,
                }}
              >
                {feature}
              </Typography>
            </Box>
          ))}
          {displayedFeatures.length > 5 && (
            <Typography
              sx={{
                color: 'text.disabled',
                fontSize: '0.6875rem',
                pl: 2.25,
                pt: 0.25,
                fontStyle: 'italic',
              }}
            >
              +{displayedFeatures.length - 5} {t('shop.perUnit')}
            </Typography>
          )}
        </Box>

        <Divider sx={{ mb: 1.25, borderColor: 'divider' }} />

        {/* Add to cart / quantity controls */}
        {quantity === 0 ? (
          <Button
            variant="contained"
            fullWidth
            disableElevation
            startIcon={<ShoppingCartOutlined size={14} strokeWidth={2} />}
            onClick={onAddToCart}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.78rem',
              letterSpacing: '0.01em',
              borderRadius: '8px',
              py: 0.875,
              bgcolor: tint,
              color: '#fff',
              boxShadow: 'none',
              transition: 'background-color 180ms cubic-bezier(0.22, 1, 0.36, 1)',
              '&:hover': {
                bgcolor: tint,
                filter: 'brightness(0.94)',
                boxShadow: 'none',
              },
            }}
          >
            {t('shop.addToCart')}
          </Button>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 0.5,
              p: 0.5,
              borderRadius: '8px',
              border: `1px solid ${tint}40`,
              backgroundColor: `${tint}0A`,
            }}
          >
            <IconButton
              size="small"
              onClick={onRemoveFromCart}
              sx={{
                width: 28,
                height: 28,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '6px',
                color: tint,
                '&:hover': { bgcolor: `${tint}14`, borderColor: `${tint}66` },
              }}
              aria-label="Diminuer la quantité"
            >
              <Remove size={14} strokeWidth={2} />
            </IconButton>
            <Typography
              fontWeight={700}
              sx={{
                fontSize: '0.85rem',
                color: tint,
                fontVariantNumeric: 'tabular-nums',
                minWidth: 24,
                textAlign: 'center',
              }}
            >
              {quantity}
            </Typography>
            <IconButton
              size="small"
              onClick={onAddToCart}
              sx={{
                width: 28,
                height: 28,
                bgcolor: tint,
                border: `1px solid ${tint}`,
                borderRadius: '6px',
                color: '#fff',
                '&:hover': { bgcolor: tint, filter: 'brightness(0.94)' },
              }}
              aria-label="Augmenter la quantité"
            >
              <Add size={14} strokeWidth={2} />
            </IconButton>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default ProductCard;
