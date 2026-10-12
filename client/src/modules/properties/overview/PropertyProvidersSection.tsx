import { Link } from 'react-router-dom';
import IllustratedHeading from '../../../components/IllustratedHeading';
import { useProviderCatalog } from '../../../hooks/useProviderCatalog';
import { useTranslation } from '../../../hooks/useTranslation';
import ProviderAvatar from '../../marketplace/ProviderAvatar';
import { PROPERTY_ART } from '../propertyArtwork';

const SHOWN = 5;

/**
 * Prestataires du catalogue dont le secteur couvre ce logement — même règle que
 * l'affectation. Chaque ligne mène à la fiche, dont la carte montre le secteur entier.
 */
export default function PropertyProvidersSection({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useProviderCatalog({ propertyId, size: SHOWN });
  const total = data?.totalElements ?? 0;

  return (
    <section className="pdo-section">
      <IllustratedHeading
        art={PROPERTY_ART.location}
        title={t('propertyWorkspace.overview.providers.title', 'Prestataires qui interviennent ici')}
        hint={t('propertyWorkspace.overview.providers.hint', 'Leur secteur d’intervention inclut ce logement.')}
      />
      {isLoading && <p className="pdo-empty">{t('common.loading', 'Chargement…')}</p>}
      {isError && <p role="alert" className="pdo-empty">{t('propertyWorkspace.overview.providers.error', 'La liste n’a pas pu être chargée.')}</p>}
      {data && total === 0 && (
        <p className="pdo-empty">{t('propertyWorkspace.overview.providers.empty', 'Aucun prestataire du catalogue ne couvre encore ce logement.')}</p>
      )}
      {data && total > 0 && (
        <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
          {data.items.map((provider) => (
            <li key={provider.id}>
              <Link to={`/prestataires/${provider.id}?propertyId=${propertyId}`}
                className="flex cursor-pointer items-center gap-3 rounded-md py-2 no-underline transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-[var(--bui-ring)]">
                <ProviderAvatar url={provider.avatarUrl} name={provider.displayName} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground" dir="auto">{provider.displayName}</span>
                  {provider.coverageCities.length > 0 && (
                    <span className="truncate text-xs text-muted-foreground" dir="auto">{provider.coverageCities.join(', ')}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > SHOWN && (
        <p className="pdo-empty tabular-nums">
          {t('propertyWorkspace.overview.providers.more', { count: total - SHOWN, defaultValue: '+ {{count}} autre(s) dans le catalogue' })}
        </p>
      )}
    </section>
  );
}
