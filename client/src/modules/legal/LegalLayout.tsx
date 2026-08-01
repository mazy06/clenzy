import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Link,
  ThemeProvider,
  CssBaseline,
  Divider,
} from '@mui/material';
import { ArrowBack } from '../../icons';
import { cn } from '../../utils/cn';
import { createBaitlyTheme } from '../../theme/createBaitlyTheme';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';

/**
 * Layout commun pour les pages legales publiques (CGU, Politique de confidentialite).
 *
 * <p>Volontairement sobre : logo Baitly en header, navigation retour vers login,
 * conteneur centre <= 720px pour la lisibilite du texte legal (line-length ideal
 * ~65-75 caracteres). Pas de gradient, pas de glassmorphism — register product
 * Baitly.</p>
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
  const theme = useMemo(() => createBaitlyTheme({ isRtl }), [isRtl]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="min-h-[100vh] bg-[var(--bg)] flex flex-col">
        {/* Header */}
        <header className="border-b border-[var(--line)] bg-[var(--card)] py-2">
          <Container maxWidth="md">
            <div className="flex items-center justify-between">
              <Link component={RouterLink} to="/login" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                <BaitlyMarkLogo variant="full" size={30} />
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
            </div>
          </Container>
        </header>

        {/* Corps */}
        <Container maxWidth="md" sx={{ flex: 1, py: { xs: 4, md: 6 } }}>
          <h1 className="cn-text-h4 [font-family:var(--font-display)] text-[1.75rem] min-[900px]:text-[2.25rem] font-semibold text-[var(--ink)] text-balance mb-[6px]">
            {title}
          </h1>
          <span className="cn-text-caption text-muted-foreground block mb-6">
            {t('auth.legal.lastUpdated', `Dernière mise à jour : ${lastUpdated}`, { date: lastUpdated })}
          </span>
          <Divider sx={{ mb: 4 }} />
          {/* Habillage typographique du contenu legal : les selecteurs imbriques
              MUI deviennent des variantes descendantes [&_x]:. */}
          <div
            className={cn(
              'max-w-[680px]',
              '[&_h2]:mt-6 [&_h2]:mb-[9px] [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[var(--ink)]',
              '[&_h3]:mt-[18px] [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[var(--ink)]',
              '[&_p]:mb-3 [&_p]:text-[0.9375rem] [&_p]:leading-[1.7] [&_p]:text-[var(--ink)]',
              '[&_ul]:mb-3 [&_ul]:pl-[18px] [&_ol]:mb-3 [&_ol]:pl-[18px]',
              '[&_li]:mb-[3px] [&_li]:text-[0.9375rem] [&_li]:leading-[1.7] [&_li]:text-[var(--ink)]',
              '[&_a]:text-[var(--mui-primary)] [&_a]:underline',
            )}
          >
            {children}
          </div>
        </Container>

        {/* Footer minimal */}
        <footer className="border-t border-[var(--line)] py-4 bg-[var(--card)]">
          <Container maxWidth="md">
            <div className="flex gap-4 justify-center flex-wrap">
              <Link component={RouterLink} to="/cgu" sx={{ color: 'text.secondary', fontSize: '0.8125rem', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                {t('auth.legal.footerCgu', 'CGU')}
              </Link>
              <Link component={RouterLink} to="/confidentialite" sx={{ color: 'text.secondary', fontSize: '0.8125rem', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                {t('auth.legal.footerPrivacy', 'Politique de confidentialité')}
              </Link>
              <Link component={RouterLink} to="/support" sx={{ color: 'text.secondary', fontSize: '0.8125rem', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                {t('auth.legal.footerSupport', 'Support')}
              </Link>
            </div>
          </Container>
        </footer>
      </div>
    </ThemeProvider>
  );
}
