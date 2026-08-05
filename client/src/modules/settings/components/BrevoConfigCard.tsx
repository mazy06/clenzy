import React, { useEffect, useState } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Alert as UiAlert, AlertDescription, Button } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Card } from '../../../components/ui';
import { Field, FieldLabel, Input, NativeSelect, NativeSelectOption, Separator, Switch } from '../../../components/ui';
import { CheckCircle as CheckCircleIcon, ErrorOutline, Link as LinkIcon } from '../../../icons';
import {
  useMarketingIntegration,
  useBrevoLists,
  useSetBrevoApiKey,
  useSetMarketingLists,
  useSetMarketingToggles,
  useTestBrevo,
} from '../../../hooks/useMarketingIntegration';
import type { MarketingTogglesPayload } from '../../../services/api/marketingIntegrationApi';

/** Vert de marque Brevo : identite du service, pas un jeton du theme Baitly. */
const BREVO_GREEN = '#0B996E';

/** Libelle de section — recette « overline » Baitly UI. */
const labelClass = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground';


interface BrevoConfigCardProps {
  /** Notifie le parent de l'état "configuré" pour le badge sur la card de la liste. */
  onStatusChange?: (configured: boolean) => void;
}

export default function BrevoConfigCard({ onStatusChange }: BrevoConfigCardProps) {
  const { data, isLoading } = useMarketingIntegration();
  const setApiKey = useSetBrevoApiKey();
  const setLists = useSetMarketingLists();
  const setToggles = useSetMarketingToggles();
  const test = useTestBrevo();
  const { data: brevoLists, isFetching: listsLoading } = useBrevoLists(!!data?.configured);

  const [keyInput, setKeyInput] = useState('');

  useEffect(() => {
    onStatusChange?.(!!data?.configured);
  }, [data?.configured, onStatusChange]);

  if (isLoading || !data) {
    return (
      <div className="p-4 flex justify-center">
        <Spinner className="size-7" />
      </div>
    );
  }

  const statusChip =
    data.configured && data.status === 'ACTIVE' ? (
      <StatusChip tone="ok" label="Connecté" icon={<CheckCircleIcon size={11} strokeWidth={2} />} />
    ) : data.status === 'ERROR' ? (
      <StatusChip tone="err" label="Erreur" icon={<ErrorOutline size={11} strokeWidth={2} />} />
    ) : data.configured ? (
      <StatusChip tone="warn" label="À tester" />
    ) : (
      <StatusChip tone="neutral" label="Non configuré" />
    );

  const saveKey = () => {
    const v = keyInput.trim();
    if (v) setApiKey.mutate(v, { onSuccess: () => setKeyInput('') });
  };

  const listSelect = (
    label: string,
    value: number | null,
    field: 'waitlistListId' | 'newsletterListId' | 'prospectsListId' | 'leadsListId',
  ) => (
    // `field` est la cle de mapping : elle donne un id stable et unique par select.
    <Field>
      <FieldLabel htmlFor={`brevo-list-${field}`}>{label}</FieldLabel>
      <NativeSelect
        className="w-full"
        id={`brevo-list-${field}`}
        value={value != null ? String(value) : ''}
        disabled={!data.configured || listsLoading}
        onChange={(e) => {
          const v = e.target.value === '' ? null : Number(e.target.value);
          setLists.mutate({
            waitlistListId: field === 'waitlistListId' ? v : data.waitlistListId,
            newsletterListId: field === 'newsletterListId' ? v : data.newsletterListId,
            prospectsListId: field === 'prospectsListId' ? v : data.prospectsListId,
            leadsListId: field === 'leadsListId' ? v : data.leadsListId,
          });
        }}
      >
        <NativeSelectOption value="">— Aucune —</NativeSelectOption>
        {(brevoLists ?? []).map((l) => (
          <NativeSelectOption key={l.id} value={String(l.id)}>
            {l.name} (#{l.id}
            {l.totalSubscribers != null ? `, ${l.totalSubscribers}` : ''})
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );

  // `key` est la cle du toggle : elle donne un id stable et unique par rangee.
  // Le libelle porte deux lignes en <span> : un <p> dans un <label> est invalide.
  const toggleRow = (label: string, desc: string, checked: boolean, key: keyof MarketingTogglesPayload) => (
    <div className="flex flex-row items-start gap-2">
      <Switch
        id={`brevo-toggle-${key}`}
        checked={checked}
        onCheckedChange={(next) => setToggles.mutate({ [key]: next } as MarketingTogglesPayload)}
        size="sm"
      />
      <FieldLabel htmlFor={`brevo-toggle-${key}`} className="flex-none font-normal mt-0.5">
        <span className="block">
          <span className="block text-sm font-semibold leading-snug">{label}</span>
          <span className="block text-xs text-muted-foreground">{desc}</span>
        </span>
      </FieldLabel>
    </div>
  );

  return (
    <Card className="gap-0 py-0 border-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-start gap-2 border-b border-border">
        {/* Pastille de marque Brevo : l'encre blanche est imposee par le vert du
            logo, pas par le theme — d'ou le jeton `text-white` du kit. */}
        <div className="size-10 rounded-lg inline-flex items-center justify-center text-white font-bold text-base shrink-0" style={{ backgroundColor: BREVO_GREEN }} aria-hidden="true">
          B
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold tracking-tight">
            Brevo
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Emailing &amp; newsletter · synchro des contacts (waitlist, newsletter, prospects)
          </p>
        </div>
        <div className="shrink-0">{statusChip}</div>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Clé API */}
        <div>
          {/* Le titre de section fait office de libelle : le champ MUI n'en portait
              aucun, on l'associe par aria-labelledby sans toucher a la mise en page. */}
          <p className={labelClass} id="brevo-api-key-label">Clé API Brevo (v3)</p>
          <div className="flex gap-1.5 mt-0.5">
            <Input
              id="brevo-api-key"
              aria-labelledby="brevo-api-key-label"
              className="w-full"
              type="password"
              autoComplete="off"
              placeholder={data.configured ? `Configurée (${data.apiKeyMasked})` : 'xkeysib-…'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveKey();
              }}
            />
            <Button onClick={saveKey} disabled={!keyInput.trim() || setApiKey.isPending}>
              {setApiKey.isPending ? <Spinner className="size-4" /> : 'Enregistrer'}
            </Button>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Stockée chiffrée (AES-256), jamais affichée en clair. Brevo → SMTP &amp; API → Clés API.
          </p>
        </div>

        {/* Test connexion */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => test.mutate()}
            disabled={!data.configured || test.isPending}
          >
            {test.isPending ? <Spinner className="size-3.5" /> : <LinkIcon size={14} strokeWidth={2} />}
            Tester la connexion
          </Button>
          {data.lastTestedAt && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Dernier test : {new Date(data.lastTestedAt).toLocaleString('fr-FR')}
            </p>
          )}
        </div>
        {test.data ? (
          <UiAlert variant={test.data.success ? 'success' : 'destructive'} className="text-xs py-0.5">
            {test.data.success ? <CheckCircleIcon /> : <TriangleAlert />}
            <AlertDescription>
              {test.data.message}
              {test.data.success ? ` — ${test.data.listCount} liste(s) trouvée(s).` : ''}
            </AlertDescription>
          </UiAlert>
        ) : data.status === 'ERROR' && data.errorMessage ? (
          <UiAlert variant="destructive" className="text-xs py-0.5">
            <TriangleAlert />
            <AlertDescription>{data.errorMessage}</AlertDescription>
          </UiAlert>
        ) : null}

        <Separator />

        {/* Mapping des listes */}
        <div>
          <p className={labelClass}>Listes Brevo</p>
          {!data.configured ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              Enregistre une clé API valide pour charger tes listes Brevo.
            </p>
          ) : (
            <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-1.5 mt-[4.5px]">
              {listSelect('Waitlist', data.waitlistListId, 'waitlistListId')}
              {listSelect('Newsletter', data.newsletterListId, 'newsletterListId')}
              {listSelect('Prospects / devis', data.prospectsListId, 'prospectsListId')}
              {listSelect('Leads booking engine', data.leadsListId, 'leadsListId')}
            </div>
          )}
        </div>

        <Separator />

        {/* Toggles de synchro */}
        <div className="flex flex-col gap-2">
          <p className={labelClass}>Synchronisations</p>
          {toggleRow('Waitlist → Brevo', 'Pousse les inscrits de la liste d’attente.', data.syncWaitlistEnabled, 'syncWaitlist')}
          {toggleRow('Newsletter → Brevo', 'Pousse les opt-in newsletter (inscription).', data.syncNewsletterEnabled, 'syncNewsletter')}
          {toggleRow('Leads devis → Brevo', 'Pousse les demandes de devis de la landing.', data.syncProspectsEnabled, 'syncProspects')}
          {toggleRow('Leads booking engine → Brevo', 'Pousse les leads captés (exit-intent / panier abandonné), segmentables par SOURCE.', data.syncLeadsEnabled, 'syncLeads')}
          {toggleRow('Attributs de contact', 'Envoie NOM / VILLE / SOURCE pour segmenter.', data.syncAttributesEnabled, 'syncAttributes')}
        </div>
      </div>
    </Card>
  );
}
