import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  Divider,
  Link,
} from '@mui/material';
import {
  ArrowBack,
  Handshake,
  Memory,
  CheckCircleOutline,
  OpenInNew,
  SettingsRemote,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Feature list helper ────────────────────────────────────────────────────

function FeatureItem({ text }: { text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
      <CheckCircleOutline sx={{ fontSize: 16, color: 'success.main' }} />
      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
        {text}
      </Typography>
    </Box>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

interface NoiseProductDetailProps {
  type: 'minut' | 'clenzy';
  onSubscribe: () => void;
  onBack: () => void;
}

const NoiseProductDetail: React.FC<NoiseProductDetailProps> = ({ type, onSubscribe, onBack }) => {
  const { t } = useTranslation();

  const isMinut = type === 'minut';

  const config = isMinut
    ? {
        icon: <Handshake sx={{ color: '#6B8A9A', fontSize: 48 }} />,
        title: t('dashboard.noise.minut.detailTitle') || 'Minut - Monitoring sonore professionnel',
        badge: t('tarification.monitoring.minut.badge') || 'Partenaire',
        badgeColor: 'primary' as const,
        description:
          t('dashboard.noise.minut.detailDescription') ||
          'Minut propose des capteurs de bruit certifies avec une integration native Airbnb.',
        pricingModel: t('tarification.monitoring.minut.pricingModel') || 'Abonnement mensuel',
        pricingValue: t('tarification.monitoring.minut.onQuote') || 'Sur devis',
        pricingHint: t('tarification.monitoring.minut.onQuoteHint') || '',
        features: [
          t('tarification.monitoring.minut.feature1'),
          t('tarification.monitoring.minut.feature2'),
          t('tarification.monitoring.minut.feature3'),
          t('tarification.monitoring.minut.feature4'),
        ],
        externalLabel: t('dashboard.noise.minut.subscribeExternal') || "S'abonner sur Minut",
        externalUrl: 'https://www.minut.com',
        configLabel: t('dashboard.noise.minut.configureDevice') || 'Configurer mon capteur',
        bgGradient: 'linear-gradient(135deg, #6B8A9A22 0%, #6B8A9A08 100%)',
        accentColor: '#6B8A9A',
      }
    : {
        icon: <Memory sx={{ color: '#4A9B8E', fontSize: 48 }} />,
        title: t('dashboard.noise.clenzy.detailTitle') || 'Clenzy Hardware - Solution proprietaire',
        badge: t('tarification.monitoring.clenzy.badge') || 'Proprietaire',
        badgeColor: 'success' as const,
        description:
          t('dashboard.noise.clenzy.detailDescription') ||
          'Notre solution basee sur Tuya OEM offre un monitoring sonore sans abonnement mensuel.',
        pricingModel: t('tarification.monitoring.clenzy.pricingModel') || 'Cout unique (sans abonnement)',
        pricingValue: t('tarification.monitoring.clenzy.onQuote') || 'Sur devis',
        pricingHint: t('tarification.monitoring.clenzy.onQuoteHint') || '',
        features: [
          t('tarification.monitoring.clenzy.feature1'),
          t('tarification.monitoring.clenzy.feature2'),
          t('tarification.monitoring.clenzy.feature3'),
          t('tarification.monitoring.clenzy.feature4'),
        ],
        externalLabel: t('dashboard.noise.clenzy.orderExternal') || 'Commander sur la boutique',
        externalUrl: '#',
        configLabel: t('dashboard.noise.clenzy.configureDevice') || 'Configurer mon capteur',
        bgGradient: 'linear-gradient(135deg, #4A9B8E22 0%, #4A9B8E08 100%)',
        accentColor: '#4A9B8E',
      };

  return (
    <Box sx={{ p: 1 }}>
      {/* Back button */}
      <Button
        size="small"
        startIcon={<ArrowBack sx={{ fontSize: 16 }} />}
        onClick={onBack}
        sx={{
          textTransform: 'none',
          fontSize: '0.8125rem',
          color: 'text.secondary',
          mb: 2,
          '&:hover': { bgcolor: 'grey.100' },
        }}
      >
        {t('dashboard.noise.backToOffers') || 'Retour aux offres'}
      </Button>

      <Paper
        elevation={0}
        sx={{
          border: '1.5px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Product hero */}
        <Box
          sx={{
            background: config.bgGradient,
            p: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2.5,
          }}
        >
          {/* Image placeholder */}
          <Box
            sx={{
              width: 96,
              height: 96,
              borderRadius: 2,
              bgcolor: 'white',
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {config.icon}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>
                {config.title}
              </Typography>
              <Chip
                label={config.badge}
                size="small"
                color={config.badgeColor}
                variant="outlined"
                sx={{ fontSize: '0.6875rem', height: 22 }}
              />
            </Box>

            {!isMinut && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                {t('dashboard.noise.clenzy.articleRef') || 'Ref. article'}: CLENZY-TUYA-NM-01
              </Typography>
            )}
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ p: 3 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: '0.8125rem', lineHeight: 1.6, mb: 2.5 }}
          >
            {config.description}
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* Pricing */}
          <Typography
            variant="overline"
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'text.secondary',
              letterSpacing: '0.08em',
            }}
          >
            {config.pricingModel}
          </Typography>

          <Box
            sx={{
              mt: 1,
              mb: 2.5,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'grey.50',
              border: '1px dashed',
              borderColor: 'divider',
              textAlign: 'center',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '1.1rem' }}>
              {config.pricingValue}
            </Typography>
            {config.pricingHint && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                {config.pricingHint}
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Features */}
          <Box sx={{ mb: 2.5 }}>
            {config.features.map((feat, i) => (
              <FeatureItem key={i} text={feat} />
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Actions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}>
            <Link
              href={config.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
            >
              <Button
                variant="outlined"
                size="small"
                endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  borderWidth: 1.5,
                  px: 2.5,
                  py: 0.75,
                }}
              >
                {config.externalLabel}
              </Button>
            </Link>

            <Button
              variant="contained"
              size="small"
              startIcon={<SettingsRemote sx={{ fontSize: 16 }} />}
              onClick={onSubscribe}
              sx={{
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 700,
                px: 3,
                py: 1,
                bgcolor: config.accentColor,
                '&:hover': { bgcolor: config.accentColor, filter: 'brightness(0.9)' },
              }}
            >
              {config.configLabel}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default NoiseProductDetail;
