import React from 'react';
import { cn } from '../../../utils/cn';
import {
  Home as HomeIcon,
  SquareFoot as RulerIcon,
  People as UsersIcon,
  LocationCity as BuildingIcon,
  AutoAwesome as SparklesIcon,
  Description as FileTextIcon,
  RequestQuote as FilePenIcon,
  Check as CheckIcon,
  Refresh as RefreshIcon,
  DateRange as CalendarRangeIcon,
  Schedule as ClockIcon,
  Handyman as HandymanIcon,
  PriorityHigh as UrgencyIcon,
} from '../../../icons';
import type { ReceivedForm } from '../../../services/api/receivedFormsApi';
import { formatFieldValue, toList } from './formatters';

// ─── Primitives .fr-* (référence « Messagerie Formulaires », section B) ──────

/** .fr-sec — overline + filet. */
function FrSection({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-[9px] m-[26px 0 14px]">
      <span className="text-[11px] font-bold tracking-[.08em] uppercase text-[var(--faint)] whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-[1px] bg-[var(--line)]" />
    </div>
  );
}

/** .fr-tile — icône accent-soft 36 r11, label overline, valeur display 20. */
function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[var(--card)] border border-solid border-[var(--line)] rounded-[13px] p-[15px] min-w-0 transition-[border-color,box-shadow] duration-[140ms] hover:border-[var(--line-2)] hover:shadow-[0_8px_24px_-18px_var(--ink)]">
      <div className="w-[36px] h-[36px] rounded-[11px] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="cn-text-body1 text-[10.5px] font-bold tracking-[.04em] uppercase text-[var(--faint)]">
        {label}
      </p>
      <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[20px] font-semibold text-[var(--ink)] mt-[4px] tracking-[-.01em] tabular-nums truncate">
        {value}
      </p>
    </div>
  );
}

/** .fr-svc__h — entête de colonne services. */
function SvcHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-[8px] mb-[10px] text-[11px] font-bold tracking-[.04em] uppercase text-[var(--muted)] [&_svg]:text-[var(--accent)]">
      {icon}
      {label}
    </div>
  );
}

/** .fr-chip — field par défaut, accent-soft pour « sur devis », muted pour vide. */
function ServiceChip({ icon, label, variant = 'default' }: {
  icon?: React.ReactNode; label: string; variant?: 'default' | 'devis' | 'muted';
}) {
  return (
    <span className={cn(
      'inline-flex items-center gap-[7px] text-[12.5px] font-semibold rounded-[9px] p-[7px_12px] border border-solid',
      '[&_svg]:text-[var(--accent)] [&_svg]:shrink-0',
      variant === 'devis'
        ? 'bg-[var(--accent-soft)] border-transparent text-[var(--accent)]'
        : cn(
            'bg-[var(--field)] border-[var(--field-line)]',
            variant === 'muted' ? 'text-[var(--muted)]' : 'text-[var(--ink)]',
          ),
    )}>
      {icon}
      {label}
    </span>
  );
}

/** .fr-sync — ligne synchro calendrier ok-soft. */
function SyncRow({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-[10px] bg-[var(--ok-soft)] rounded-[11px] p-[11px_14px] mt-[14px] text-[13px] text-[var(--body)] [&>svg]:text-[var(--ok)] [&>svg]:shrink-0">
      <RefreshIcon size={16} strokeWidth={1.75} />
      <b className="text-[13px] text-[var(--ink)] font-semibold">
        Synchronisation calendrier
      </b>
      <span className="ms-auto text-[11px] font-bold text-[var(--ok)]">
        {value}
      </span>
    </div>
  );
}

/** .fr-pcard — carte planning (icône 40 r12 accent-soft, label overline, valeur 14.5). */
function PlanCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-[13px] bg-[var(--card)] border border-solid border-[var(--line)] rounded-[13px] p-[14px 16px] min-w-0">
      <div className="w-[40px] h-[40px] rounded-[12px] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="cn-text-body1 text-[11px] font-bold tracking-[.04em] uppercase text-[var(--faint)]">
          {label}
        </p>
        <p className="cn-text-body1 text-[14.5px] font-semibold text-[var(--ink)] mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}

/** Paragraphe libre (description / message). */
function BodyText({ text }: { text: string }) {
  return (
    <p className="cn-text-body1 text-[13px] text-[var(--body)] leading-[1.6] whitespace-pre-wrap">
      {text}
    </p>
  );
}

// ─── Sections par type de formulaire ─────────────────────────────────────────

