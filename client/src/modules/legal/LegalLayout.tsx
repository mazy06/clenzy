import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Separator } from '../../components/ui';
import { ArrowBack } from '../../icons';
import { cn } from '../../utils/cn';
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

/**
 * Gabarit du conteneur centre — equivalent du `<Container maxWidth="md">` MUI
 * (900 px de large, gouttieres 16 px puis 24 px a partir de 600 px).
 */
const CONTAINER = 'mx-auto w-full max-w-[900px] px-4 min-[600px]:px-6';

export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  const { t } = useTranslation();
  // Geo-detected language (pas les prefs user) : pays arabes -> ar / Maghreb-France -> fr / autres -> en.
  // L'effet du hook change la langue i18n ; la direction RTL et la police arabe
  // sont posees globalement par AppWithTheme (main.tsx) qui reagit a ce changement.
  useGeoAuthLanguage();

  return (
    <div className="min-h-[100vh] bg-[var(--bg)] flex flex-col">
      {/* Header */}
      <header className="border-b border-solid border-[var(--line)] bg-[var(--card)] py-2">
        <div className={CONTAINER}>
          <div className="flex items-center justify-between">
            <RouterLink to="/login" className="flex items-center no-underline">
              <BaitlyMarkLogo variant="full" size={30} />
            </RouterLink>
            <RouterLink
              to="/login"
              className="flex items-center gap-[3px] text-[0.875rem] font-medium text-[var(--muted)] no-underline hover:text-[var(--mui-primary)]"
            >
              <ArrowBack size={16} strokeWidth={1.75} />
              {t('auth.legal.back', 'Retour')}
            </RouterLink>
          </div>
        </div>
      </header>

      {/* Corps */}
      <div className={cn(CONTAINER, 'flex-1 py-6 min-[900px]:py-9')}>
        <h1 className="cn-text-h4 [font-family:var(--font-display)] text-[1.75rem] min-[900px]:text-[2.25rem] font-semibold text-[var(--ink)] text-balance mb-[6px]">
          {title}
        </h1>
        <span className="cn-text-caption text-muted-foreground block mb-6">
          {t('auth.legal.lastUpdated', `Dernière mise à jour : ${lastUpdated}`, { date: lastUpdated })}
        </span>
        <Separator className="mb-6" />
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
      </div>

      {/* Footer minimal */}
      <footer className="border-t border-solid border-[var(--line)] py-4 bg-[var(--card)]">
        <div className={CONTAINER}>
          <div className="flex gap-4 justify-center flex-wrap">
            <RouterLink to="/cgu" className="text-[0.8125rem] text-[var(--muted)] no-underline hover:text-[var(--mui-primary)]">
              {t('auth.legal.footerCgu', 'CGU')}
            </RouterLink>
            <RouterLink to="/confidentialite" className="text-[0.8125rem] text-[var(--muted)] no-underline hover:text-[var(--mui-primary)]">
              {t('auth.legal.footerPrivacy', 'Politique de confidentialité')}
            </RouterLink>
            <RouterLink to="/support" className="text-[0.8125rem] text-[var(--muted)] no-underline hover:text-[var(--mui-primary)]">
              {t('auth.legal.footerSupport', 'Support')}
            </RouterLink>
          </div>
        </div>
      </footer>
    </div>
  );
}
