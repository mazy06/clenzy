import React from 'react';
import { Badge, Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '../../../components/ui';
import StatTile from '../../../components/baitly/StatTile';
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

// ─── Primitives de section ───────────────────────────────────────────────────

/**
 * Titre de section.
 *
 * <p>Un vrai titre, et non l'ancienne « sur-ligne + filet horizontal » : le
 * filet ajoutait une ligne de bruit tous les trois éléments et hachait la
 * lecture d'une fiche déjà dense. La hiérarchie passe par la taille et
 * l'espacement.</p>
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Service demandé.
 *
 * <p>Le « sur devis » se distingue par la TEINTE (ambre) et non par une icône
 * différente : c'est une information de coût, pas de nature. L'opérateur doit
 * repérer d'un balayage ce qui reste à chiffrer.</p>
 */
function ServiceChip({ label, variant = 'default' }: {
  label: string;
  variant?: 'default' | 'devis' | 'muted';
}) {
  if (variant === 'muted') {
    return <Badge variant="secondary" className="text-muted-foreground">{label}</Badge>;
  }
  return (
    <Badge variant={variant === 'devis' ? 'warning' : 'secondary'}>
      {variant === 'devis' ? <FilePenIcon size={12} strokeWidth={2} /> : <CheckIcon size={12} strokeWidth={2} />}
      {label}
    </Badge>
  );
}

/** Carte de planning — primitive Item partagée, plutôt qu'une carte maison. */
function PlanCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">{icon}</ItemMedia>
      <ItemContent>
        <ItemDescription>{label}</ItemDescription>
        <ItemTitle>{value}</ItemTitle>
      </ItemContent>
    </Item>
  );
}

/** Paragraphe libre (description / message). */
function BodyText({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{text}</p>;
}

// ─── Sections par type de formulaire ─────────────────────────────────────────

function DevisSections({ data }: { data: Record<string, unknown> }) {
  const has = (k: string) => {
    const v = data[k];
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
  };

  const tiles: { key: string; icon: React.ReactNode; label: string; value: string; unit?: string }[] = [];
  if (has('propertyType')) tiles.push({ key: 'propertyType', icon: <HomeIcon />, label: 'Type de bien', value: formatFieldValue('propertyType', data.propertyType) });
  if (has('surface')) tiles.push({ key: 'surface', icon: <RulerIcon />, label: 'Surface', value: String(data.surface), unit: 'm²' });
  if (has('guestCapacity')) tiles.push({ key: 'guestCapacity', icon: <UsersIcon />, label: 'Voyageurs', value: formatFieldValue('guestCapacity', data.guestCapacity) });
  if (has('propertyCount')) tiles.push({ key: 'propertyCount', icon: <BuildingIcon />, label: 'Logements', value: String(data.propertyCount) });

  const forfait = toList(data.services);
  const devis = toList(data.servicesDevis);
  const hasServices = forfait.length > 0 || devis.length > 0;

  return (
    <>
      {tiles.length > 0 && (
        <Section title="Aperçu du bien">
          <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
            {tiles.map((tile) => (
              <StatTile key={tile.key} icon={tile.icon} label={tile.label} value={tile.value} unit={tile.unit} />
            ))}
          </div>
        </Section>
      )}

      {hasServices && (
        <Section title="Services souhaités">
          <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <SparklesIcon size={14} strokeWidth={1.75} className="text-primary" />
                Services forfait
              </span>
              <div className="flex flex-wrap gap-1.5">
                {forfait.length > 0
                  ? forfait.map((s) => <ServiceChip key={s} label={formatFieldValue('services', s)} />)
                  : <ServiceChip variant="muted" label="Aucun" />}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileTextIcon size={14} strokeWidth={1.75} className="text-primary" />
                Services sur devis
              </span>
              <div className="flex flex-wrap gap-1.5">
                {devis.length > 0
                  ? devis.map((s) => <ServiceChip key={s} variant="devis" label={formatFieldValue('servicesDevis', s)} />)
                  : <ServiceChip variant="muted" label="Aucun" />}
              </div>
            </div>
          </div>
        </Section>
      )}

      {(has('calendarSync') || has('bookingFrequency') || has('cleaningSchedule')) && (
        <Section title="Planning">
          <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
            {has('bookingFrequency') && (
              <PlanCard
                icon={<CalendarRangeIcon />}
                label="Fréquence des réservations"
                value={formatFieldValue('bookingFrequency', data.bookingFrequency)}
              />
            )}
            {has('cleaningSchedule') && (
              <PlanCard
                icon={<ClockIcon />}
                label="Planning ménage"
                value={formatFieldValue('cleaningSchedule', data.cleaningSchedule)}
              />
            )}
            {/* La synchro calendrier rejoint le Planning : c'en est une donnée,
                pas un bandeau d'état. Elle occupait seule une bande verte pleine
                largeur qui criait plus fort que les chiffres du bien. */}
            {has('calendarSync') && (
              <PlanCard
                icon={<RefreshIcon />}
                label="Synchronisation calendrier"
                value={formatFieldValue('calendarSync', data.calendarSync)}
              />
            )}
          </div>
        </Section>
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
        <Section title="Travaux demandés">
          <div className="flex flex-wrap gap-1.5">
            {works.map((w) => (
              <Badge key={w} variant="secondary">
                <HandymanIcon size={12} strokeWidth={2} />
                {formatFieldValue('selectedWorks', w)}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {hasUrgency && (
        <Section title="Urgence">
          <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
            <PlanCard
              icon={<UrgencyIcon />}
              label="Niveau d'urgence"
              value={formatFieldValue('urgency', data.urgency)}
            />
          </div>
        </Section>
      )}

      {description && (
        <Section title="Description">
          <BodyText text={description} />
        </Section>
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
        <Section title="Sujet">
          <BodyText text={subject} />
        </Section>
      )}
      {message && (
        <Section title="Message">
          <BodyText text={message} />
        </Section>
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
    return <p className="text-sm text-muted-foreground">Données non lisibles</p>;
  }

  if (form.formType === 'DEVIS') return <DevisSections data={data} />;
  if (form.formType === 'MAINTENANCE') return <MaintenanceSections data={data} />;
  if (form.formType === 'SUPPORT') return <SupportSections data={data} />;
  return null;
}
