import { Link } from "react-router-dom";
import PagePagination from "../../components/PagePagination";
import { useState } from 'react';
import { useUserPreference } from '../../hooks/useUserPreference';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { quoteRequestsApi } from '../../services/api/quoteRequestsApi';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { Button, Skeleton, Textarea } from '../../components/ui';
import { RequestQuote } from '../../icons';
import QuoteCard from './QuoteCard';
import { PROVIDER_FILTERS } from './quotePresentation';
import { useQuoteTransition, useReceivedQuotes } from '../../hooks/useQuoteRequests';
import type { QuoteRequestDto } from '../../services/api/quoteRequestsApi';

/**
 * L'espace prestataire : ce qui m'est adressé.
 *
 * <p>Réservé aux comptes rattachés à une fiche. Un compte qui n'en a pas reçoit
 * un refus du serveur — l'écran le dit plutôt que d'afficher une liste vide,
 * qui se lirait comme « personne ne vous a sollicité ».</p>
 */
export default function ReceivedQuotesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [storedFilter, setFilterIndex] = useUserPreference<number>('marketplace.provider.filter', 1);
  const filterIndex = [0, 1, 2, 3].includes(storedFilter) ? storedFilter : 1; // « À chiffrer » d'abord
  const [page, setPage] = useState(0);
  const [answeringId, setAnsweringId] = useState<number | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState("EUR");
  const [validUntil, setValidUntil] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [teamChoice, setTeamChoice] = useState<string | undefined>();
  const { data: teamChoices, isError: teamError } = useQuery({
    queryKey: ['quote-requests', 'teams', answeringId, user?.id, user?.organizationId],
    queryFn: () => quoteRequestsApi.teams(answeringId!),
    enabled: answeringId != null && !!user,
    retry: false,
  });
  const selectedTeam = teamChoice ?? teamChoices?.selectedTeamId?.toString() ?? '';

  const filter = PROVIDER_FILTERS[filterIndex];
  const { data, isLoading, isError, error } = useReceivedQuotes(filter.statuses, page);
  const transition = useQuoteTransition();

  const noProviderAccount = (error as { status?: number } | null)?.status === 403;

  const resetAnswer = () => {
    setAnsweringId(null); setAmount(''); setValidUntil(''); setMessage('');
    setTeamChoice(undefined);
  };

  const actionsFor = (quote: QuoteRequestDto) => {
    if (quote.status !== 'SENT') return null;
    return (
      <>
        <Button size="sm" disabled={transition.isPending} onClick={() => { resetAnswer(); setDecliningId(null); setAnsweringId(quote.id); }}>
          {t('marketplaceQuotes.quote')}
        </Button>
        <Button size="sm" variant="outline"
          disabled={transition.isPending}
          onClick={() => { resetAnswer(); setDecliningId(quote.id); setReason(''); }}>
          {t('marketplaceQuotes.turnDown')}
        </Button>
      </>
    );
  };

  if (noProviderAccount) {
    return (
      <>
        <PageHeader title={t('marketplaceQuotes.received')} />
        <div className="mt-4 shrink-0">
          <EmptyState
            icon={<RequestQuote />}
            title={t('marketplaceQuotes.noProfile')}
            description={t('marketplaceQuotes.noProfileHelp')}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        actions={<Button variant="outline" size="sm" asChild><Link to="/devis">{t('marketplaceQuotes.sent')}</Link></Button>}
        title={t('marketplaceQuotes.received')}
        subtitle={t('marketplaceQuotes.receivedHelp')}
      />

      <div className="flex shrink-0 flex-wrap gap-2">
        {PROVIDER_FILTERS.map((option, index) => (
          <Button
            key={t('marketplaceQuotes.' + ["all", "toQuote", "waitingClient", "accepted"][index])}
            size="sm"
            variant={index === filterIndex ? 'default' : 'outline'}
            aria-pressed={index === filterIndex}
            onClick={() => { setFilterIndex(index); setPage(0); }}
          >
            {t('marketplaceQuotes.' + ["all", "toQuote", "waitingClient", "accepted"][index])}
          </Button>
        ))}
      </div>

      {transition.isError && <p role="alert" className="text-sm text-destructive-ink">
        {(transition.error as Error)?.message || t('marketplaceWorkflow.sendFailed')}
      </p>}
      {isLoading && (
        <div className="mt-4 flex shrink-0 flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[120px] w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !noProviderAccount && (
        <div className="mt-4 shrink-0">
          <EmptyState
            icon={<RequestQuote />}
            title={t('marketplaceQuotes.unavailable')}
            description={t('marketplaceQuotes.unavailableHelp')}
          />
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="mt-4 shrink-0">
          <EmptyState
            icon={<RequestQuote />}
            title={t('marketplaceQuotes.emptyReceived')}
            description={t('marketplaceQuotes.emptyReceivedHelp')}
          />
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="mt-4 flex shrink-0 flex-col gap-3">
          {data.items.map((quote) => (
            <div key={quote.id}>
              <QuoteCard quote={quote} side="provider" actions={actionsFor(quote)} />

              {answeringId === quote.id && quote.status === 'SENT' && (
                <div className="mt-2 flex flex-col gap-2 rounded-md border border-border px-3 py-2.5">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {t('quoteTeams.representing', 'Devis émis au nom de')}
                    <select value={selectedTeam} onChange={(event) => setTeamChoice(event.target.value)}
                      disabled={!teamChoices || teamChoices.selectedTeamId != null}
                      className="h-8 cursor-pointer rounded-md border border-border bg-background px-2 text-foreground focus-visible:ring-2 focus-visible:ring-primary">
                      {teamChoices?.selectedTeamId == null && <option value="">{t('quoteTeams.individual', 'Moi-même, à titre individuel')}</option>}
                      {teamChoices?.options.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                  </label>
                  {teamError && <p role="alert" className="text-xs text-destructive-ink">{t('quoteTeams.unavailable', 'Les équipes ne sont pas disponibles. Rouvrez le formulaire pour réessayer.')}</p>}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-foreground">{t('marketplaceQuotes.amount', { currency })}</span>
                      <input
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        inputMode="decimal"
                        className="h-8 rounded-md border border-border bg-background px-2.5 text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-foreground">{t('marketplaceQuotes.validUntil')}</span>
                      <input
                        type="date"
                        value={validUntil}
                        onChange={(event) => setValidUntil(event.target.value)}
                        className="h-8 rounded-md border border-border bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {t('marketplaceQuotes.currency')}
                    <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                      maxLength={3} pattern="[A-Z]{3}" aria-label={t('marketplaceWorkflow.currency')}
                      className="h-8 rounded-md border border-border bg-background px-2 text-foreground focus-visible:ring-2 focus-visible:ring-primary" />
                  </label>

                  <Textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={4000}
                    rows={3}
                    placeholder={t('marketplaceQuotes.quotePlaceholder')}
                    aria-label={t('marketplaceQuotes.quoteDetails')}
                  />

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      // Le montant part d'ici et de nulle part ailleurs : c'est
                      // le prestataire qui chiffre.
                      disabled={!(Number(amount) > 0) || !Number.isFinite(Number(amount)) || !/^[A-Z]{3}$/.test(currency) || transition.isPending || !teamChoices || teamError}
                      onClick={() => transition.mutate(
                        {
                          id: quote.id,
                          action: 'quote',
                          amount: Number(amount),
                          currency,
                          providerTeamId: selectedTeam ? Number(selectedTeam) : undefined,
                          message: message.trim() || undefined,
                          validUntil: validUntil || undefined,
                        },
                        { onSuccess: resetAnswer },
                      )}
                    >
                      {t('marketplaceQuotes.sendQuote')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={resetAnswer}>{t('marketplaceQuotes.cancel')}</Button>
                  </div>

                  {!(Number(amount) > 0) && (
                    <p className="m-0 text-xs text-muted-foreground">
                      {t('marketplaceQuotes.positiveAmount')}
                    </p>
                  )}
                </div>
              )}

              {decliningId === quote.id && quote.status === 'SENT' && (
                <div className="mt-2 flex flex-col gap-2 rounded-md border border-border px-3 py-2.5">
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder={t('marketplaceQuotes.turnDownPlaceholder')}
                    aria-label={t('marketplaceQuotes.reason')}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={transition.isPending}
                      onClick={() => transition.mutate(
                        { id: quote.id, action: 'turnDown', reason: reason.trim() || undefined },
                        { onSuccess: () => setDecliningId(null) },
                      )}
                    >
                      {t('marketplaceQuotes.confirm')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDecliningId(null)}>
                      {t('marketplaceQuotes.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <PagePagination page={page} onPageChange={setPage} totalPages={data.totalPages} />
        </div>
      )}
    </>
  );
}
