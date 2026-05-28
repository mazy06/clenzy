import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Container,
  Typography,
  Link,
  ThemeProvider,
  CssBaseline,
  Divider,
} from '@mui/material';
import { ArrowBack } from '../../icons';
import { createClenzyTheme } from '../../theme/createClenzyTheme';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import clenzyLogo from '../../assets/Clenzy_logo.png';

/**
 * Layout commun pour les pages legales publiques (CGU, Politique de confidentialite).
 *
 * <p>Volontairement sobre : logo Clenzy en header, navigation retour vers login,
 * conteneur centre <= 720px pour la lisibilite du texte legal (line-length ideal
 * ~65-75 caracteres). Pas de gradient, pas de glassmorphism — register product
 * Clenzy.</p>
 *
 * <p>Le {@code lastUpdated} affiche la date de derniere modification du document
 * (information legale obligatoire selon CNIL).</p>
 */
export interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  const { t } = useTranslation();
  // Geo-detected language (pas les prefs user) : pays arabes -> ar / Maghreb-France -> fr / autres -> en
  const { isRtl } = useGeoAuthLanguage();
  const theme = useMemo(() => createClenzyTheme({ isRtl }), [isRtl]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          component="header"
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            py: 1.5,
          }}
        >
          <Container maxWidth="md">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Link component={RouterLink} to="/login" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                <Box
                  component="img"
                  src={clenzyLogo}
                  alt="Clenzy"
                  sx={{ height: 32, width: 'auto' }}
                />
              </Link>
              <Link
                component={RouterLink}
                to="/login"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                <ArrowBack size={16} strokeWidth={1.75} />
                {t('auth.legal.back', 'Retour')}
              </Link>
            </Box>
          </Container>
        </Box>

        {/* Corps */}
        <Container maxWidth="md" sx={{ flex: 1, py: { xs: 4, md: 6 } }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              mb: 1,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              textWrap: 'balance',
            }}
          >
            {title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 4 }}>
            {t('auth.legal.lastUpdated', `Dernière mise à jour : ${lastUpdated}`, { date: lastUpdated })}
          </Typography>
          <Divider sx={{ mb: 4 }} />
          <Box
            sx={{
              maxWidth: 680,
              '& h2': {
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'text.primary',
                mt: 4,
                mb: 1.5,
              },
              '& h3': {
                fontSize: '1rem',
                fontWeight: 600,
                color: 'text.primary',
                mt: 3,
                mb: 1,
              },
              '& p': {
                fontSize: '0.9375rem',
                lineHeight: 1.7,
                color: 'text.primary',
                mb: 2,
              },
              '& ul, & ol': {
                pl: 3,
                mb: 2,
              },
              '& li': {
                fontSize: '0.9375rem',
                lineHeight: 1.7,
                color: 'text.primary',
                mb: 0.5,
              },
              '& a': {
                color: 'primary.main',
                textDecoration: 'underline',
              },
            }}
          >
            {children}
          </Box>
        </Container>

        {/* Footer minimal */}
        <Box
          component="footer"
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            py: 3,
            bgcolor: 'background.paper',
          }}
        >
          <Container maxWidth="md">
            <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link component={RouterLink} to="/cgu" sx={{ color: 'text.secondary', fontSize: '0.8125rem', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                {t('auth.legal.footerCgu', 'CGU')}
              </Link>
              <Link component={RouterLink} to="/confidentialite" sx={{ color: 'text.secondary', fontSize: '0.8125rem', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                {t('auth.legal.footerPrivacy', 'Politique de confidentialité')}
              </Link>
              <Link component={RouterLink} to="/support" sx={{ color: 'text.secondary', fontSize: '0.8125rem', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                {t('auth.legal.footerSupport', 'Support')}
              </Link>
            </Box>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
