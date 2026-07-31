import React, { useEffect, useState } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Alert as UiAlert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Card } from '../../../components/ui';
import { Box, Typography, TextField, Button, Switch, FormControlLabel, MenuItem, Alert, Divider } from '@mui/material';
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

const BREVO_GREEN = '#0B996E';
const ACCENT = 'var(--ok)';
const DANGER = 'var(--err)';
const WARM = 'var(--warn)';
const NEUTRAL = 'var(--muted)';

const labelSx = {
  fontSize: '0.72rem',
  fontWeight: 600,
  color: 'text.secondary',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
};


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
      <StatusChip color={ACCENT} label="Connecté" icon={<CheckCircleIcon size={11} strokeWidth={2} />} />
    ) : data.status === 'ERROR' ? (
      <StatusChip color={DANGER} label="Erreur" icon={<ErrorOutline size={11} strokeWidth={2} />} />
    ) : data.configured ? (
      <StatusChip color={WARM} label="À tester" />
    ) : (
      <StatusChip color={NEUTRAL} label="Non configuré" />
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
    <TextField
      select
      fullWidth
      size="small"
      label={label}
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
      <MenuItem value="">— Aucune —</MenuItem>
      {(brevoLists ?? []).map((l) => (
        <MenuItem key={l.id} value={String(l.id)}>
          {l.name} (#{l.id}
          {l.totalSubscribers != null ? `, ${l.totalSubscribers}` : ''})
        </MenuItem>
      ))}
    </TextField>
  );

  const toggleRow = (label: string, desc: string, checked: boolean, key: keyof MarketingTogglesPayload) => (
    <FormControlLabel
      sx={{ alignItems: 'flex-start', m: 0 }}
      control={
        <Switch
          checked={checked}
          size="small"
          onChange={(e) => setToggles.mutate({ [key]: e.target.checked } as MarketingTogglesPayload)}
        />
      }
      label={
        <div className="mt-0.5">
          <p className="cn-text-body1 text-[0.8rem] font-semibold leading-[1.2]">{label}</p>
          <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">{desc}</p>
        </div>
      }
    />
  );

  return (
    <Card className="gap-0 py-0 border-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-start gap-2 border-b border-[divider]">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: BREVO_GREEN,
            color: '#fff',
            fontWeight: 700,
            fontSize: '1rem',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          B
        </Box>
        <div className="flex-1 min-w-0">
          <p className="cn-text-body1 font-semibold text-[0.95rem] leading-[1.25]">
            Brevo
          </p>
          <p className="cn-text-body1 text-[0.78rem] text-muted-foreground mt-0.5 leading-[1.4]">
            Emailing &amp; newsletter · synchro des contacts (waitlist, newsletter, prospects)
          </p>
        </div>
        <div className="shrink-0">{statusChip}</div>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Clé API */}
        <div>
          <Typography sx={labelSx}>Clé API Brevo (v3)</Typography>
          <div className="flex gap-1.5 mt-0.5">
            <TextField
              type="password"
              size="small"
              fullWidth
              autoComplete="off"
              placeholder={data.configured ? `Configurée (${data.apiKeyMasked})` : 'xkeysib-…'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveKey();
              }}
            />
            <Button
              variant="contained"
              disableElevation
              onClick={saveKey}
              disabled={!keyInput.trim() || setApiKey.isPending}
              sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {setApiKey.isPending ? <Spinner className="size-4" /> : 'Enregistrer'}
            </Button>
          </div>
          <p className="cn-text-body1 text-[0.68rem] text-muted-foreground mt-0.5">
            Stockée chiffrée (AES-256), jamais affichée en clair. Brevo → SMTP &amp; API → Clés API.
          </p>
        </div>

        {/* Test connexion */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outlined"
            size="small"
            onClick={() => test.mutate()}
            disabled={!data.configured || test.isPending}
            startIcon={test.isPending ? <Spinner className="size-3.5" /> : <LinkIcon size={14} strokeWidth={2} />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Tester la connexion
          </Button>
          {data.lastTestedAt && (
            <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">
              Dernier test : {new Date(data.lastTestedAt).toLocaleString('fr-FR')}
            </p>
          )}
        </div>
        {test.data ? (
          <Alert severity={test.data.success ? 'success' : 'error'} sx={{ borderRadius: '8px', fontSize: '0.78rem', py: 0.25 }}>
            {test.data.message}
            {test.data.success ? ` — ${test.data.listCount} liste(s) trouvée(s).` : ''}
          </Alert>
        ) : data.status === 'ERROR' && data.errorMessage ? (
          <UiAlert variant="destructive" className="text-[0.78rem] py-0.5">
            <TriangleAlert />
            <AlertDescription>{data.errorMessage}</AlertDescription>
          </UiAlert>
        ) : null}

        <Divider />

        {/* Mapping des listes */}
        <div>
          <Typography sx={labelSx}>Listes Brevo</Typography>
          {!data.configured ? (
            <p className="cn-text-body1 text-[0.72rem] text-muted-foreground mt-0.5">
              Enregistre une clé API valide pour charger tes listes Brevo.
            </p>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1,
                mt: 0.75,
              }}
            >
              {listSelect('Waitlist', data.waitlistListId, 'waitlistListId')}
              {listSelect('Newsletter', data.newsletterListId, 'newsletterListId')}
              {listSelect('Prospects / devis', data.prospectsListId, 'prospectsListId')}
              {listSelect('Leads booking engine', data.leadsListId, 'leadsListId')}
            </Box>
          )}
        </div>

        <Divider />

        {/* Toggles de synchro */}
        <div className="flex flex-col gap-2">
          <Typography sx={labelSx}>Synchronisations</Typography>
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
