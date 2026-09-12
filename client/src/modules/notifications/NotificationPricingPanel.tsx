import React from 'react';
import { format, parseISO, isValid, addDays, differenceInCalendarDays } from 'date-fns';
import { ar, enUS, fr } from 'date-fns/locale';
import { Badge, Skeleton } from '../../components/ui';
import { Money } from '../../components/baitly/Money';
import { SERIES_TOKENS } from '../../components/stats';

/**
 * Teintes des plages, une par creneau : c'est ce qui rattache « −7 % » a
 * l'endroit du calendrier qui le porte. Le SENS de l'ajustement, lui, se dit
 * par le signe et par la pastille — pas par la couleur.
 *
 * <p>Les jetons de serie, moins le troisieme : c'est le bleu nuit du theme, et
 * dilue a 14 % il donne un gris que rien ne distingue d'une nuit non
 * concernee. La sixieme plage reprend donc la premiere, ce qui reste lisible —
 * deux creneaux de meme teinte ne se touchent jamais, par construction.</p>
 */
const BAND_TOKENS = [
  SERIES_TOKENS[0],
  SERIES_TOKENS[1],
  SERIES_TOKENS[3],
  SERIES_TOKENS[4],
  'var(--bui-primary)',
];
import RangeCalendar, { type CalendarRange } from './RangeCalendar';
import { PropertyIdentity, PropertyLine, useNotificationProperty } from './NotificationPropertyPanel';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import { FACT_ICON } from './notificationMeta';
import type { PriceDirection, PriceSegment } from '../supervision/pricingApi';
import type { Notification } from '../../services/api';

/**
 * Les creneaux qu'une carte de yield propose de retarifer.
 *
 * <p>« 3 creneaux creux a optimiser : 1 nov.→5 nov. −7 % · 9 nov.→29 nov. −7 % ·
 * 30 nov.→10 decembre −7 % » : trois plages a se representer de tete, dans un
 * texte qui ne dit ni combien de nuits chacune pese, ni ou elles tombent les
 * unes par rapport aux autres. Un calendrier le dit d'un regard — c'est la
 * forme naturelle d'une plage de dates.</p>
 *
 * <p><b>Les plages viennent de la CARTE, pas du texte.</b> Le scanner les a
 * deja ecrites en clair dans ses parametres d'action
 * ({@code {"direction":"down","segments":[{from,to,percent}]}}) ; les relire
 * dans la prose du motif casserait a la premiere reformulation, et la borne de
 * fin y est affichee INCLUSE alors qu'elle est exclusive dans les parametres.</p>
 *
 * <p>Le panneau MONTRE, il n'ajuste pas : l'edition segment par segment, la
 * simulation de revenu et l'application vivent dans la file de supervision, ou
 * l'etat est relu au moment d'agir. Rejouer ce parcours ici en ferait deux
 * versions qui divergent.</p>
 */

/** Carte de yield designee par une notification, ou `null`. */
export function pricingCardOf(notification: Notification): { cardId: string; propertyId: number } | null {
  if (notification.metadata?.actionType !== 'PRICE_DROP') return null;

  const rawCard = notification.metadata?.suggestionId;
  const rawProperty = notification.metadata?.propertyId;
  const cardId = typeof rawCard === 'number' || typeof rawCard === 'string' ? String(rawCard) : null;
  const propertyId = typeof rawProperty === 'number' && Number.isInteger(rawProperty)
    ? rawProperty
    : typeof rawProperty === 'string' && /^\d+$/.test(rawProperty) ? Number(rawProperty) : null;

  return cardId && propertyId !== null ? { cardId, propertyId } : null;
}

/** Ce que la carte porte, une fois ses parametres relus. */
export interface PricingPlan {
  direction: PriceDirection;
  segments: PriceSegment[];
  /** Impact estime en centimes, tel que le scanner l'a chiffre. */
  estimatedImpactCents: number | null;
}

/** Carte telle que la file de supervision la sert. */
interface SupervisionCard {
  id: string;
  actionParams: string | null;
  estimatedImpactCents: number | null;
}

