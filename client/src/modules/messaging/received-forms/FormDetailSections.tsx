import React from 'react';
import { Box, Typography } from '@mui/material';
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '9px', m: '26px 0 14px' }}>
      <Typography component="span" sx={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '.08em',
        textTransform: 'uppercase', color: 'var(--faint)', whiteSpace: 'nowrap',
      }}>
        {title}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'var(--line)' }} />
    </Box>
  );
}

/** .fr-tile — icône accent-soft 36 r11, label overline, valeur display 20. */
function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box sx={{
      bgcolor: 'var(--card)', border: '1px solid var(--line)', borderRadius: '13px', p: '15px',
      minWidth: 0, transition: 'border-color .14s, box-shadow .14s',
      '&:hover': { borderColor: 'var(--line-2)', boxShadow: '0 8px 24px -18px var(--ink)' },
    }}>
      <Box sx={{
        width: 36, height: 36, borderRadius: '11px', bgcolor: 'var(--accent-soft)', color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '12px',
      }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>
        {label}
      </Typography>
      <Typography sx={{
        fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, color: 'var(--ink)',
        mt: '4px', letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </Typography>
    </Box>
  );
}

/** .fr-svc__h — entête de colonne services. */
function SvcHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: '8px', mb: '10px',
      fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)',
      '& svg': { color: 'var(--accent)' },
    }}>
      {icon}
      {label}
    </Box>
  );
}

/** .fr-chip — field par défaut, accent-soft pour « sur devis », muted pour vide. */
function ServiceChip({ icon, label, variant = 'default' }: {
  icon?: React.ReactNode; label: string; variant?: 'default' | 'devis' | 'muted';
}) {
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: '7px',
      fontSize: '12.5px', fontWeight: 600, borderRadius: '9px', p: '7px 12px',
      ...(variant === 'devis'
        ? { bgcolor: 'var(--accent-soft)', border: '1px solid transparent', color: 'var(--accent)' }
        : {
            bgcolor: 'var(--field)', border: '1px solid var(--field-line)',
            color: variant === 'muted' ? 'var(--muted)' : 'var(--ink)',
          }),
      '& svg': { color: 'var(--accent)', flexShrink: 0 },
    }}>
      {icon}
      {label}
    </Box>
  );
}

/** .fr-sync — ligne synchro calendrier ok-soft. */
function SyncRow({ value }: { value: string }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: '10px', bgcolor: 'var(--ok-soft)',
      borderRadius: '11px', p: '11px 14px', mt: '14px', fontSize: '13px', color: 'var(--body)',
      '& > svg': { color: 'var(--ok)', flexShrink: 0 },
    }}>
      <RefreshIcon size={16} strokeWidth={1.75} />
      <Typography component="b" sx={{ fontSize: '13px', color: 'var(--ink)', fontWeight: 600 }}>
        Synchronisation calendrier
      </Typography>
      <Typography component="span" sx={{ ml: 'auto', fontSize: '11px', fontWeight: 700, color: 'var(--ok)' }}>
        {value}
      </Typography>
    </Box>
  );
}

/** .fr-pcard — carte planning (icône 40 r12 accent-soft, label overline, valeur 14.5). */
function PlanCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: '13px', bgcolor: 'var(--card)',
      border: '1px solid var(--line)', borderRadius: '13px', p: '14px 16px', minWidth: 0,
    }}>
      <Box sx={{
        width: 40, height: 40, borderRadius: '12px', bgcolor: 'var(--accent-soft)', color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--ink)', mt: '2px' }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

/** Paragraphe libre (description / message). */
function BodyText({ text }: { text: string }) {
  return (
    <Typography sx={{ fontSize: '13px', color: 'var(--body)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
      {text}
    </Typography>
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
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: '12px' }}>
            {tiles.map((t) => <Tile key={t.key} icon={t.icon} label={t.label} value={t.value} />)}
          </Box>
        </>
      )}

      {hasServices && (
        <>
          <FrSection title="Services souhaités" />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: '18px' }}>
            <Box>
              <SvcHeader icon={<SparklesIcon size={15} strokeWidth={1.75} />} label="Services forfait" />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {forfait.length > 0
                  ? forfait.map((s) => (
                      <ServiceChip key={s} icon={<CheckIcon size={14} strokeWidth={2} />} label={formatFieldValue('services', s)} />
                    ))
                  : <ServiceChip variant="muted" label="Aucun" />}
              </Box>
            </Box>
            <Box>
              <SvcHeader icon={<FileTextIcon size={15} strokeWidth={1.75} />} label="Services sur devis" />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {devis.length > 0
                  ? devis.map((s) => (
                      <ServiceChip key={s} variant="devis" icon={<FilePenIcon size={14} strokeWidth={2} />} label={formatFieldValue('servicesDevis', s)} />
                    ))
                  : <ServiceChip variant="muted" label="Aucun" />}
              </Box>
            </Box>
          </Box>
        </>
      )}
      {has('calendarSync') && <SyncRow value={formatFieldValue('calendarSync', data.calendarSync)} />}

      {(has('bookingFrequency') || has('cleaningSchedule')) && (
        <>
          <FrSection title="Planning" />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: '14px' }}>
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
          </Box>
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
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {works.map((w) => (
              <ServiceChip key={w} icon={<HandymanIcon size={14} strokeWidth={2} />} label={formatFieldValue('selectedWorks', w)} />
            ))}
          </Box>
        </>
      )}

      {hasUrgency && (
        <>
          <FrSection title="Urgence" />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: '14px' }}>
            <PlanCard
              icon={<UrgencyIcon size={19} strokeWidth={1.75} />}
              label="Niveau d'urgence"
              value={formatFieldValue('urgency', data.urgency)}
            />
          </Box>
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
      <Typography sx={{ fontSize: '13px', color: 'var(--muted)', mt: '20px' }}>
        Données non lisibles
      </Typography>
    );
  }

  if (form.formType === 'DEVIS') return <DevisSections data={data} />;
  if (form.formType === 'MAINTENANCE') return <MaintenanceSections data={data} />;
  if (form.formType === 'SUPPORT') return <SupportSections data={data} />;
  return null;
}
