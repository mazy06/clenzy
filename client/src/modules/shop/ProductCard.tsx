import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  VolumeUp,
  Lock,
  Thermostat,
  SensorDoor,
  DirectionsWalk,
  SmokeFree,
  Inventory2,
  Security,
  AllInclusive,
  Add,
  Remove,
  ExpandMore,
  ExpandLess,
  CheckCircleOutline,
  Wifi,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import type { ShopProduct } from './shopProducts';
import { SHOP_PRODUCTS } from './shopProducts';

// ─── Icon mapping ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactElement> = {
  VolumeUp: <VolumeUp />,
  Lock: <Lock />,
  Thermostat: <Thermostat />,
  SensorDoor: <SensorDoor />,
  DirectionsWalk: <DirectionsWalk />,
  SmokeFree: <SmokeFree />,
  Inventory2: <Inventory2 />,
  Security: <Security />,
  AllInclusive: <AllInclusive />,
};

// ─── Badge colors ────────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  new: { bg: '#4A9B8E18', color: '#4A9B8E', border: '#4A9B8E40' },
  bestseller: { bg: '#6B8A9A18', color: '#6B8A9A', border: '#6B8A9A40' },
  promo: { bg: '#E8735718', color: '#E87357', border: '#E8735740' },
};

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
  const [kitExpanded, setKitExpanded] = useState(false);

  const isKit = product.category === 'kit';
  const icon = ICON_MAP[product.icon];
  const badgeStyle = product.badge ? BADGE_COLORS[product.badge] : null;

  const formatPrice = (cents: number) => convertAndFormat(cents / 100, 'EUR');

  const kitProducts = isKit
    ? (product.kitProductIds ?? []).reduce<ShopProduct[]>((acc, id) => {
        const found = SHOP_PRODUCTS.find((p) => p.id === id);
        if (found) acc.push(found);
        return acc;
      }, [])
    : [];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        border: '1.5px solid',
        borderColor: 'divider',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        height: '100%',
        gridColumn: undefined,
        '&:hover': {
          borderColor: isKit ? '#4A9B8E' : '#6B8A9A',
          boxShadow: isKit
            ? '0 2px 12px rgba(74, 155, 142, 0.1)'
            : '0 2px 12px rgba(107, 138, 154, 0.1)',
        },
      }}
    >
      {/* Header: icon + badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 1.5,
            bgcolor: isKit ? '#4A9B8E12' : '#6B8A9A12',
            color: isKit ? '#4A9B8E' : '#6B8A9A',
          }}
        >
          {icon &&
            React.cloneElement(icon, { sx: { fontSize: 24 } })}
        </Box>
        {product.badge && badgeStyle && (
          <Chip
            label={t(`shop.badges.${product.badge}`)}
            size="small"
            sx={{
              fontSize: '0.6875rem',
              height: 22,
              fontWeight: 600,
              backgroundColor: badgeStyle.bg,
              color: badgeStyle.color,
              border: `1px solid ${badgeStyle.border}`,
              borderRadius: '6px',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
      </Box>

      {/* Name + SKU */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '1rem', lineHeight: 1.3 }}>
        {product.name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6875rem', mb: 0.5 }}>
        {product.sku}
      </Typography>

      {/* Short description */}
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', mb: 1.5, lineHeight: 1.5 }}>
        {product.shortDescription}
      </Typography>

      {/* Price */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: isKit ? '#4A9B8E' : '#6B8A9A' }}>
          {formatPrice(product.price)}
        </Typography>
        {product.originalPrice && (
          <Typography
            variant="body2"
            sx={{ textDecoration: 'line-through', color: 'text.disabled', fontSize: '0.8125rem' }}
          >
            {formatPrice(product.originalPrice)}
          </Typography>
        )}
      </Box>

      {/* Protocol chips */}
      {product.protocol && (
        <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5 }}>
          {(product.protocol === 'wifi' || product.protocol === 'both') && (
            <Chip
              icon={<Wifi size={14} strokeWidth={1.75} />}
              label={t('shop.protocols.wifi')}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.6875rem', height: 22, '& .MuiChip-label': { px: 0.5 } }}
            />
          )}
          {(product.protocol === 'zigbee' || product.protocol === 'both') && (
            <Chip
              label={t('shop.protocols.zigbee')}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.6875rem', height: 22, '& .MuiChip-label': { px: 0.5 } }}
            />
          )}
        </Box>
      )}

      {/* Features list (max 4) */}
      <Box sx={{ mb: 1.5, flex: 1 }}>
        {product.features.slice(0, 4).map((feature) => (
          <Box key={feature} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><CheckCircleOutline size={14} strokeWidth={1.75} /></Box>
            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
              {feature}
            </Typography>
          </Box>
        ))}
        {product.features.length > 4 && (
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6875rem', pl: 2.5 }}>
            +{product.features.length - 4} {t('shop.perUnit')}
          </Typography>
        )}
      </Box>

      {/* Kit contents expandable */}
      {isKit && kitProducts.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Button
            size="small"
            onClick={() => setKitExpanded(!kitExpanded)}
            endIcon={kitExpanded ? <ExpandLess /> : <ExpandMore />}
            sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, color: '#4A9B8E' }}
          >
            {t('shop.kitContents')}
          </Button>
          <Collapse in={kitExpanded}>
            <Box sx={{ pl: 1, pt: 0.5 }}>
              {kitProducts.map((kp, idx) => (
                <Typography key={`${kp.id}-${idx}`} variant="body2" sx={{ fontSize: '0.75rem', py: 0.15 }}>
                  • {kp.name}
                </Typography>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Add to cart / quantity controls */}
      {quantity === 0 ? (
        <Button
          variant="contained"
          fullWidth
          onClick={onAddToCart}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            bgcolor: isKit ? '#4A9B8E' : '#6B8A9A',
            '&:hover': { bgcolor: isKit ? '#4A9B8E' : '#6B8A9A', filter: 'brightness(0.9)' },
          }}
        >
          {t('shop.addToCart')}
        </Button>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
          <IconButton
            size="small"
            onClick={onRemoveFromCart}
            sx={{ border: '1px solid', borderColor: 'divider' }}
          >
            <Remove size={16} strokeWidth={1.75} />
          </IconButton>
          <Typography fontWeight={700} sx={{ minWidth: 24, textAlign: 'center' }}>
            {quantity}
          </Typography>
          <IconButton
            size="small"
            onClick={onAddToCart}
            sx={{ border: '1px solid', borderColor: 'divider' }}
          >
            <Add size={16} strokeWidth={1.75} />
          </IconButton>
        </Box>
      )}
    </Paper>
  );
};

export default ProductCard;
