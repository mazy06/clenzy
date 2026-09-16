import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/baitly/StatusChip';
import { Button, Card, Skeleton } from '../../components/ui';
import { ArrowBack, Language, LocationOn, PersonSearch, RequestQuote, Verified } from '../../icons';
import ProviderAvatar from '../marketplace/ProviderAvatar';
import QuoteRequestDialog from '../quotes/QuoteRequestDialog';
import {
  categoryIcon,
  formatOfferPrice,
  languageName,
  PAYER_LABELS,
  RECURRENCE_LABELS,
} from '../marketplace/providerPresentation';
import { useCatalogCategories, useCatalogProvider } from '../../hooks/useProviderCatalog';
import type { ProviderOfferDto } from '../../services/api/marketplaceProvidersApi';
import { useQuoteReplacement } from '../../hooks/useQuoteReplacement';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * La fiche d'un prestataire, vue par une organisation.
 *
 * <p>Ce qui n'y figure pas est délibéré : ni coordonnées, ni état de
 * modération, ni note interne. La mise en relation passera par une demande de
 * devis tracée — un catalogue qui donnerait l'adresse de chacun serait un
 * annuaire de prospection.</p>
 */
export default function ProviderCatalogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const replacementId = searchParams.get('replaceQuoteId');
  const replacement = useQuoteReplacement(replacementId);
  const back = replacementId ? `/prestataires?replaceQuoteId=${encodeURIComponent(replacementId)}` : '/prestataires';
  const providerId = id ? Number(id) : undefined;

  const { data: provider, isLoading, isError } = useCatalogProvider(providerId);
  const [requestOpen, setRequestOpen] = useState(false);
  const { data: categories } = useCatalogCategories();

  const categoryLabels = useMemo(
    () => new Map((categories ?? []).map((c) => [c.code, c])),
    [categories],
  );

  const offersByCategory = useMemo(() => {
    const map = new Map<string, ProviderOfferDto[]>();
    (provider?.offers ?? []).forEach((offer) => {
      const list = map.get(offer.categoryCode) ?? [];
      list.push(offer);
      map.set(offer.categoryCode, list);
    });
    return [...map.entries()];
  }, [provider]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full shrink-0 rounded-xl" />
        <Skeleton className="h-64 w-full shrink-0 rounded-xl" />
      </div>
    );
  }

  // 404 côté serveur quand la fiche est masquée : l'écran ne distingue pas
  // « n'existe pas » de « ne vous est pas proposé », et c'est voulu.
  if (isError || !provider) {
    return (
      <EmptyState
        icon={<PersonSearch />}
        title="Prestataire introuvable"
        description="Cette fiche n'existe pas ou n'est pas proposée à votre organisation."
        action={
          <Button size="sm" variant="outline" onClick={() => navigate(back)}>
            Retour au catalogue
          </Button>
        }
      />
    );
  }

  const cities = provider.coverageCities.length > 0
    ? provider.coverageCities
    : [];

  return (
    <>
      <PageHeader
        title={provider.displayName}
        subtitle={provider.headline}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate(back)}>
            <ArrowBack />
            Catalogue
          </Button>
        }
      />

      <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <Card className="shrink-0 gap-0 px-4 py-4">
            <div className="flex items-start gap-4">
              <ProviderAvatar name={provider.displayName} url={provider.avatarUrl} size="lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="m-0 text-base font-semibold text-foreground">
                    {provider.displayName}
                  </h2>
                  {provider.verified && (
                    <StatusChip size="sm" tone="ok" label="Vérifié par Baitly" />
                  )}
                  {provider.acceptsUrgent && (
                    <StatusChip size="sm" tone="warn" label="Accepte l'urgence" />
                  )}
                  {provider.own && <StatusChip size="sm" tone="accent" label="Votre fiche" />}
                </div>
                {provider.bio && (
                  <p className="m-0 mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {provider.bio}
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="shrink-0 gap-0 px-0 py-0">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Prestations et tarifs
              </h2>
            </div>
            <div className="px-4 py-3.5">
              {offersByCategory.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">
                  Aucune prestation déclarée pour le moment.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {offersByCategory.map(([code, offers]) => (
                    <div key={code}>
                      <h3 className="m-0 mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground [&>svg]:size-4 [&>svg]:text-primary">
                        {categoryIcon(categoryLabels.get(code)?.iconKey)}
                        {categoryLabels.get(code)?.labelFr ?? offers[0]?.categoryLabelFr ?? code}
                      </h3>
                      <ul className="m-0 flex list-none flex-col p-0">
                        {offers.map((offer) => (
                          <li
                            key={offer.id}
                            className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <p className="m-0 text-sm text-foreground">{offer.label}</p>
                              {offer.description && (
                                <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                                  {offer.description}
                                </p>
                              )}
                              {(offer.recurrence || offer.payer) && (
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  {offer.recurrence && (
                                    <StatusChip size="sm" tone="neutral"
                                      label={RECURRENCE_LABELS[offer.recurrence]} />
                                  )}
                                  {offer.payer && (
                                    <StatusChip size="sm"
                                      tone={offer.payer === 'GUEST' ? 'info' : 'neutral'}
                                      label={`Payé par ${PAYER_LABELS[offer.payer].toLowerCase()}`} />
                                  )}
                                </div>
                              )}
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                              {formatOfferPrice(offer.amount, offer.currency,
                                offer.pricingModel, offer.unitLabel)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <Card className="shrink-0 gap-0 px-4 py-3.5">
            <h2 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Où il intervient
            </h2>
            {cities.length > 0 ? (
              <p className="m-0 flex items-start gap-1.5 text-sm text-foreground [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-primary">
                <LocationOn />
                <span>
                  {cities.join(' · ')}

                </span>
              </p>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">Zone non précisée.</p>
            )}

            {provider.languages.length > 0 && (
              <p className="m-0 mt-2.5 flex items-start gap-1.5 text-sm text-foreground [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-primary">
                <Language />
                <span>{provider.languages.map(languageName).join(' · ')}</span>
              </p>
            )}
          </Card>

          <Card className="shrink-0 gap-0 px-4 py-3.5">
            <h2 className="m-0 mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Entrer en relation
            </h2>
            {/* Pas de téléphone, pas d'adresse : la mise en relation passe par
                une demande de devis tracée, où les deux parties savent qui a
                contacté qui. Le dire plutôt que laisser chercher. */}
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">
              {provider.own
                ? "C'est votre propre fiche : créez directement une intervention."
                : 'Les coordonnées ne sont pas publiées. Votre demande lui est transmise par Baitly, et vous restez libre d’accepter le montant proposé.'}
            </p>
            {!provider.own && (
              <Button size="sm" className="mt-3 w-fit" disabled={!!replacementId && (replacement.isError || !replacement.data || !!replacement.data.activeRequestId)} onClick={() => setRequestOpen(true)}>
                <RequestQuote />
                Demander un devis
              </Button>
            )}
            {replacementId && <p role={replacement.isError ? 'alert' : 'status'} className="mt-2 text-sm text-muted-foreground">
              {t(replacement.isError ? 'quoteReplacement.loadFailed' : replacement.data?.activeRequestId ? 'quoteReplacement.existing' : 'quoteReplacement.help',
                { id: replacement.data?.activeRequestId ?? replacementId })}
            </p>}
            {replacement.data?.activeRequestId && <a href="/devis" className="cursor-pointer text-sm underline focus-visible:outline-2">{t('quoteReplacement.viewRequests')}</a>}
          </Card>
        </div>
      </div>

      {(!replacementId || (!replacement.isError && replacement.data)) && <QuoteRequestDialog
        key={`${provider.id}:${replacementId ?? 'new'}`}
        replacement={replacementId ? replacement.data : undefined}
        provider={provider}
        initialPropertyId={searchParams.get("propertyId") ?? ""}
        open={requestOpen}
        onOpenChange={setRequestOpen}
      />}
    </>
  );
}
