import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, LogIn, LogOut, Moon, Pencil, Plus, Trash2 } from '../../icons/glyphs';
import { Button, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useDateFormat } from '../../hooks/useDateFormat';
import { activeIntlLocaleGregorian } from '../../utils/activeLocale';
import { buildMonthGrid, toLocalISODate } from '../../utils/monthGrid';
import { weekdayHeaders } from '../../utils/localeDate';
import type { BookingRestriction } from '../../services/api/calendarPricingApi';

export interface StayPeriod { key: string; start: string; end: string; rules: BookingRestriction[] }
export function groupStayPeriods(rules: BookingRestriction[]): StayPeriod[] {
  const periods = new Map<string, StayPeriod>();
  for (const rule of rules) {
    const key = `${rule.startDate}:${rule.endDate}`;
    const period = periods.get(key) ?? { key, start: rule.startDate, end: rule.endDate, rules: [] };
    period.rules.push(rule);
    periods.set(key, period);
  }
  return [...periods.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

export function initialStayPeriod(periods: StayPeriod[], today = toLocalISODate(new Date())) {
  return periods.find(p => p.start <= today && p.end >= today)
    ?? periods.find(p => p.start > today) ?? periods.at(-1);
}

function dateLabel(date: string, full = false) {
  return new Date(date + 'T12:00:00').toLocaleDateString(activeIntlLocaleGregorian(), {
    day: 'numeric', month: full ? 'long' : 'short', year: 'numeric',
  });
}

function PeriodCalendar({ period }: { period: StayPeriod }) {
  const { t } = useTranslation();
  const { language, weekStartsOn } = useDateFormat();
  const today = toLocalISODate(new Date());
  const initialDate = period.start <= today && today <= period.end ? today : period.start;
  const [month, setMonth] = useState(() => new Date(initialDate.slice(0, 7) + '-01T12:00:00'));
  const cells = buildMonthGrid(month, weekStartsOn);
  const monthKey = toLocalISODate(month).slice(0, 7);
  const labels = weekdayHeaders(language, 'short').map(header => header.label);
  return <section className="bs-calendar" aria-label={t('baitlyPricing.stay.calendar', 'Dates concernées par les règles')}>
    <div className="bs-month"><Button variant="ghost" size="icon-sm" aria-label={t('common.previous', 'Précédent')}
      disabled={monthKey <= period.start.slice(0, 7)} onClick={() => setMonth(previous => new Date(previous.getFullYear(), previous.getMonth() - 1, 1))}><ChevronLeft size={18} className="cn-rtl-flip" /></Button>
      <h3>{month.toLocaleDateString(activeIntlLocaleGregorian(), { month: 'long', year: 'numeric' })}</h3>
      <Button variant="ghost" size="icon-sm" aria-label={t('common.next', 'Suivant')} disabled={monthKey >= period.end.slice(0, 7)}
        onClick={() => setMonth(previous => new Date(previous.getFullYear(), previous.getMonth() + 1, 1))}><ChevronRight size={18} className="cn-rtl-flip" /></Button></div>
    <div className="bs-week-labels">{labels.map((label, index) => <span key={index}>{label}</span>)}</div>
    <div className="bs-month-grid">{cells.map(cell => {
      const dow = cell.date.getDay() || 7;
      const covered = cell.inMonth && cell.dateStr >= period.start && cell.dateStr <= period.end
        && period.rules.some(rule => !rule.daysOfWeek?.length || rule.daysOfWeek.includes(dow));
      return <span key={cell.dateStr} className={`bs-calendar-day${!cell.inMonth ? ' bs-other-month' : ''}${covered ? ' bs-covered-day' : ''}${covered && (cell.dateStr === period.start || cell.dateStr === period.end) ? ' bs-boundary-day' : ''}`}
        aria-label={`${dateLabel(cell.dateStr)}${covered ? ', ' + t('baitlyPricing.stay.covered', 'Jour concerné') : ''}`}>{cell.date.getDate()}</span>;
    })}</div>
    <p className="bs-calendar-legend"><span aria-hidden="true" />{t('baitlyPricing.stay.covered', 'Jour concerné')}</p>
    <p className="bs-calendar-note">{t('baitlyPricing.stay.calendarNote', 'Le surlignage indique les jours couverts par au moins une règle de cette période.')}</p>
  </section>;
}

interface Props {
  restrictions: BookingRestriction[];
  loading: boolean;
  deleting: boolean;
  editor: React.ReactNode;
  onCreate: () => void;
  onEdit: (rule: BookingRestriction) => void;
  onDelete: (rule: BookingRestriction) => void;
}

export default function BaitlyStayRulesWorkspace({ restrictions, loading, deleting, editor, onCreate, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const { language, weekStartsOn } = useDateFormat();
  const periods = useMemo(() => groupStayPeriods(restrictions), [restrictions]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = periods.find(period => period.key === selectedKey) ?? initialStayPeriod(periods);
  const labels = weekdayHeaders(language, 'short').map(header => header.label);
  const days = labels.map((label, index) => ({ label, value: (index + weekStartsOn) % 7 || 7 }));
  const today = toLocalISODate(new Date());
  return <div className="bs-workspace" aria-busy={loading}>
    <div className="bs-toolbar"><span>{t('baitlyPricing.stay.periods', 'Périodes configurées')} <strong>{loading ? "…" : periods.length}</strong></span>
      <Button onClick={onCreate} disabled={loading}><Plus size={16} />{t('restrictions.newTitle', 'Nouvelle restriction')}</Button></div>
    {loading ? <><div className="bs-loading-periods">{[0, 1, 2].map(item => <Skeleton key={item} className="h-20 flex-1" />)}</div><Skeleton className="h-80 w-full" /></> : <>
      {!!periods.length && <nav className="bs-periods" aria-label={t('baitlyPricing.stay.periods', 'Périodes configurées')}>
        {periods.map(period => <button type="button" key={period.key} className="bs-period" aria-pressed={period.key === selected?.key} onClick={() => setSelectedKey(period.key)}>
          <span className="bs-period-date"><strong>{new Date(period.start + 'T12:00:00').getDate()}</strong><span>{new Date(period.start + 'T12:00:00').toLocaleDateString(activeIntlLocaleGregorian(), { month: 'short' })}</span></span>
          <span><span className="bs-period-range">{dateLabel(period.start)} <ArrowRight size={12} /> {dateLabel(period.end)}</span><small>{period.end < today ? t('baitlyPricing.stay.past', 'Passée') : period.start > today ? t('baitlyPricing.stay.upcoming', 'À venir') : t('baitlyPricing.stay.current', 'En cours')}</small></span>
        </button>)}
      </nav>}
      {editor}
      {selected ? <section className="bs-period-detail" aria-label={t('baitlyPricing.stay.periodDetail', 'Règles de la période sélectionnée')}>
        <div className="bs-period-heading"><h2>{dateLabel(selected.start, true)} <ArrowRight size={18} /> {dateLabel(selected.end, true)}</h2>
          <span>{t('baitlyPricing.stay.ruleCount', { count: selected.rules.length, defaultValue: '{{count}} règle(s)' })}</span></div>
        <div className="bs-detail-layout"><PeriodCalendar key={selected.key} period={selected} /><div className="bs-rule-explanations">
          {selected.rules.map((rule, index) => <article className="bs-rule" key={rule.id}>
            <div className="bs-rule-heading"><span>{t('baitlyPricing.stay.ruleNumber', { value: index + 1, defaultValue: 'Règle {{value}}' })}</span>
              <div><Button variant="ghost" size="sm" onClick={() => onEdit(rule)}><Pencil size={14} />{t('common.edit', 'Modifier')}</Button>
                <Button variant="ghost" size="icon-sm" aria-label={`${t('common.delete', 'Supprimer')} ${dateLabel(rule.startDate)} · ${index + 1}`} disabled={deleting} onClick={() => onDelete(rule)}><Trash2 size={14} /></Button></div></div>
            {rule.minStay != null || rule.maxStay != null ? <div className="bs-stay-length"><Moon size={18} /><div><small>{t('baitlyPricing.stay.length', 'Durée du séjour')}</small><strong>{rule.minStay != null && rule.maxStay != null
              ? t('baitlyPricing.stay.lengthRange', { min: rule.minStay, max: rule.maxStay, defaultValue: '{{min}} à {{max}} nuits' })
              : rule.minStay != null ? t('baitlyPricing.stay.lengthMin', { count: rule.minStay, defaultValue: '{{count}} nuits minimum' })
              : t('baitlyPricing.stay.lengthMax', { count: rule.maxStay ?? 0, defaultValue: '{{count}} nuits maximum' })}</strong></div>
              <div className="bs-night-strip" aria-hidden="true">{Array.from({ length: Math.min(rule.minStay ?? rule.maxStay ?? 1, 7) }, (_, night) => <i key={night} />)}{(rule.minStay ?? rule.maxStay ?? 0) > 7 && <span>+</span>}</div></div> :
              <p className="bs-unbounded">{t('baitlyPricing.stay.noLengthLimit', 'Cette règle ne fixe pas de durée de séjour.')}</p>}
            {(rule.closedToArrival || rule.closedToDeparture) && <div className="bs-access-rules">
              {rule.closedToArrival && <p><LogIn size={16} /><strong>{t('baitlyPricing.stay.arrivalBlocked', 'Arrivées bloquées')}</strong></p>}
              {rule.closedToDeparture && <p><LogOut size={16} /><strong>{t('baitlyPricing.stay.departureBlocked', 'Départs bloqués')}</strong></p>}
              <small>{t('baitlyPricing.stay.blockedDays', 'Sur les jours concernés ci-dessous. Les nuits peuvent rester réservables avec une autre date d’arrivée ou de départ.')}</small>
            </div>}
            <div className="bs-week-scope"><span>{!rule.daysOfWeek?.length ? t('baitlyPricing.stay.everyDay', 'Tous les jours de la période') : t('baitlyPricing.stay.appliesOn', 'Cette règle s’applique les jours surlignés')}</span>
              <div>{days.map(day => <span key={day.value} className={!rule.daysOfWeek?.length || rule.daysOfWeek.includes(day.value) ? 'bs-week-covered' : ''}
                aria-label={`${day.label}, ${!rule.daysOfWeek?.length || rule.daysOfWeek.includes(day.value) ? t('baitlyPricing.stay.covered', 'Jour concerné') : t('baitlyPricing.stay.notCovered', 'Jour non concerné')}`}>{day.label}</span>)}</div></div>
            {rule.gapDays != null && rule.gapDays > 0 && <p className="bs-priority">{t('baitlyPricing.stay.gapDays', { count: rule.gapDays, defaultValue: 'Intervalle entre les séjours : {{count}} jour(s)' })}</p>}
            {rule.advanceNoticeDays != null && <p className="bs-priority">{t('baitlyPricing.stay.advanceNoticeDays', { count: rule.advanceNoticeDays, defaultValue: 'Réservation au moins {{count}} jour(s) à l’avance' })}</p>}
            {rule.priority != null && <p className="bs-priority">{t('baitlyPricing.stay.priority', 'Priorité')} : {rule.priority}</p>}
          </article>)}
        </div></div>
      </section> : !editor && <section className="bs-empty"><img src="/images/hitl/calendar.webp" alt="" /><div><h2>{t('restrictions.empty', 'Aucune restriction pour ce logement.')}</h2><p>{t('baitlyPricing.stay.emptyHelp', 'Ajoutez une période pour encadrer la durée des séjours ou choisir les jours d’arrivée et de départ.')}</p></div></section>}
    </>}
  </div>;
}
