import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import { resolveAmenityIcon } from '../../settings/amenity-mapping/amenityIcons';
import { useAmenityIconOverrides } from '../../settings/amenity-mapping/useAmenityIconOverrides';
import { amenityTone, sortByAmenityCategory } from '../amenityCategories';
import ToneTileList from './ToneTileList';

/**
 * Équipements du logement avec les icônes de la bibliothèque de commodités
 * (Paramètres › Commodités). L'organisation peut choisir ses icônes ; sinon,
 * on prend celles de Baitly par défaut, comme sur l'écran de mapping OTA.
 * Chaque icône prend la couleur de sa famille (confort, cuisine…).
 */
export default function PropertyAmenities({ codes }: { codes: string[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { overrides } = useAmenityIconOverrides(user?.organizationId ?? null);

  return (
    <ToneTileList
      items={sortByAmenityCategory(codes).map((code) => ({
        key: code,
        icon: resolveAmenityIcon(code, overrides),
        tone: amenityTone(code),
        // Une commodité personnalisée n'a pas de traduction : son code reste lisible.
        label: t(`properties.amenities.items.${code}`, code),
      }))}
    />
  );
}
