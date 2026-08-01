import React, { useEffect, useId, useState } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Alert as UiAlert, AlertDescription } from '../../../components/ui';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { Spinner, Button, Field, FieldLabel, Input } from '../../../components/ui';
import {
  partnerConnectionApi,
  type PartnerServiceProvider,
} from '../../../services/api/partnerConnectionApi';

/**
 * Formulaire de connexion d'UN service partenaire du catalogue (scaffolding),
 * rendu DANS le modal de détail du service via le hook {@code configForService}
 * de {@link ServiceCatalogSection} — même pattern que ActivityProviderConfigForm.
 *
 * Les credentials sont chiffrées et enregistrées côté serveur ; aucun appel API
 * partenaire n'est encore effectué (note honnête affichée dans le formulaire).
 */
export default function PartnerServiceConfigForm({
  provider,
  serviceName,
}: {
  provider: PartnerServiceProvider;
  serviceName: string;
}) {
  // Le formulaire est instancie une fois par service du catalogue : les id des
  // champs doivent rester uniques meme si deux instances coexistent.
  const fieldId = useId();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectedServerUrl, setConnectedServerUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ serverUrl: '', accountIdentifier: '', apiKey: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    partnerConnectionApi
      .getStatus(provider)
      .then((s) => {
        if (!active) return;
        setConnected(s.connected);
        setConnectedServerUrl(s.serverUrl ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [provider]);

  const handleConnect = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const status = await partnerConnectionApi.connect(provider, {
        serverUrl: form.serverUrl.trim(),
        accountIdentifier: form.accountIdentifier.trim() || undefined,
        apiKey: form.apiKey.trim(),
      });
      setConnected(status.connected);
      setConnectedServerUrl(status.serverUrl ?? null);
      setForm({ serverUrl: '', accountIdentifier: '', apiKey: '' });
      setMessage({ type: 'success', text: 'Accès enregistrés (chiffrés).' });
    } catch {
      setMessage({ type: 'error', text: "Impossible d'enregistrer les accès. Vérifiez l'URL (https://…) et la clé API (8 caractères minimum)." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      await partnerConnectionApi.disconnect(provider);
      setConnected(false);
      setConnectedServerUrl(null);
      setMessage({ type: 'success', text: 'Connexion supprimée.' });
    } catch {
      setMessage({ type: 'error', text: 'Impossible de supprimer la connexion.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-3">
        <Spinner className="size-[22px]" />
      </div>
    );
  }

  return (
    <div className="border border-[var(--line)] rounded-[16px] p-2 mb-2">
      <UiAlert variant="info" className="text-[0.74rem] mb-2">
        <Info />
        <AlertDescription>Vos accès {serviceName}sont chiffrés et enregistrés dès maintenant ; la
        synchronisation native sera activée dans une prochaine release.</AlertDescription>
      </UiAlert>

      {connected ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusChip tokens={{ color: 'var(--ok)', bg: 'var(--ok-soft)' }} label="Accès enregistrés" className="h-[20px] text-[0.66rem]" />
          {connectedServerUrl && (
            <span className="text-[0.72rem] text-muted-foreground">
              {connectedServerUrl}
            </span>
          )}
          {/* Rompre la connexion est l'action irreversible de la ligne : variante destructive. */}
          <Button variant="destructive" size="sm" className="ms-auto" onClick={handleDisconnect} disabled={submitting}>
            Déconnecter
          </Button>
        </div>
      ) : (
        <>
          <Field className="mb-1.5">
            <FieldLabel htmlFor={`${fieldId}-server-url`}>URL de l'API</FieldLabel>
            <Input
              id={`${fieldId}-server-url`}
              className="w-full"
              placeholder="https://api.exemple.com"
              value={form.serverUrl}
              onChange={(e) => setForm((f) => ({ ...f, serverUrl: e.target.value }))}
            />
          </Field>
          <Field className="mb-1.5">
            <FieldLabel htmlFor={`${fieldId}-account-identifier`}>
              Identifiant de compte (optionnel)
            </FieldLabel>
            <Input
              id={`${fieldId}-account-identifier`}
              className="w-full"
              value={form.accountIdentifier}
              onChange={(e) => setForm((f) => ({ ...f, accountIdentifier: e.target.value }))}
            />
          </Field>
          <Field className="mb-1.5">
            <FieldLabel htmlFor={`${fieldId}-api-key`}>Clé API</FieldLabel>
            <Input
              id={`${fieldId}-api-key`}
              className="w-full"
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            />
          </Field>
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={submitting || !form.serverUrl.trim() || form.apiKey.trim().length < 8}
          >
            {submitting ? <Spinner className="size-3.5" /> : null}
            Enregistrer les accès
          </Button>
        </>
      )}

      {message && (
        <UiAlert variant={message.type === 'success' ? 'success' : 'destructive'} className="text-[0.74rem] mt-[7.5px]">
          {message.type === 'success' ? <CircleCheck /> : <TriangleAlert />}
          <AlertDescription>{message.text}</AlertDescription>
        </UiAlert>
      )}
    </div>
  );
}
