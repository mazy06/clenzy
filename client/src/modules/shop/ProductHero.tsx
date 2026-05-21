import React, { useState } from 'react';
import { Box } from '@mui/material';
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
} from '../../icons';
import type { LucideIcon } from 'lucide-react';
import type { ShopProduct } from './shopProducts';

const ICON_MAP: Record<string, LucideIcon> = {
  VolumeUp,
  Lock,
  Thermostat,
  SensorDoor,
  DirectionsWalk,
  SmokeFree,
  Inventory2,
  Security,
  AllInclusive,
};

interface PaletteEntry {
  bg: string;
  bgAccent: string;
  icon: string;
  tint: string;
  shape: 'wave' | 'dot' | 'grid' | 'arc' | 'orbit' | 'ring' | 'puff' | 'box' | 'shield';
}

const PALETTE: Record<string, PaletteEntry> = {
  VolumeUp:       { bg: '#EFF5F8', bgAccent: '#7BA3C2', icon: '#3A5A6E', tint: '#7BA3C2', shape: 'wave' },
  Lock:           { bg: '#F1F0EC', bgAccent: '#8A8378', icon: '#3E3833', tint: '#8A8378', shape: 'shield' },
  Thermostat:     { bg: '#FAF1E8', bgAccent: '#D4A574', icon: '#6B4D2A', tint: '#D4A574', shape: 'ring' },
  SensorDoor:     { bg: '#F2F0EC', bgAccent: '#9A8F7A', icon: '#4A4035', tint: '#9A8F7A', shape: 'box' },
  DirectionsWalk: { bg: '#E9F3F0', bgAccent: '#4A9B8E', icon: '#1E5C4F', tint: '#4A9B8E', shape: 'arc' },
  SmokeFree:      { bg: '#F6EEEC', bgAccent: '#C97A7A', icon: '#7A3A3A', tint: '#C97A7A', shape: 'puff' },
  Inventory2:     { bg: '#EFF3F5', bgAccent: '#6B8A9A', icon: '#2E4554', tint: '#6B8A9A', shape: 'grid' },
  Security:       { bg: '#F1ECF1', bgAccent: '#8A6E8A', icon: '#3F2D3F', tint: '#8A6E8A', shape: 'orbit' },
  AllInclusive:   { bg: '#EAF1EF', bgAccent: '#4A9B8E', icon: '#1E5C4F', tint: '#4A9B8E', shape: 'dot' },
};

const DEFAULT_PALETTE: PaletteEntry = {
  bg: '#F1F2F4',
  bgAccent: '#6B8A9A',
  icon: '#2E4554',
  tint: '#6B8A9A',
  shape: 'dot',
};

interface SvgBackdropProps {
  shape: PaletteEntry['shape'];
  accent: string;
}

