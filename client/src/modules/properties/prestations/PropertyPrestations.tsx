import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { ChevronNext, ChevronPrev } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { activeIntlLocale } from '../../../utils/activeLocale';
import { getInterventionTypeLabel } from '../../../utils/statusUtils';
import { cn } from '../../../utils/cn';
import {
  addDays, dayAssigneeUserId, sameDay, upcomingPrestations, type Prestation,
} from './prestationTimeline';
import { usePropertyPrestationList } from './usePropertyPrestationList';
import { PrestationAssigneeAvatar, PrestationStatusIcon, prestationTypeIcon } from './prestationVisuals';

/**
 * Prestations d'un logement dans sa fiche de carte : interventions planifiées et demandes de
 * service réunies en une seule suite. Par défaut, la fiche montre celles du jour ; la bande de
 * la semaine choisit un autre jour (un point signale les jours qui en ont), ses flèches passent
 * aux semaines suivantes, et « À venir » liste toutes les prochaines, des plus proches aux plus
 * lointaines. Cliquer un jour signale son intervenant (`onDayAssignee`), pour que la carte
 * sélectionne son prestataire et montre son secteur.
 */
export default function PropertyPrestations({ propertyId, onDayAssignee }: {
  propertyId: number; onDayAssignee?: (userId: number | null) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const today = useMemo(() => new Date(), []);
  const [selectedDay, setSelectedDay] = useState<Date | null>(today);
  const { currentWeek, prestations, loading, failed } = usePropertyPrestationList(propertyId, today);
  const weekStart = addDays(currentWeek, weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Le jour affiché (aujourd'hui d'office, puis celui qu'on choisit) désigne son intervenant ;
  // fermer la fiche rend la carte à tous les prestataires.
  const notify = useRef(onDayAssignee);
  notify.current = onDayAssignee;
  const dayAssignee = selectedDay ? dayAssigneeUserId(prestations, selectedDay) : null;
  useEffect(() => { notify.current?.(dayAssignee); }, [dayAssignee]);
  useEffect(() => () => notify.current?.(null), []);
  const shown = selectedDay
    ? prestations.filter((p) => sameDay(p.date, selectedDay))
    : upcomingPrestations(prestations, today);

  const locale = activeIntlLocale();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const dayNumber = new Intl.DateTimeFormat(locale, { day: 'numeric' });
  const weekLabel = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const when = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });


  return (
    <section className="flex flex-col gap-2 border-t border-border pt-2.5" aria-label={t('propertyPrestations.title', 'Prestations')}>
      <div className="flex items-center gap-1">
        <h4 className="m-0 me-auto text-xs font-semibold text-foreground">{t('propertyPrestations.title', 'Prestations')}</h4>
        <button type="button" aria-pressed={selectedDay == null} onClick={() => setSelectedDay(null)}
          className="h-7 cursor-pointer rounded-md px-2 text-2xs font-medium text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted aria-pressed:bg-[var(--bui-navy-soft)] aria-pressed:text-[var(--bui-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t('propertyPrestations.upcoming', 'À venir')}
        </button>
        <button type="button" disabled={weekOffset === 0} onClick={() => { setWeekOffset((w) => w - 1); setSelectedDay(null); }}
          aria-label={t('propertyPrestations.previousWeek', 'Semaine précédente')}
          className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted disabled:cursor-default disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronPrev size={14} aria-hidden />
        </button>
        <span className="min-w-[4.5rem] text-center text-2xs tabular-nums text-muted-foreground">
          {weekLabel.format(weekStart)}
        </span>
        <button type="button" onClick={() => { setWeekOffset((w) => w + 1); setSelectedDay(null); }}
          aria-label={t('propertyPrestations.nextWeek', 'Semaine suivante')}
          className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronNext size={14} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1" role="group" aria-label={t('propertyPrestations.days', 'Jours de la semaine')}>
        {days.map((day) => {
          const count = prestations.filter((p) => sameDay(p.date, day)).length;
          const selected = selectedDay != null && sameDay(day, selectedDay);
          const isToday = sameDay(day, today);
          return (
            <button key={day.toISOString()} type="button" aria-pressed={selected}
              aria-label={`${new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(day)}, ${t('propertyPrestations.count', { count, defaultValue: '{{count}} prestation(s)' })}`}
              onClick={() => setSelectedDay(selected ? null : day)}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-0.5 rounded-md py-1 text-2xs tabular-nums transition-colors duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'bg-[var(--bui-navy)] text-[var(--bui-card)] hover:bg-[var(--bui-navy)]' : 'text-muted-foreground',
                isToday && !selected && 'font-semibold text-foreground',
              )}>
              <span>{weekday.format(day)}</span>
              <span className="text-xs">{dayNumber.format(day)}</span>
              <span aria-hidden className={cn('size-1 rounded-full', count > 0 ? (selected ? 'bg-[var(--bui-card)]' : 'bg-[var(--bui-navy)]') : 'bg-transparent')} />
            </button>
          );
        })}
      </div>

      {loading && <p role="status" className="m-0 text-xs text-muted-foreground">{t('propertyPrestations.loading', 'Chargement des prestations…')}</p>}
      {failed && <p role="alert" className="m-0 text-xs text-[var(--bui-destructive-ink)]">{t('propertyPrestations.loadError', 'Les prestations n’ont pas pu être chargées.')}</p>}
      {!loading && !failed && shown.length === 0 && (
        <p className="m-0 text-xs text-muted-foreground">
          {selectedDay
            ? t('propertyPrestations.noneThatDay', 'Aucune prestation ce jour.')
            : t('propertyPrestations.noneUpcoming', 'Aucune prestation à venir.')}
        </p>
      )}
      {shown.length > 0 && (
        <ul className="m-0 flex max-h-44 list-none flex-col overflow-y-auto overscroll-contain p-0">
          {shown.map((p) => (
            <li key={`${p.kind}:${p.id}`}>
              <PrestationRow prestation={p} when={when.format(p.date)} onOpen={() => navigate(p.href)}
                kindLabel={p.kind === 'intervention' ? t('propertyPrestations.intervention', 'Intervention') : t('propertyPrestations.request', 'Demande')} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PrestationRow({ prestation, when, kindLabel, onOpen }: {
  prestation: Prestation; when: string; kindLabel: string; onOpen: () => void;
}) {
  const { t } = useTranslation();
  const Icon = prestationTypeIcon(prestation.type);
  const typeLabel = getInterventionTypeLabel(prestation.type, t);
  return (
    <button type="button" onClick={onOpen}
      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-start transition-colors duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Intervention = tuile pleine (planifiée) ; demande = contour pointillé (pas encore planifiée). */}
          <span className={cn('grid size-7 shrink-0 place-items-center rounded-md',
            prestation.kind === 'intervention'
              ? 'bg-[var(--bui-navy-soft)] text-[var(--bui-navy)]'
              : 'border border-dashed border-[var(--bui-navy)] text-[var(--bui-navy)]')}>
            <Icon size={15} aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{typeLabel} · {kindLabel}</TooltipContent>
      </Tooltip>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium text-foreground">
          <span className="sr-only">{kindLabel}, {typeLabel} : </span>{prestation.title}
        </span>
        <span className="truncate text-2xs tabular-nums text-muted-foreground">
          {prestation.kind === 'request' && <span className="font-medium text-[var(--bui-navy)]">{kindLabel} · </span>}
          {when}{prestation.assignee ? ` · ${prestation.assignee}` : ''}
        </span>
      </span>
      <PrestationAssigneeAvatar name={prestation.assignee} avatarUrl={prestation.assigneeAvatarUrl} />
      <PrestationStatusIcon status={prestation.status} kind={prestation.kind} />
    </button>
  );
}
