import { useTranslation } from 'react-i18next';
import { Button, Skeleton } from '../../components/ui';
import { useProviderInvitation } from '../../hooks/useMarketplaceProviders';

/** L'envoi du courriel et l'activation de l'accès sont deux événements distincts. */
export default function ProviderInvitationStatus({ providerId }: { providerId: number }) {
  const { t, i18n } = useTranslation();
  const query = useProviderInvitation(providerId);
  const state = query.data;
  const dates = state ? [
    ['sent', state.sentAt],
    ['next', state.nextAttemptAt],
    ['expires', state.linkAvailable ? state.expiresAt : null],
  ] as const : [];

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="m-0 text-sm font-medium text-foreground [text-wrap:balance]">{t('marketplaceInvitation.title')}</h4>
        <Button variant="ghost" size="sm" disabled={query.isFetching}
          onClick={() => { void query.refetch(); }}>{t('marketplaceInvitation.refresh')}</Button>
      </div>
      {query.isPending ? <Skeleton className="h-16 w-full" /> : query.isError ? (
        <p role="alert" className="m-0 text-xs text-foreground">{t('marketplaceInvitation.error')}</p>
      ) : !state ? (
        <p className="m-0 text-xs text-muted-foreground">{t('marketplaceInvitation.empty')}</p>
      ) : (
        <>
          <div aria-live="polite">
            <p className="m-0 text-sm font-medium text-foreground">{t(`marketplaceInvitation.status.${state.status}`)}</p>
            <p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground">{t(`marketplaceInvitation.hint.${state.status}`)}</p>
          </div>
          {!state.linkAvailable && <p className="m-0 text-xs leading-relaxed text-muted-foreground">{t('marketplaceInvitation.unavailable')}</p>}
          <dl className="m-0 flex flex-col gap-1 text-xs">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">{t('marketplaceInvitation.attempts')}</dt>
              <dd className="m-0 tabular-nums">{state.attempts}</dd>
            </div>
            {dates.map(([label, value]) => value ? (
              <div key={label} className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">{t(`marketplaceInvitation.${label}`)}</dt>
                <dd className="m-0 tabular-nums"><time dateTime={value}>{new Date(value).toLocaleString(i18n.language)}</time></dd>
              </div>
            ) : null)}
          </dl>
        </>
      )}
    </section>
  );
}
