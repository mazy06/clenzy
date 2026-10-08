import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, RefreshCw, TriangleAlert } from '../../icons/glyphs';
import { Alert, AlertDescription, Button, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import IntegrationLogo from '../../components/integrations/IntegrationLogo';
import PagePagination from '../../components/PagePagination';
import { useTranslation } from '../../hooks/useTranslation';
import { useAllOwnerPayoutConfigs, ownerPayoutConfigKeys } from '../../hooks/useOwnerPayoutConfig';
import { accountingApi } from '../../services/api/accountingApi';
import { usersApi } from '../../services/api/usersApi';
import SettingsSection from './components/SettingsSection';

/** Le bénéficiaire réalise sa vérification chez le PSP ; Baitly n'approuve pas son IBAN. */
export default function OwnerPayoutSettings() {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const configs = useAllOwnerPayoutConfigs();
  const users = useQuery({ queryKey: ['users-all'], queryFn: () => usersApi.getAll(), staleTime: 120_000 });
  const [page, setPage] = useState(0);
  const rows = configs.data ?? [];
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 10) - 1));
  const activate = useMutation({
    mutationFn: (ownerId: number) => accountingApi.updatePayoutMethod(ownerId, { payoutMethod: 'STRIPE_CONNECT' }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ownerPayoutConfigKeys.all }),
  });
  return <SettingsSection icon={Landmark} title={t('settings.ownerPayout.title', 'Configuration des reversements propriétaires')}
    description={t('accounting.psp.settingsHint', 'Les versements passent par le PSP du bénéficiaire. La connexion et les coordonnées bancaires se gèrent sur son parcours sécurisé.')}
    action={<Button size="sm" variant="outline" disabled={configs.isFetching} onClick={() => void configs.refetch()}><RefreshCw size={14} />{t('common.refresh', 'Actualiser')}</Button>}>
    <div className="mb-3 flex flex-wrap items-center gap-3"><IntegrationLogo provider="stripe" /><p className="text-xs text-muted-foreground">{t('accounting.psp.availability', 'Stripe Connect est proposé pour la France. Les autres pays seront ouverts avec leurs PSP dédiés.')}</p></div>
    {(configs.isError || activate.isError) && <Alert variant="destructive" className="mb-3"><TriangleAlert /><AlertDescription>{activate.error?.message || t('common.loadingError', 'Impossible de charger les données.')}</AlertDescription></Alert>}
    {configs.isPending ? <Skeleton className="h-32 w-full" /> : !rows.length ? <p className="py-4 text-sm text-muted-foreground">{t('accounting.psp.noBeneficiaries', 'Aucun compte de versement connecté. Les bénéficiaires peuvent le configurer dans Mes versements.')}</p> : <>
      <Table>
        <TableHeader><TableRow><TableHead>{t('accounting.col.owner', 'Propriétaire')}</TableHead><TableHead>PSP</TableHead><TableHead>{t('accounting.col.status', 'Statut')}</TableHead><TableHead>{t('common.actions', 'Actions')}</TableHead></TableRow></TableHeader>
        <TableBody>{rows.slice(currentPage * 10, (currentPage + 1) * 10).map(config => {
          const user = users.data?.find(value => value.id === config.ownerId);
          const connected = !!config.stripeConnectedAccountId && config.stripeOnboardingComplete && config.verified;
          const active = connected && config.payoutMethod === 'STRIPE_CONNECT';
          return <TableRow key={config.id}>
            <TableCell>{user ? `${user.firstName} ${user.lastName}` : `${t('accounting.owner', 'Propriétaire')} #${config.ownerId}`}</TableCell>
            <TableCell>{config.stripeConnectedAccountId ? 'Stripe Connect' : t('accounting.psp.toConnect', 'À connecter')}</TableCell>
            <TableCell><StatusChip tone={active ? 'ok' : 'warn'} label={active ? t('accounting.psp.ready', 'Prêt pour les versements') : t('accounting.psp.toComplete', 'Configuration à terminer')} /></TableCell>
            <TableCell>{connected && !active ? <Button variant="outline" size="sm" disabled={activate.isPending} onClick={() => activate.mutate(config.ownerId)}>{t('accounting.psp.activate', 'Utiliser Stripe')}</Button>
              : <p className="max-w-xs whitespace-normal text-xs text-muted-foreground">{active ? t('accounting.psp.providerManaged', 'Statut confirmé par le PSP') : t('accounting.psp.beneficiarySetup', 'Le bénéficiaire doit connecter ou compléter son compte dans Mes versements.')}</p>}</TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
      <PagePagination count={rows.length} page={currentPage} onPageChange={setPage} rowsPerPage={10} />
    </>}
  </SettingsSection>;
}
