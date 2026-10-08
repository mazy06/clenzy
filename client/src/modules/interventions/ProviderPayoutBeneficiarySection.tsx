import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, LockKeyhole } from '../../icons/glyphs';
import { Alert, AlertDescription, Button, Card, CardContent, Checkbox, Skeleton } from '../../components/ui';
import { WorkOrderHeading, WORK_ORDER_ART } from '../work-orders/WorkOrderPresentation';
import { useTranslation } from '../../hooks/useTranslation';
import { providerPayoutBeneficiaryApi } from '../../services/api/providerPayoutBeneficiaryApi';
import '../supervision/supervision-surfaces.css';

/** Décision financière du staff plateforme, affichée directement dans la fiche mission. */
export default function ProviderPayoutBeneficiarySection({ missionId }: { missionId: number }) {
  const { t } = useTranslation();
  const confirmationId = useId();
  const [confirmedOrganizationId, setConfirmedOrganizationId] = useState<number | null>(null);
  const queries = useQueryClient();
  const queryKey = ['provider-payout-beneficiary', missionId];
  const choice = useQuery({ queryKey, queryFn: () => providerPayoutBeneficiaryApi.choice(missionId), staleTime: 0, refetchOnMount: 'always' });
  const select = useMutation({
    mutationFn: (organizationId: number) => providerPayoutBeneficiaryApi.selectOrganization(missionId, organizationId),
    onSuccess: (value) => {
      queries.setQueryData(queryKey, value);
      void queries.invalidateQueries({ queryKey: ['housekeeper-payouts-org'] });
      setConfirmedOrganizationId(null);
    },
    onError: () => { void queries.invalidateQueries({ queryKey }); setConfirmedOrganizationId(null); },
  });
  const data = choice.data;
  const confirmed = confirmedOrganizationId !== null && confirmedOrganizationId === data?.organizationId;
  const title = t('providerPayoutBeneficiary.title', 'Bénéficiaire du versement');

  return (
    <section className="wo-section wo-beneficiary">
      <div className="space-y-3 text-start">
        <WorkOrderHeading art={WORK_ORDER_ART['service-transfer']} title={title} />
        {choice.isPending ? <Skeleton className="h-20 w-full" aria-label={t('common.loading', 'Chargement…')} />
          : choice.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{t('providerPayoutBeneficiary.loadError', 'Impossible de vérifier le bénéficiaire. Rechargez les informations avant de continuer.')}</AlertDescription>
              <Button variant="ghost" size="sm" onClick={() => { void choice.refetch(); }}>{t('common.retry', 'Réessayer')}</Button>
            </Alert>
          ) : data ? (
            <>
              {data.organizationId !== null && (
                <div className="flex items-center gap-3 text-foreground">
                  <Building2 className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="m-0 break-words text-sm font-medium">{data.organizationName || t('providerPayoutBeneficiary.organization', 'Organisation #{{id}}', { id: data.organizationId })}</p>
                    <p className="m-0 text-xs text-muted-foreground">{t('providerPayoutBeneficiary.companyHint', 'Organisation du prestataire affecté à cette mission')}</p>
                  </div>
                </div>
              )}
              {data.selected ? (
                <p role="status" className="m-0 flex items-start gap-2 text-sm text-success-ink">
                  <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {t('providerPayoutBeneficiary.selected', 'Cette organisation est le bénéficiaire enregistré. Le versement reste soumis aux contrôles de paiement et de réalisation.')}
                </p>
              ) : data.locked ? (
                <p className="m-0 flex items-start gap-2 text-sm text-muted-foreground">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {t('providerPayoutBeneficiary.locked', 'Le bénéficiaire est déjà fixé pour ce versement. Un rapprochement est nécessaire pour toute modification.')}
                </p>
              ) : data.organizationId === null ? (
                <p className="m-0 text-sm text-muted-foreground">{t('providerPayoutBeneficiary.unassigned', 'Affectez un prestataire ou une équipe pour identifier son organisation.')}</p>
              ) : (
                <>
                  <p className="m-0 max-w-prose text-sm text-muted-foreground">{t('providerPayoutBeneficiary.explanation', 'Si la prestation est facturée par cette organisation, le versement doit arriver sur son compte, même si un membre de son équipe réalise la mission.')}</p>
                  <div className="wo-beneficiary__confirmation">
                    <Checkbox id={confirmationId} checked={confirmed} disabled={select.isPending}
                      onCheckedChange={(checked) => setConfirmedOrganizationId(checked === true ? data.organizationId : null)} />
                    <label htmlFor={confirmationId}>
                    {t('providerPayoutBeneficiary.confirm', 'Je confirme que {{name}} est le bénéficiaire contractuel de cette mission.', { name: data.organizationName || `#${data.organizationId}` })}
                    </label>
                  </div>
                  <div className="wo-beneficiary__footer">
                    <Button size="sm" className="baitly-hitl-primary" disabled={!confirmed || select.isPending || choice.isFetching}
                      onClick={() => { if (confirmed && data.organizationId !== null) select.mutate(data.organizationId); }}>
                      {select.isPending ? t('providerPayoutBeneficiary.saving', 'Enregistrement…') : t('providerPayoutBeneficiary.save', 'Verser à cette organisation')}
                    </Button>
                    <p className="m-0 max-w-prose text-xs text-muted-foreground">{t('providerPayoutBeneficiary.effect', 'Ce choix sera figé. Si la mission est terminée et les contrôles validés, le versement pourra être envoyé.')}</p>
                  </div>
                </>
              )}
            </>
          ) : null}
        {select.isError && <Alert variant="destructive"><AlertDescription>{t('providerPayoutBeneficiary.saveError', 'Le choix n’a pas pu être confirmé. Vérifiez l’état actualisé avant de réessayer.')}</AlertDescription></Alert>}
      </div>
    </section>
  );
}