/** Segments lisibles portes par les parametres d'action, ou `null`. */
function readPlan(card: SupervisionCard): PricingPlan | null {
  if (!card.actionParams) return null;
  try {
    const parsed = JSON.parse(card.actionParams) as { direction?: string; segments?: unknown };
    const raw = Array.isArray(parsed.segments) ? parsed.segments : [];
    const segments = raw
      .map((entry) => entry as Partial<PriceSegment>)
      .filter((entry): entry is PriceSegment =>
        typeof entry.from === 'string'
        && typeof entry.to === 'string'
        && typeof entry.percent === 'number'
        && isValid(parseISO(entry.from))
        && isValid(parseISO(entry.to)))
      .sort((a, b) => a.from.localeCompare(b.from));
    if (segments.length === 0) return null;
    return {
      direction: parsed.direction === 'up' ? 'up' : 'down',
      segments,
      estimatedImpactCents: card.estimatedImpactCents ?? null,
    };
  } catch {
    // Des parametres illisibles ne valent pas un panneau vide : la fiche
    // retombe sur son motif, qui enonce deja les plages en toutes lettres.
    return null;
  }
}

/**
 * Va chercher la carte dans la file du logement.
 *
 * <p>Une carte deja appliquee ou rejetee n'y est plus : le panneau disparait
 * alors, ce qui est honnete — il n'y a plus rien a retarifer.</p>
 */
