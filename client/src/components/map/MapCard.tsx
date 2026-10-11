import type { ReactNode } from 'react';
import { PropertyImageCarousel } from '../PropertyImageCarousel';
import { Button, Skeleton } from '../ui';
import { ArrowForward } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Fiche affichée dans la bulle d'un marqueur de carte (logement, intervention,
 * remise de clés). Gabarit commun : photos, titre + statut, lignes
 * d'information à icône, puis personne liée et action vers la fiche complète.
 *
 * <p>Deux dispositions, choisies selon la place (cf. `keepPopupInView`) :
 * « large » — photos en colonne à gauche, informations à droite — et
 * « empilée » — photos en tête — pour les cartes étroites. Tout est en CSS
 * (`baitly-map.css`), la fiche n'a pas à connaître sa disposition.</p>
 */
export function MapCard({ photos, alt, children }: { photos?: string[] | null; alt: string; children: ReactNode }) {
  const hasMedia = !!photos && photos.length > 0;
  return (
    <article className="baitly-map-card" data-has-media={hasMedia}>
      {hasMedia ? (
        <div data-map-card-media>
          <PropertyImageCarousel
            photoUrls={photos}
            alt={alt}
            width="100%"
            height="100%"
            enableFullscreen
            sx={{ width: '100%', borderRadius: 0 }}
          />
        </div>
      ) : null}
      <div className="baitly-map-card__body">{children}</div>
    </article>
  );
}

/** Type et statut sur une ligne, titre dessous : l'œil lit « quoi » avant « où ». */
export function MapCardHeader({ eyebrow, title, status }: { eyebrow?: ReactNode; title: string; status?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1 pe-7">
      <div className="flex min-w-0 items-center gap-1.5">
        {eyebrow ? (
          <span className="truncate text-2xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</span>
        ) : null}
        {status ? <span className="shrink-0 [&>*]:scale-95">{status}</span> : null}
      </div>
      <h3 className="m-0 text-[13px] font-semibold leading-snug text-foreground [text-wrap:balance]">{title}</h3>
    </header>
  );
}

export interface MapCardFact {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

/** Lignes d'information : icône, libellé discret, valeur. Les valeurs vides sont écartées. */
export function MapCardFacts({ facts }: { facts: Array<MapCardFact | null | false | undefined> }) {
  const shown = facts.filter((fact): fact is MapCardFact => !!fact && fact.value !== '' && fact.value != null);
  if (shown.length === 0) return null;
  return (
    <dl className="m-0 flex flex-col gap-1">
      {shown.map((fact) => (
        <div key={fact.label} className="grid grid-cols-[14px_1fr] items-start gap-x-2">
          <span className="mt-px inline-flex text-muted-foreground" aria-hidden>{fact.icon}</span>
          <div className="min-w-0">
            <dt className="sr-only">{fact.label}</dt>
            <dd className="m-0 text-xs leading-snug text-foreground">{fact.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

/** Pied de fiche : personne liée et action — côte à côte en disposition large. */
export function MapCardFooter({ children }: { children: ReactNode }) {
  return <div className="baitly-map-card__footer">{children}</div>;
}

/** Personne liée (intervenant, propriétaire) sur une ligne : vignette, nom, rôle. */
export function MapCardPerson({ name, role, avatarUrl }: { name?: string | null; role: string; avatarUrl?: string | null }) {
  const initials = (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  return (
    <div className="flex min-w-0 items-center gap-2">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="size-6 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--bui-navy-soft)] text-[10px] font-semibold text-[var(--bui-navy)]">
          {initials || '–'}
        </span>
      )}
      <p className="m-0 min-w-0 truncate text-xs">
        <span className={name ? 'font-medium text-foreground' : 'text-muted-foreground'}>{name || role}</span>
        {name ? <span className="text-muted-foreground"> · {role}</span> : null}
      </p>
    </div>
  );
}

export function MapCardAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      size="xs"
      variant="ghost"
      data-map-card-action
      className="shrink-0 cursor-pointer text-[var(--bui-navy)] hover:bg-[var(--bui-navy-soft)]"
      onClick={onClick}
    >
      {label}
      <ArrowForward size={12} aria-hidden />
    </Button>
  );
}

export function MapCardSkeleton() {
  return (
    <div className="baitly-map-card" data-has-media="true" aria-busy="true">
      <div data-map-card-media>
        <Skeleton className="size-full rounded-none" />
      </div>
      <div className="baitly-map-card__body">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="mt-1 h-6 w-full" />
      </div>
    </div>
  );
}

export function MapCardError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 p-3.5 pe-10">
      <p className="text-xs text-muted-foreground">{t('baitlyMap.card.loadError', 'Impossible de charger le détail.')}</p>
      <Button size="sm" variant="outline" className="cursor-pointer self-start" onClick={onRetry}>
        {t('common.retry', 'Réessayer')}
      </Button>
    </div>
  );
}
