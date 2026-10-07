import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { Button, Input, Alert, AlertDescription, Skeleton } from '../../components/ui';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
import { baitlySupplierPurchasesApi as api } from '../../services/api/baitlySupplierPurchasesApi';
import { getErrorMessage } from '../../utils/getErrorMessage';

/** Le lien n'accorde pas de droits d'organisation ; l'adresse vérifiée doit être celle du fournisseur. */
export default function BaitlySupplierInvitationPage() {
  const { t, currentLanguage } = useTranslation(); const { user, loading } = useAuth(); const [params] = useSearchParams();
  const token = params.get('token') ?? ''; const lock = useRef(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [accepted, setAccepted] = useState<Awaited<ReturnType<typeof api.accept>>>();
  const [registering, setRegistering] = useState(false); const [activationSent, setActivationSent] = useState(false);
  const [identity, setIdentity] = useState({ email: '', firstName: '', lastName: '' });
  const validToken = /^[a-f0-9-]{36}\.[a-f0-9-]{36}$/.test(token);
  return <main className="mx-auto max-w-xl space-y-5 px-5 py-12 text-sm">
    <BaitlyMarkLogo variant="full" size={32} /><h1 className="text-2xl font-semibold">{t('supplierPurchase.invitationTitle')}</h1>
    <p className="text-muted-foreground">{t('supplierPurchase.invitationPrivacy')}</p>
    {!/^[a-f0-9-]{36}\.[a-f0-9-]{36}$/.test(token) && <p role="alert">{t('supplierPurchase.invalidInvitation')}</p>}
    {loading ? <Skeleton className="h-16 w-full" /> : !user ? <div className="space-y-4">
      <p>{t('supplierPurchase.loginHelp')}</p><div className="flex flex-wrap gap-2"><Button asChild><Link to="/login" target="_blank" rel="noopener noreferrer">{t('supplierPurchase.login')}</Link></Button>
        <Button variant="outline" disabled={!validToken || busy} onClick={() => { setRegistering(true); setError(''); }}>{t('supplierPurchase.register')}</Button>
        <Button variant="ghost" onClick={() => window.location.reload()}>{t('supplierPurchase.refreshSession')}</Button></div>
      {registering && !activationSent && <form className="space-y-3 border-t border-border pt-4" onSubmit={e => {
        e.preventDefault(); if (lock.current || !validToken) return; lock.current = true; setBusy(true); setError('');
        void api.register(token, identity.email, identity.firstName, identity.lastName).then(() => setActivationSent(true))
          .catch(failure => setError(getErrorMessage(failure))).finally(() => { lock.current = false; setBusy(false); });
      }}><p className="text-muted-foreground">{t('supplierPurchase.registerHelp')}</p><fieldset disabled={busy} className="space-y-3">
        {(['email', 'firstName', 'lastName'] as const).map(field => <label key={field} className="block">{t(`supplierPurchase.registration.${field}`)}
          <Input className="mt-1" type={field === 'email' ? 'email' : 'text'} autoComplete={field === 'email' ? 'email' : field === 'firstName' ? 'given-name' : 'family-name'}
            maxLength={field === 'email' ? 320 : 100} required value={identity[field]} onChange={e => setIdentity(old => ({ ...old, [field]: e.target.value }))} /></label>)}
        <Button disabled={busy}>{t('supplierPurchase.sendActivation')}</Button>
      </fieldset></form>}
      {activationSent && <p role="status">{t('supplierPurchase.activationSent')}</p>}
    </div> : accepted ? <div className="space-y-4"><p role="status">{t('supplierPurchase.invitationAccepted', { name: accepted.supplierName, reference: accepted.invoiceReference,
      amount: new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: accepted.currency }).format(accepted.amount) })}</p>
      <Button asChild><Link to="/account?tab=payouts">{t('supplierPurchase.connectAccount')}</Link></Button><p className="text-muted-foreground">{t('supplierPurchase.noTransferYet')}</p>
    </div> : <Button disabled={busy || !/^[a-f0-9-]{36}\.[a-f0-9-]{36}$/.test(token)} onClick={() => {
      if (lock.current) return; lock.current = true; setBusy(true); setError('');
      void api.accept(token).then(result => {
        setAccepted(result);
        // L'acceptation peut créer l'espace personnel du fournisseur : relire son profil avant la suite.
        window.dispatchEvent(new Event('force-user-reload'));
      }).catch(failure => setError(getErrorMessage(failure))).finally(() => { lock.current = false; setBusy(false); });
    }}>{t('supplierPurchase.acceptInvitation')}</Button>}
    {error && <Alert><AlertDescription>{error}</AlertDescription></Alert>}
  </main>;
}
