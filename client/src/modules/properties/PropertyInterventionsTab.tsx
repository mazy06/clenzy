import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, List, ChevronLeft, ChevronRight, CheckCircle2, Clock3, Play, XCircle, ExternalLink } from '../../icons/glyphs';
import { Button, ToggleGroup, ToggleGroupItem } from '../../components/ui';
import StatusIcon, { type StatusIconTone } from '../../components/StatusIcon';
import StatTile from '../../components/baitly/StatTile';
import StatTileRow from '../../components/baitly/StatTileRow';
import PagePagination from '../../components/PagePagination';
import { useTranslation } from '../../hooks/useTranslation';
import { getInterventionStatusLabel, getInterventionTypeLabel } from '../../utils/statusUtils';
import type { PropertyIntervention } from '../../hooks/usePropertyDetails';
import { formatMonthYear, weekdayHeaders } from '../../utils/localeDate';
import { activeIntlLocale } from '../../utils/activeLocale';
import { Money } from '../../components/Money';
import { PROPERTY_ART } from './propertyArtwork';
import { PropertyTabEmpty, PropertyTabHeading } from './PropertyTabPrimitives';

function statusDetails(status: string) {
  switch (status.toLowerCase()) {
    case 'completed': case 'terminee': case 'terminé': return { icon: CheckCircle2, tone: 'success' as StatusIconTone, state: 'completed' };
    case 'in_progress': case 'en_cours': return { icon: Play, tone: 'info' as StatusIconTone, state: 'progress' };
    case 'cancelled': case 'annulee': return { icon: XCircle, tone: 'muted' as StatusIconTone, state: 'cancelled' };
    default: return { icon: Clock3, tone: 'warning' as StatusIconTone, state: 'pending' };
  }
}
function dateKey(date: Date) {
  return [date.getFullYear(),date.getMonth(),date.getDate()].join('-');
}
function artwork(type: string) {
  return /clean|menage|ménage/i.test(type) ? PROPERTY_ART.cleaning : /check.?in/i.test(type) ? PROPERTY_ART.arrival
    : /check.?out/i.test(type) ? PROPERTY_ART.departure : PROPERTY_ART.interventions;
}