function DevisSections({ data }: { data: Record<string, unknown> }) {
  const has = (k: string) => {
    const v = data[k];
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
  };

  const tiles: { key: string; icon: React.ReactNode; label: string; value: string }[] = [];
  if (has('propertyType')) tiles.push({ key: 'propertyType', icon: <HomeIcon size={18} strokeWidth={1.75} />, label: 'Type de bien', value: formatFieldValue('propertyType', data.propertyType) });
  if (has('surface')) tiles.push({ key: 'surface', icon: <RulerIcon size={18} strokeWidth={1.75} />, label: 'Surface', value: `${data.surface} m²` });
  if (has('guestCapacity')) tiles.push({ key: 'guestCapacity', icon: <UsersIcon size={18} strokeWidth={1.75} />, label: 'Voyageurs', value: formatFieldValue('guestCapacity', data.guestCapacity) });
  if (has('propertyCount')) tiles.push({ key: 'propertyCount', icon: <BuildingIcon size={18} strokeWidth={1.75} />, label: 'Logements', value: String(data.propertyCount) });

  const forfait = toList(data.services);
  const devis = toList(data.servicesDevis);
  const hasServices = forfait.length > 0 || devis.length > 0;

  return (
    <>
      {tiles.length > 0 && (
        <>
          <FrSection title="Aperçu du bien" />
          <div className="grid grid-cols-[repeat(2,_1fr)] min-[900px]:grid-cols-[repeat(4,_1fr)] gap-3">
            {tiles.map((t) => <Tile key={t.key} icon={t.icon} label={t.label} value={t.value} />)}
          </div>
        </>
      )}

      {hasServices && (
        <>
          <FrSection title="Services souhaités" />
          <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[repeat(2,_1fr)] gap-[18px]">
            <div>
              <SvcHeader icon={<SparklesIcon size={15} strokeWidth={1.75} />} label="Services forfait" />
              <div className="flex flex-wrap gap-2">
                {forfait.length > 0
                  ? forfait.map((s) => (
                      <ServiceChip key={s} icon={<CheckIcon size={14} strokeWidth={2} />} label={formatFieldValue('services', s)} />
                    ))
                  : <ServiceChip variant="muted" label="Aucun" />}
              </div>
            </div>
            <div>
              <SvcHeader icon={<FileTextIcon size={15} strokeWidth={1.75} />} label="Services sur devis" />
              <div className="flex flex-wrap gap-2">
                {devis.length > 0
                  ? devis.map((s) => (
                      <ServiceChip key={s} variant="devis" icon={<FilePenIcon size={14} strokeWidth={2} />} label={formatFieldValue('servicesDevis', s)} />
                    ))
                  : <ServiceChip variant="muted" label="Aucun" />}
              </div>
            </div>
          </div>
        </>
      )}
      {has('calendarSync') && <SyncRow value={formatFieldValue('calendarSync', data.calendarSync)} />}

      {(has('bookingFrequency') || has('cleaningSchedule')) && (
        <>
          <FrSection title="Planning" />
          <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[repeat(2,_1fr)] gap-3.5">
            {has('bookingFrequency') && (
              <PlanCard
                icon={<CalendarRangeIcon size={19} strokeWidth={1.75} />}
                label="Fréquence des réservations"
                value={formatFieldValue('bookingFrequency', data.bookingFrequency)}
              />
            )}
            {has('cleaningSchedule') && (
              <PlanCard
                icon={<ClockIcon size={19} strokeWidth={1.75} />}
                label="Planning ménage"
                value={formatFieldValue('cleaningSchedule', data.cleaningSchedule)}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}

function MaintenanceSections({ data }: { data: Record<string, unknown> }) {
  const works = toList(data.selectedWorks);
  const description = (data.customNeed as string) || (data.description as string) || '';
  const hasUrgency = data.urgency != null && data.urgency !== '';

  return (
    <>
      {works.length > 0 && (
        <>
          <FrSection title="Travaux demandés" />
          <div className="flex flex-wrap gap-2">
            {works.map((w) => (
              <ServiceChip key={w} icon={<HandymanIcon size={14} strokeWidth={2} />} label={formatFieldValue('selectedWorks', w)} />
            ))}
          </div>
        </>
      )}

      {hasUrgency && (
        <>
          <FrSection title="Urgence" />
          <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[repeat(2,_1fr)] gap-3.5">
            <PlanCard
              icon={<UrgencyIcon size={19} strokeWidth={1.75} />}
              label="Niveau d'urgence"
              value={formatFieldValue('urgency', data.urgency)}
            />
          </div>
        </>
      )}

      {description && (
        <>
          <FrSection title="Description" />
          <BodyText text={description} />
        </>
      )}
    </>
  );
}

function SupportSections({ data }: { data: Record<string, unknown> }) {
  const subject = data.subject as string | undefined;
  const message = data.message as string | undefined;
  return (
    <>
      {subject && (
        <>
          <FrSection title="Sujet" />
          <BodyText text={subject} />
        </>
      )}
      {message && (
        <>
          <FrSection title="Message" />
          <BodyText text={message} />
        </>
      )}
    </>
  );
}

// ─── Entrée publique ─────────────────────────────────────────────────────────

/** Rend les sections du détail à partir du payload JSON du formulaire. */
export default function FormPayloadSections({ form }: { form: ReceivedForm }) {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(form.payload);
  } catch {
    return (
      <p className="cn-text-body1 text-[13px] text-[var(--muted)] mt-5">
        Données non lisibles
      </p>
    );
  }

  if (form.formType === 'DEVIS') return <DevisSections data={data} />;
  if (form.formType === 'MAINTENANCE') return <MaintenanceSections data={data} />;
  if (form.formType === 'SUPPORT') return <SupportSections data={data} />;
  return null;
}