const SvgBackdrop: React.FC<SvgBackdropProps> = ({ shape, accent }) => {
  const stroke = `${accent}26`;
  const fill = `${accent}1C`;

  return (
    <Box
      component="svg"
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {shape === 'wave' && (
        <>
          <path d="M0,160 Q100,120 200,160 T400,160" stroke={stroke} strokeWidth="1.5" fill="none" />
          <path d="M0,180 Q100,140 200,180 T400,180" stroke={stroke} strokeWidth="1.5" fill="none" />
          <path d="M0,200 Q100,160 200,200 T400,200" stroke={stroke} strokeWidth="1.5" fill="none" />
          <circle cx="60" cy="60" r="36" fill={fill} />
          <circle cx="340" cy="80" r="22" fill={fill} />
        </>
      )}
      {shape === 'shield' && (
        <>
          <path d="M70,40 L70,120 Q70,180 200,210 Q330,180 330,120 L330,40 Z" stroke={stroke} strokeWidth="1.5" fill="none" />
          <circle cx="200" cy="120" r="48" fill={fill} />
          <line x1="0" y1="60" x2="60" y2="60" stroke={stroke} strokeWidth="1" />
          <line x1="340" y1="180" x2="400" y2="180" stroke={stroke} strokeWidth="1" />
        </>
      )}
      {shape === 'ring' && (
        <>
          <circle cx="200" cy="120" r="86" stroke={stroke} strokeWidth="1.5" fill="none" />
          <circle cx="200" cy="120" r="62" stroke={stroke} strokeWidth="1.5" fill="none" />
          <circle cx="200" cy="120" r="38" fill={fill} />
          <line x1="200" y1="20" x2="200" y2="40" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <line x1="200" y1="200" x2="200" y2="220" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <line x1="100" y1="120" x2="120" y2="120" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <line x1="280" y1="120" x2="300" y2="120" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </>
      )}
      {shape === 'box' && (
        <>
          <rect x="80" y="40" width="240" height="160" rx="6" stroke={stroke} strokeWidth="1.5" fill="none" />
          <rect x="100" y="60" width="200" height="120" rx="4" fill={fill} />
          <circle cx="288" cy="120" r="6" fill={accent} opacity="0.45" />
          <line x1="0" y1="200" x2="80" y2="200" stroke={stroke} strokeWidth="1" />
          <line x1="320" y1="200" x2="400" y2="200" stroke={stroke} strokeWidth="1" />
        </>
      )}
      {shape === 'arc' && (
        <>
          <path d="M40,200 Q200,40 360,200" stroke={stroke} strokeWidth="1.5" fill="none" />
          <path d="M80,200 Q200,80 320,200" stroke={stroke} strokeWidth="1.5" fill="none" />
          <path d="M120,200 Q200,120 280,200" stroke={stroke} strokeWidth="1.5" fill="none" />
          <circle cx="200" cy="200" r="6" fill={accent} opacity="0.55" />
        </>
      )}
      {shape === 'puff' && (
        <>
          <circle cx="120" cy="80" r="34" fill={fill} />
          <circle cx="180" cy="60" r="22" fill={fill} />
          <circle cx="250" cy="90" r="28" fill={fill} />
          <circle cx="300" cy="60" r="14" fill={fill} />
          <circle cx="80" cy="150" r="20" fill={fill} />
          <circle cx="340" cy="170" r="24" fill={fill} />
        </>
      )}
      {shape === 'grid' && (
        <>
          {[...Array(8)].map((_, i) => (
            <line
              key={`v-${i}`}
              x1={(i + 1) * 44}
              y1="20"
              x2={(i + 1) * 44}
              y2="220"
              stroke={stroke}
              strokeWidth="1"
            />
          ))}
          {[...Array(5)].map((_, i) => (
            <line
              key={`h-${i}`}
              x1="20"
              y1={(i + 1) * 40}
              x2="380"
              y2={(i + 1) * 40}
              stroke={stroke}
              strokeWidth="1"
            />
          ))}
          <rect x="132" y="80" width="136" height="80" rx="4" fill={fill} />
        </>
      )}
      {shape === 'orbit' && (
        <>
          <ellipse cx="200" cy="120" rx="140" ry="50" stroke={stroke} strokeWidth="1.5" fill="none" />
          <ellipse cx="200" cy="120" rx="90" ry="80" stroke={stroke} strokeWidth="1.5" fill="none" />
          <circle cx="200" cy="120" r="32" fill={fill} />
          <circle cx="60" cy="120" r="5" fill={accent} opacity="0.55" />
          <circle cx="340" cy="120" r="5" fill={accent} opacity="0.55" />
          <circle cx="200" cy="40" r="5" fill={accent} opacity="0.55" />
          <circle cx="200" cy="200" r="5" fill={accent} opacity="0.55" />
        </>
      )}
      {shape === 'dot' && (
        <>
          {[...Array(6)].map((_, row) =>
            [...Array(11)].map((__, col) => (
              <circle
                key={`d-${row}-${col}`}
                cx={col * 40 + 20}
                cy={row * 40 + 20}
                r="2"
                fill={accent}
                opacity="0.18"
              />
            )),
          )}
          <circle cx="200" cy="120" r="56" fill={fill} />
        </>
      )}
    </Box>
  );
};

interface ProductHeroProps {
  product: ShopProduct;
  height?: number | string;
}

const ProductHero: React.FC<ProductHeroProps> = ({ product, height = 168 }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const palette = PALETTE[product.icon] ?? DEFAULT_PALETTE;
  const Icon = ICON_MAP[product.icon];

  const showImage = !!product.imageUrl && !imgFailed;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        bgcolor: palette.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showImage ? (
        <Box
          component="img"
          src={product.imageUrl}
          alt={product.imageAlt}
          loading="lazy"
          onError={() => setImgFailed(true)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      ) : (
        <>
          <SvgBackdrop shape={palette.shape} accent={palette.bgAccent} />
          <Box
            sx={{
              position: 'relative',
              width: 64,
              height: 64,
              borderRadius: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'background.paper',
              color: palette.icon,
              border: `1px solid ${palette.bgAccent}40`,
              boxShadow: `0 4px 14px ${palette.bgAccent}1F`,
            }}
            aria-label={product.imageAlt}
          >
            {Icon && <Icon size={28} strokeWidth={1.75} />}
          </Box>
        </>
      )}
    </Box>
  );
};

export default ProductHero;
export { PALETTE as PRODUCT_PALETTE };