export default function PropertyInterventionsTab({ interventions }: { interventions: PropertyIntervention[]; propertyId: string }) {
  const { t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const [view, setView] = useState('calendar');
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => [...interventions].sort((a,b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()), [interventions]);
  const initialDate = () => sorted.find(item => Number.isFinite(Date.parse(item.scheduledDate)))?.scheduledDate;
  const [selectedDay, setSelectedDay] = useState(() => new Date(initialDate() ?? Date.now()));
  const [month, setMonth] = useState(() => new Date(initialDate() ?? Date.now()));
  const today = new Date();
  const moveMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next); setSelectedDay(next);
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const byDay = useMemo(() => {
    const map = new Map<string, PropertyIntervention[]>();
    sorted.forEach(item => { const key = dateKey(new Date(item.scheduledDate)); map.set(key, [...(map.get(key) ?? []), item]); });
    return map;
  }, [sorted]);
  const cells = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    start.setDate(1 - (start.getDay() + 6) % 7);
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [month]);
  const dayItems = byDay.get(dateKey(selectedDay)) ?? [];
  const currentPage = Math.min(page, Math.max(0, Math.ceil(sorted.length / 8) - 1));
  const listItems = sorted.slice(currentPage * 8, currentPage * 8 + 8);
  const selected = sorted.find(item => item.id === selectedId) ?? listItems[0];
  const rows = (items: PropertyIntervention[]) => items.map(item => {
    const status = statusDetails(item.status);
    return <div className="pdt-row" key={item.id} data-selected={view === 'list' && item.id === selected?.id}>
      <button type="button" className="pdt-row__button" aria-pressed={view === 'list' ? item.id === selected?.id : undefined} onClick={() => view === 'calendar' ? navigate('/interventions/' + item.id) : setSelectedId(item.id)}>
        <img src={artwork(item.type)} alt="" width={42} height={42} />
        <span className="pdt-row__copy"><strong>{getInterventionTypeLabel(item.type, t)}</strong>
          <small>{new Date(item.scheduledDate).toLocaleDateString(activeIntlLocale())}{item.assignedTo ? ' · ' + item.assignedTo : ''}</small></span>
      </button>
      <StatusIcon icon={status.icon} tone={status.tone} label={getInterventionStatusLabel(item.status, t)} />
    </div>;
  });
  return <div className="pdt-page">
    <StatTileRow presentation="overview">
      <StatTile icon={<CalendarDays />} artwork={PROPERTY_ART.calendar} label={t('properties.tabs.interventions')} value={interventions.length} />
      <StatTile icon={<Clock3 />} artwork={PROPERTY_ART.interventions} label={t('propertyTabs.pending', 'À réaliser')} value={interventions.filter(i => ['pending','progress'].includes(statusDetails(i.status).state)).length} />
      <StatTile icon={<CheckCircle2 />} artwork={PROPERTY_ART.completed} label={t('properties.interventions.completed')} value={interventions.filter(i => statusDetails(i.status).state === 'completed').length} />
    </StatTileRow>
    <section className="pdt-surface">
      <div className="pdt-toolbar">
        <ToggleGroup type="single" value={view} onValueChange={value => { if (value) setView(value); }} aria-label={t('propertyTabs.display', 'Affichage')}>
          <ToggleGroupItem value="calendar"><CalendarDays size={16} />{t('common.calendar', 'Calendrier')}</ToggleGroupItem>
          <ToggleGroupItem value="list"><List size={16} />{t('common.list', 'Liste')}</ToggleGroupItem>
        </ToggleGroup>
        {view === 'calendar' && <div className="pdt-toolbar__group">
          <Button size="sm" variant="ghost" onClick={() => { setMonth(today); setSelectedDay(today); }}>{t('common.today', 'Aujourd’hui')}</Button>
          <Button variant="ghost" size="icon-sm" aria-label={t('properties.interventions.prevMonth')} onClick={() => moveMonth(-1)}><ChevronLeft className="cn-rtl-flip" size={16} /></Button>
          <p>{formatMonthYear(month,currentLanguage)}</p>
          <Button variant="ghost" size="icon-sm" aria-label={t('properties.interventions.nextMonth')} onClick={() => moveMonth(1)}><ChevronRight className="cn-rtl-flip" size={16} /></Button>
        </div>}
      </div>
      {interventions.length === 0 ? <PropertyTabEmpty art={PROPERTY_ART.interventions} title={t('properties.noInterventions')} description={t('properties.interventions.emptyHint')} />
        : <div className="pdt-split">
          <div className="pdt-list">
            {view === 'calendar' ? <div className="pdt-calendar">
              {weekdayHeaders(currentLanguage, 'narrow').map((day,index) => <span key={index}>{day.label}</span>)}
              {cells.map(date => <button key={dateKey(date)} type="button" aria-label={date.toLocaleDateString(activeIntlLocale(),{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                aria-pressed={dateKey(date) === dateKey(selectedDay)} data-current={date.getMonth() === month.getMonth()} data-today={dateKey(date) === dateKey(today)} onClick={() => setSelectedDay(date)}>
                {date.getDate()}{byDay.has(dateKey(date)) && <small>{byDay.get(dateKey(date))!.length}</small>}
              </button>)}
            </div> : <>{rows(listItems)}<PagePagination page={currentPage} count={sorted.length} rowsPerPage={8} onPageChange={value => { setPage(value); setSelectedId(null); }} /></>}
          </div>
          <div className="pdt-detail">
            {view === 'calendar' ? <>
              <PropertyTabHeading art={PROPERTY_ART.calendar} title={selectedDay.toLocaleDateString(activeIntlLocale(),{weekday:'long',day:'numeric',month:'long'})} />
              {dayItems.length ? rows(dayItems) : <PropertyTabEmpty art={PROPERTY_ART.completed} title={t('properties.noInterventions')} description={t('properties.interventions.pickDay')} />}
            </> : selected && <>
              <PropertyTabHeading art={artwork(selected.type)} title={getInterventionTypeLabel(selected.type,t)} actions={<StatusIcon {...statusDetails(selected.status)} label={getInterventionStatusLabel(selected.status,t)} />} />
              {selected.description && <p className="pdt-copy mb-5">{selected.description}</p>}
              <dl className="pdt-facts">
                <div><dt>{t('common.date', 'Date')}</dt><dd>{new Date(selected.scheduledDate).toLocaleDateString(activeIntlLocale())}</dd></div>
                <div><dt>{t('propertyTabs.assignedTo', 'Intervenant')}</dt><dd>{selected.assignedTo || t('propertyTabs.unassigned', 'Non attribué')}</dd></div>
                <div><dt>{t('common.amount', 'Montant')}</dt><dd>{selected.cost != null ? <Money value={selected.cost} from="EUR" /> : '—'}</dd></div>
              </dl>
              <div className="pdt-detail__actions"><Button onClick={() => navigate('/interventions/' + selected.id)}><ExternalLink size={16} />{t('properties.interventions.viewDetail')}</Button></div>
            </>}
          </div>
        </div>}
    </section>
  </div>;
}
