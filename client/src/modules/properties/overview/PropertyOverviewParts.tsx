import React from 'react';
import { LogIn, LogOut, SquarePen } from '../../../icons/glyphs';
import { Button } from '../../../components/ui';
import IllustratedHeading from '../../../components/IllustratedHeading';
import { useTranslation } from '../../../hooks/useTranslation';
import type { PropertyDetailsData } from '../../../hooks/usePropertyDetails';
import { formatDate } from '../../../utils/formatUtils';
import { PROPERTY_ART } from '../propertyArtwork';

export interface Fact {
  label: string;
  value: React.ReactNode;
}

/** Libellé à gauche, valeur à droite, filet entre deux lignes. */
export function Facts({ items }: { items: Fact[] }) {
  if (!items.length) return null;
  return (
    <dl className="pdo-facts">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Un texte long (consigne, règlement) sous son libellé. */
export function LongText({ label, text }: { label: string; text: string }) {
  return (
    <div className="pdo-text">
      <span className="pdo-sublabel">{label}</span>
      <p dir="auto">{text}</p>
    </div>
  );
}

const time = (value?: string) => (value ? value.substring(0, 5) : '');

/**
 * Ce que le voyageur doit savoir pour arriver et repartir : horaires,
 * accès, wifi, consignes. Lu ici, modifié dans l'onglet dédié.
 */
export function AccessSection({ property: p, onEdit }: { property: PropertyDetailsData; onEdit?: () => void }) {
  const { t } = useTranslation();
  const ci = p.checkInInstructions;
  const facts: Fact[] = [
    { label: t('channels.checkIn.accessCode'), value: ci?.accessCode },
    { label: t('channels.checkIn.wifiName'), value: ci?.wifiName },
    { label: t('channels.checkIn.wifiPassword'), value: ci?.wifiPassword },
    { label: t('channels.checkIn.parkingInfo'), value: ci?.parkingInfo },
  ].filter((fact) => !!fact.value);
  const texts = [
    { label: t('channels.checkIn.arrivalInstructions'), text: ci?.arrivalInstructions },
    { label: t('channels.checkIn.departureInstructions'), text: ci?.departureInstructions },
    { label: t('channels.checkIn.houseRules'), text: ci?.houseRules },
    { label: t('channels.checkIn.emergencyContact'), text: ci?.emergencyContact },
    { label: t('propertyWorkspace.overview.access.notes'), text: ci?.additionalNotes },
  ].filter((entry): entry is { label: string; text: string } => !!entry.text);
  const hasTimes = !!(p.defaultCheckInTime || p.defaultCheckOutTime);

  return (
    <section className="pdo-section">
      <IllustratedHeading
        art={PROPERTY_ART.access}
        title={t('propertyWorkspace.overview.access.title')}
        hint={t('propertyWorkspace.overview.access.hint')}
        action={onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <SquarePen size={15} />
            {t('properties.modify')}
          </Button>
        )}
      />
      {hasTimes && (
        <div className="pdo-times">
          <div>
            <LogIn size={16} aria-hidden="true" />
            <span>{t('properties.checkInTime')}</span>
            <strong>{time(p.defaultCheckInTime) || '—'}</strong>
          </div>
          <div>
            <LogOut size={16} aria-hidden="true" className="cn-rtl-flip" />
            <span>{t('properties.checkOutTime')}</span>
            <strong>{time(p.defaultCheckOutTime) || '—'}</strong>
          </div>
        </div>
      )}
      <Facts items={facts} />
      {texts.map((entry) => <LongText key={entry.label} label={entry.label} text={entry.text} />)}
      {!facts.length && !texts.length && <p className="pdo-empty">{t('propertyWorkspace.overview.access.empty')}</p>}
    </section>
  );
}

/** Qui possède le logement et depuis quand il est suivi. */
export function ManagementSection({ property: p }: { property: PropertyDetailsData }) {
  const { t } = useTranslation();
  const facts: Fact[] = [
    ...(p.ownerName ? [{ label: t('properties.owner'), value: p.ownerName }] : []),
    ...(p.createdAt ? [{ label: t('properties.createdAt'), value: formatDate(p.createdAt) }] : []),
    ...(p.updatedAt ? [{ label: t('propertyWorkspace.overview.management.updatedAt'), value: formatDate(p.updatedAt) }] : []),
  ];
  if (!facts.length) return null;
  return (
    <section className="pdo-section">
      <IllustratedHeading
        art={PROPERTY_ART.management}
        title={t('propertyWorkspace.overview.management.title')}
        hint={t('propertyWorkspace.overview.management.hint')}
      />
      <Facts items={facts} />
    </section>
  );
}