export function useNotificationPricing(card: { cardId: string; propertyId: number } | null) {
  const [plan, setPlan] = React.useState<PricingPlan | null>(null);
  const [loading, setLoading] = React.useState(card !== null);

  const cardId = card?.cardId ?? null;
  const propertyId = card?.propertyId ?? null;

  React.useEffect(() => {
    if (cardId === null || propertyId === null) {
      setPlan(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    apiClient
      .get<SupervisionCard[]>(`/ai/supervision/suggestions/${propertyId}`)
      .then((cards) => {
        if (!active) return;
        const found = (cards ?? []).find((entry) => String(entry.id) === cardId);
        setPlan(found ? readPlan(found) : null);
      })
      .catch(() => { if (active) setPlan(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cardId, propertyId]);

  return { plan, loading };
}

/** Attente : la forme du panneau, pas un tourniquet centre. */
export function NotificationPricingSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <Skeleton className="h-3.5 w-44" />
      </div>
      <Skeleton className="h-[248px] w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}

/** Intitule de champ a l'interieur du panneau. */
function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function localeOf(lang: string) {
  return lang === 'ar' ? ar : lang === 'en' ? enUS : fr;
}

/** Les nuits d'un segment. La borne de fin est EXCLUSIVE dans les parametres. */
function nightsOf(segment: PriceSegment): Date[] {
  const from = parseISO(segment.from);
  const toExclusive = parseISO(segment.to);
  const count = differenceInCalendarDays(toExclusive, from);
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, index) => addDays(from, index));
}

/**
 * Le plan de retarification : un calendrier, puis le detail plage par plage.
 *
 * <p>Le calendrier est une IMAGE — il n'est ni navigable ni selectionnable, et
 * reste hors du parcours clavier : la liste en dessous dit exactement la meme
 * chose en toutes lettres, et c'est elle qu'une synthese vocale lira.</p>
 */
export default function NotificationPricingPanel({
  plan,
  propertyId,
  propertyName,
  observation,
}: {
  plan: PricingPlan;
  /** Logement retarife — charge pour sa vignette, son lieu et son prix de base. */
  propertyId: number;
  propertyName?: string | null;
  /** Motif de l'evenement — ce que le panneau ne montre pas de lui-meme. */
  observation?: string;
}) {
  const { t, currentLanguage } = useTranslation();
  const { property } = useNotificationProperty(propertyId);
  const locale = localeOf(currentLanguage);
  const raise = plan.direction === 'up';

  const nightsBySegment = plan.segments.map(nightsOf);
  const allNights = nightsBySegment.flat();
  const firstNight = allNights[0];

  const colorOf = (index: number) => BAND_TOKENS[index % BAND_TOKENS.length];
  const ranges: CalendarRange[] = plan.segments.map((segment, index) => ({
    from: parseISO(segment.from),
    toExclusive: parseISO(segment.to),
    color: colorOf(index),
  }));

  const signed = (percent: number) => `${raise ? '+' : '−'}${Math.abs(percent)} %`;

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <PropertyIdentity
        property={property}
        name={property?.name ?? propertyName ?? ''}
        extra={typeof property?.nightlyPrice === 'number' && property.nightlyPrice > 0 && (
          // Le prix de BASE : sans lui, « −7 % » est un pourcentage sans assiette.
          <PropertyLine icon={FACT_ICON.amount}>
            {t('notifications.detail.pricing.basePrice', 'Prix de base')}{' : '}
            <span className="tabular-nums text-foreground">
              <Money value={property.nightlyPrice} from="EUR" />
            </span>
          </PropertyLine>
        )}
        trailing={(
          <Badge variant={raise ? 'success' : 'warning'}>
            {raise
              ? t('notifications.detail.pricing.raise', 'Revalorisation')
              : t('notifications.detail.pricing.drop', 'Baisse')}
          </Badge>
        )}
      />

      <div className="flex flex-wrap items-start gap-x-8 gap-y-5 rounded-lg bg-card px-3.5 py-3.5">
        {firstNight && <RangeCalendar ranges={ranges} locale={locale} />}

        {/* La legende occupe la place laissee a DROITE des mois : deux
            calendriers font 420 px, la carte en fait le double. Elle repasse
            dessous quand la largeur ne suffit plus. */}
        <div className="flex min-w-[240px] flex-1 flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <Caption>{t('notifications.detail.pricing.segments', 'Créneaux concernés')}</Caption>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t('notifications.detail.subjectPanel.nights', '{{count}} nuit', { count: allNights.length })}
            </span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {plan.segments.map((segment, index) => {
              const nights = nightsBySegment[index];
              const last = nights[nights.length - 1];
              if (!last) return null;
              return (
                <li key={`${segment.from}-${segment.to}`} className="flex items-baseline gap-2.5 text-sm">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: colorOf(index) }}
                  />
                  <span className="min-w-0 tabular-nums text-foreground">
                    {format(nights[0], 'd MMM', { locale })} – {format(last, 'd MMM yyyy', { locale })}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {t('notifications.detail.subjectPanel.nights', '{{count}} nuit', { count: nights.length })}
                  </span>
                  <span
                    className="ms-auto shrink-0 font-semibold tabular-nums"
                    style={{ color: `color-mix(in srgb, ${colorOf(index)} var(--bui-tint-text, 82%), var(--bui-ink))` }}
                  >
                    {signed(segment.percent)}
                  </span>
                </li>
              );
            })}
          </ul>

          {plan.estimatedImpactCents !== null && plan.estimatedImpactCents > 0 && (
            <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-3">
              <Caption>{t('notifications.detail.pricing.impact', 'Gain estimé')}</Caption>
              <span className={cn('text-sm font-semibold tabular-nums',
                raise ? 'text-success-ink' : 'text-warning-ink')}>
                <Money value={plan.estimatedImpactCents / 100} from="EUR" />
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Le motif CLOT le dossier plutot que de flotter sous la carte : la fiche
          se lit d'un seul tenant. Le texte vient de l'emetteur et n'est pas
          decoupe ici — ce sont les PARAMETRES qui ont dessine le calendrier. */}
      {observation?.trim() && (
        <div className="border-t border-border pt-3.5">
          <Caption>{t('notifications.detail.stay.observed', 'Ce qui a été observé')}</Caption>
          <p className="m-0 mt-1.5 text-sm leading-relaxed text-pretty whitespace-pre-line text-foreground">
            {observation}
          </p>
        </div>
      )}
    </section>
  );
}
