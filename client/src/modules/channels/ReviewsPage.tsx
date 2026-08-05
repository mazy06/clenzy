import React, { useEffect, useState } from 'react';
import { Field, FieldLabel, NativeSelect, NativeSelectOption } from '../../components/ui';
import { Star as StarIcon } from '../../icons';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { propertiesApi, type Property } from '../../services/api/propertiesApi';
import ReviewList from './reviews/ReviewList';

/**
 * Écran global des avis voyageurs — tous logements, ou filtré sur l'un d'eux.
 *
 * <p>La liste elle-même vit dans {@link ReviewList}, partagé avec l'onglet
 * « Avis » de la fiche d'un logement : le filtre est un paramètre, pas un écran
 * différent. Cet écran n'ajoute que l'en-tête et le sélecteur.</p>
 *
 * <p><b>Source de données corrigée</b> : la page interrogeait
 * {@code /api/airbnb/reviews}, un endpoint qui n'existe PAS côté serveur — les
 * seuls avis réellement exposés le sont par {@code /api/reviews}
 * (ReviewController), multi-canal et porteur des statistiques, du brouillon de
 * l'agent Réputation et de la publication de la réponse d'hôte.</p>
 */
export default function ReviewsPage() {
  const { t } = useTranslation();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | ''>('');

  useEffect(() => {
    propertiesApi.getAll().then(setProperties).catch(() => {});
  }, []);

  return (
    <div className="flex w-full flex-1 flex-col gap-3">
      <PageHeader
        title={t('channels.reviews.title', 'Avis voyageurs')}
        subtitle={t('channels.reviews.subtitle', 'Tous canaux confondus')}
        iconBadge={<StarIcon />}
        showBackButton={false}
      />

      {/* Largeur figée : le `w-full` du kit étirerait le champ sur toute la page. */}
      <Field className="w-[240px]">
        <FieldLabel htmlFor="reviews-property-filter">
          {t('channels.reviews.filterByProperty', 'Filtrer par logement')}
        </FieldLabel>
        <NativeSelect
          id="reviews-property-filter"
          size="sm"
          className="w-full"
          value={selectedPropertyId}
          onChange={(e) => setSelectedPropertyId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <NativeSelectOption value="">{t('common.all', 'Tous')}</NativeSelectOption>
          {properties.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <ReviewList
        // key : changer de logement remonte une autre liste — on remonte le
        // composant pour repartir d'un état de réponse vierge.
        key={selectedPropertyId === '' ? 'all' : selectedPropertyId}
        propertyId={selectedPropertyId === '' ? undefined : selectedPropertyId}
        showStats
      />
    </div>
  );
}
