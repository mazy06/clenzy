import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
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
const ACCENT = '#4A9B8E';
const DANGER = '#C97A7A';
const WARM = '#D4A574';
const NEUTRAL = '#8A8378';

const labelSx = {
  fontSize: '0.72rem',
  fontWeight: 600,
  color: 'text.secondary',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
};

const chipSx = (color: string) => ({
  height: 22,
  fontSize: '0.6875rem',
  fontWeight: 600,
  borderRadius: '6px',
  backgroundColor: `${color}14`,
  color,
  border: `1px solid ${color}33`,
  '& .MuiChip-icon': { color: `${color} !important`, ml: '6px', mr: '-2px' },
  '& .MuiChip-label': { px: 0.875 },
});

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
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const statusChip =
    data.configured && data.status === 'ACTIVE' ? (
      <Chip icon={<CheckCircleIcon size={11} strokeWidth={2} />} label="Connecté" size="small" sx={chipSx(ACCENT)} />
    ) : data.status === 'ERROR' ? (
      <Chip icon={<ErrorOutline size={11} strokeWidth={2} />} label="Erreur" size="small" sx={chipSx(DANGER)} />
    ) : data.configured ? (
      <Chip label="À tester" size="small" sx={chipSx(WARM)} />
    ) : (
      <Chip label="Non configuré" size="small" sx={chipSx(NEUTRAL)} />
    );

  const saveKey = () => {
    const v = keyInput.trim();
    if (v) setApiKey.mutate(v, { onSuccess: () => setKeyInput('') });
  };

  const listSelect = (
    label: string,
    value: number | null,
    field: 'waitlistListId' | 'newsletterListId' | 'prospectsListId',
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
        <Box sx={{ mt: 0.25 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.2 }}>{label}</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{desc}</Typography>
        </Box>
      }
    />
  );

  return (
    <Paper
      elevation={0}
      sx={{ borderRadius: '12px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.75,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
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
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={600} sx={{ fontSize: '0.95rem', lineHeight: 1.25 }}>
            Brevo
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.25, lineHeight: 1.4 }}>
            Emailing &amp; newsletter · synchro des contacts (waitlist, newsletter, prospects)
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}>{statusChip}</Box>
      </Box>

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Clé API */}
        <Box>
          <Typography sx={labelSx}>Clé API Brevo (v3)</Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
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
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                bgcolor: BREVO_GREEN,
                '&:hover': { bgcolor: BREVO_GREEN, filter: 'brightness(0.94)' },
              }}
            >
              {setApiKey.isPending ? <CircularProgress size={16} color="inherit" /> : 'Enregistrer'}
            </Button>
          </Box>
          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.5 }}>
            Stockée chiffrée (AES-256), jamais affichée en clair. Brevo → SMTP &amp; API → Clés API.
          </Typography>
        </Box>

        {/* Test connexion */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => test.mutate()}
            disabled={!data.configured || test.isPending}
            startIcon={test.isPending ? <CircularProgress size={14} /> : <LinkIcon size={14} strokeWidth={2} />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Tester la connexion
          </Button>
          {data.lastTestedAt && (
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
              Dernier test : {new Date(data.lastTestedAt).toLocaleString('fr-FR')}
            </Typography>
          )}
        </Box>
        {test.data ? (
          <Alert severity={test.data.success ? 'success' : 'error'} sx={{ borderRadius: '8px', fontSize: '0.78rem', py: 0.25 }}>
            {test.data.message}
            {test.data.success ? ` — ${test.data.listCount} liste(s) trouvée(s).` : ''}
          </Alert>
        ) : data.status === 'ERROR' && data.errorMessage ? (
          <Alert severity="error" sx={{ borderRadius: '8px', fontSize: '0.78rem', py: 0.25 }}>
            {data.errorMessage}
          </Alert>
        ) : null}

        <Divider />

        {/* Mapping des listes */}
        <Box>
          <Typography sx={labelSx}>Listes Brevo</Typography>
          {!data.configured ? (
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.5 }}>
              Enregistre une clé API valide pour charger tes listes Brevo.
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                gap: 1,
                mt: 0.75,
              }}
            >
              {listSelect('Waitlist', data.waitlistListId, 'waitlistListId')}
              {listSelect('Newsletter', data.newsletterListId, 'newsletterListId')}
              {listSelect('Prospects / devis', data.prospectsListId, 'prospectsListId')}
            </Box>
          )}
        </Box>

        <Divider />

        {/* Toggles de synchro */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Typography sx={labelSx}>Synchronisations</Typography>
          {toggleRow('Waitlist → Brevo', 'Pousse les inscrits de la liste d’attente.', data.syncWaitlistEnabled, 'syncWaitlist')}
          {toggleRow('Newsletter → Brevo', 'Pousse les opt-in newsletter (inscription).', data.syncNewsletterEnabled, 'syncNewsletter')}
          {toggleRow('Leads devis → Brevo', 'Pousse les demandes de devis de la landing.', data.syncProspectsEnabled, 'syncProspects')}
          {toggleRow('Attributs de contact', 'Envoie NOM / VILLE / SOURCE pour segmenter.', data.syncAttributesEnabled, 'syncAttributes')}
        </Box>
      </Box>
    </Paper>
  );
}
