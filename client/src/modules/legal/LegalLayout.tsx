import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Separator } from '../../components/ui';
import { ArrowBack } from '../../icons';
import { cn } from '../../utils/cn';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import { activeIntlLocaleGregorian } from '../../utils/activeLocale';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
import PublicLanguagePicker from '../../components/PublicLanguagePicker';

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
  /** Date ISO (`AAAA-MM-JJ`) de derniere modification du document. */
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

/**
 * Date d'effet d'un document legal — TOUJOURS gregorienne.
 *
 * <p>La langue suit le lecteur, le calendrier non : rendue en hegirien, la
 * version arabe annoncerait une autre date que la version francaise du meme
 * document. Or c'est la meme date d'effet qui engage.</p>
 */
function formatEffectiveDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(activeIntlLocaleGregorian(), {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * Un bloc de texte legal.
 *
 * <p>Chaque entree porte une CLE, jamais du texte : ces documents existent en
 * trois langues, et un repli en dur laisserait du francais a l'ecran pour un
 * lecteur arabophone — precisement ce qu'on ne peut pas se permettre sur une
 * page qui engage.</p>
 */
export interface LegalSection {
  /** Prefixe de cle : `<base>.<id>.title`, `.p1`, `.i1`, `.after1`… */
  id: string;
  /** Cles des paragraphes d'introduction, dans l'ordre. */
  paragraphs: readonly string[];
  /** Cles des puces, si la section porte une liste. */
  items?: readonly string[];
  /** Cles des paragraphes qui suivent la liste. */
  after?: readonly string[];
}

/**
 * Rend les sections d'un document legal.
 *
 * <p>Les corps passent tous par {@code Trans} : plusieurs portent un lien
 * (contact DPO, renvoi a la politique de confidentialite) que le traducteur
 * doit pouvoir deplacer dans la phrase. Les composants non references par une
 * traduction sont simplement ignores.</p>
 */
export function LegalSections({
  base,
  sections,
  components,
}: {
  /** Racine des cles, p. ex. `legal.cgu`. */
  base: string;
  sections: readonly LegalSection[];
  components?: Record<string, React.ReactElement>;
}) {
  const { t } = useTranslation();
  const body = (key: string) => (
    <Trans i18nKey={`${base}.${key}`} components={components} />
  );

  return (
    <>
      {sections.map((section) => (
        <React.Fragment key={section.id}>
          <h2>{t(`${base}.${section.id}.title`)}</h2>
          {section.paragraphs.map((key) => (
            <p key={key}>{body(`${section.id}.${key}`)}</p>
          ))}
          {section.items && (
            <ul>
              {section.items.map((key) => (
                <li key={key}>{body(`${section.id}.${key}`)}</li>
              ))}
            </ul>
          )}
          {section.after?.map((key) => (
            <p key={key}>{body(`${section.id}.${key}`)}</p>
          ))}
        </React.Fragment>
      ))}
    </>
  );
}

export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  const { t } = useTranslation();
  // La geolocalisation POSE la langue (pays arabes -> ar, Maghreb-France -> fr,
  // sinon en) ; le selecteur permet d'en sortir. Un document qui engage doit
  // pouvoir se lire dans la langue de son lecteur, pas dans celle de son IP.
  // La direction RTL et la police arabe suivent globalement (AppWithTheme).
  const { language, chooseLanguage } = useGeoAuthLanguage();

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-solid border-border bg-card py-2">
        <div className={CONTAINER}>
          <div className="flex items-center justify-between">
            <RouterLink to="/login" className="flex items-center no-underline">
              <BaitlyMarkLogo variant="full" size={30} />
            </RouterLink>
            <div className="flex items-center gap-3">
              <PublicLanguagePicker
                value={language}
                onChange={chooseLanguage}
                label={t('navigation.language')}
              />
              <RouterLink
                to="/login"
                className={cn(QUIET_LINK, 'flex items-center gap-[3px] text-sm font-medium')}
              >
                <ArrowBack size={16} strokeWidth={1.75} />
                {t('auth.legal.back', 'Retour')}
              </RouterLink>
            </div>
          </div>
        </div>
      </header>

      {/* Corps */}
      <div className={cn(CONTAINER, 'flex-1 py-6 min-[900px]:py-9')}>
        <h1 className="[font-family:var(--font-display)] text-[1.75rem] min-[900px]:text-[2.25rem] font-semibold tracking-tight text-foreground text-balance mb-[6px]">
          {title}
        </h1>
        <span className="block mb-6 text-xs tabular-nums text-muted-foreground">
          {t('auth.legal.lastUpdated', { date: formatEffectiveDate(lastUpdated) })}
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
