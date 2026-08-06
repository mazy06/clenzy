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

/** Lien discret du header et du footer : encre attenuee, accent au survol. */
const QUIET_LINK =
  'text-muted-foreground no-underline transition-colors duration-150 hover:text-primary motion-reduce:transition-none';

export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  const { t } = useTranslation();
  // Geo-detected language (pas les prefs user) : pays arabes -> ar / Maghreb-France -> fr / autres -> en.
  // L'effet du hook change la langue i18n ; la direction RTL et la police arabe
  // sont posees globalement par AppWithTheme (main.tsx) qui reagit a ce changement.
  useGeoAuthLanguage();

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-solid border-border bg-card py-2">
        <div className={CONTAINER}>
          <div className="flex items-center justify-between">
            <RouterLink to="/login" className="flex items-center no-underline">
              <BaitlyMarkLogo variant="full" size={30} />
            </RouterLink>
            <RouterLink
              to="/login"
              className={cn(QUIET_LINK, 'flex items-center gap-[3px] text-sm font-medium')}
            >
              <ArrowBack size={16} strokeWidth={1.75} />
              {t('auth.legal.back', 'Retour')}
            </RouterLink>
          </div>
        </div>
      </header>

      {/* Corps */}
      <div className={cn(CONTAINER, 'flex-1 py-6 min-[900px]:py-9')}>
        <h1 className="[font-family:var(--font-display)] text-[1.75rem] min-[900px]:text-[2.25rem] font-semibold tracking-tight text-foreground text-balance mb-[6px]">
          {title}
        </h1>
        <span className="block mb-6 text-xs tabular-nums text-muted-foreground">
          {t('auth.legal.lastUpdated', `Dernière mise à jour : ${lastUpdated}`, { date: lastUpdated })}
        </span>
        <Separator className="mb-6" />
        {/* Habillage typographique du contenu legal : les selecteurs imbriques
            MUI deviennent des variantes descendantes [&_x]:. */}
        <div
          className={cn(
            'max-w-[680px]',
            '[&_h2]:mt-6 [&_h2]:mb-[9px] [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-balance [&_h2]:text-foreground',
            '[&_h3]:mt-[18px] [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground',
            // 15 px : la prose juridique se lit un cran au-dessus de l'echelle
            // applicative, pour tenir la longueur de ligne de 65-75 caracteres.
            '[&_p]:mb-3 [&_p]:text-[0.9375rem] [&_p]:leading-[1.7] [&_p]:text-foreground',
            // Retrait de liste en propriete LOGIQUE : le PMS se lit aussi en RTL.
            '[&_ul]:mb-3 [&_ul]:ps-[18px] [&_ol]:mb-3 [&_ol]:ps-[18px]',
            '[&_li]:mb-[3px] [&_li]:text-[0.9375rem] [&_li]:leading-[1.7] [&_li]:text-foreground',
            '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
          )}
        >
          {children}
        </div>
      </div>

      {/* Footer minimal */}
      <footer className="border-t border-solid border-border py-4 bg-card">
        <div className={CONTAINER}>
          <div className="flex gap-4 justify-center flex-wrap">
            <RouterLink to="/cgu" className={cn(QUIET_LINK, 'text-xs')}>
              {t('auth.legal.footerCgu', 'CGU')}
            </RouterLink>
            <RouterLink to="/confidentialite" className={cn(QUIET_LINK, 'text-xs')}>
              {t('auth.legal.footerPrivacy', 'Politique de confidentialité')}
            </RouterLink>
            <RouterLink to="/support" className={cn(QUIET_LINK, 'text-xs')}>
              {t('auth.legal.footerSupport', 'Support')}
            </RouterLink>
          </div>
        </div>
      </footer>
    </div>
  );
}
