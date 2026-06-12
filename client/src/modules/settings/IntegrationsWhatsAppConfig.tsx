import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';
import { Settings2 } from 'lucide-react';
import { Link as LinkIcon, LinkOff as LinkOffIcon } from '../../icons';
import ServiceGridCard from './components/ServiceGridCard';
import IntegrationConfigDialog from './components/IntegrationConfigDialog';
import WhatsAppProviderConfigSection from './WhatsAppProviderConfigSection';
import { whatsAppConfigApi } from '../../services/api/whatsAppConfigApi';
import { getServicesByCategory } from '../../services/integrations/servicesCatalog';

const ACCENT = 'var(--ok)';
const WARM = 'var(--warn)';
const DANGER = 'var(--err)';

/** Le service catalogue WhatsApp (source de vérité visuelle : nom, couleur, desc). */
const WHATSAPP_SERVICE = getServicesByCategory('messaging').find(
  (s) => s.id === 'whatsapp_business',
);

/**
 * Section « Messagerie » de l'onglet Intégrations.
 *
 * <p>Card alignée sur le design des cartes « Objets connectés (IoT) »
 * ({@link OAuthProviderCard}) : pas de chevron, pas de chip « Configurable », mais
 * une <b>icône de configuration</b> (couleur warm tant que non configuré, neutre une
 * fois configuré) + une <b>icône de connexion</b> (lien vert pour connecter / lien
 * barré pour déconnecter) + le chip de statut Connecté / Non connecté.</p>
 *
 * <p>Au clic config/connexion, ouvre {@link IntegrationConfigDialog} contenant la
 * configuration du <b>compte WhatsApp Baitly GLOBAL</b> (singleton plateforme).</p>
 */
export default function IntegrationsWhatsAppConfig() {
  const [open, setOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ['whatsapp', 'config'],
    queryFn: () => whatsAppConfigApi.getConfig(),
    staleTime: 60_000,
    retry: false,
  });

  const disconnect = useMutation({
    mutationFn: () => whatsAppConfigApi.updateConfig({ enabled: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'config'] });
      setDisconnectOpen(false);
    },
  });

  if (!WHATSAPP_SERVICE) return null;
  const service = WHATSAPP_SERVICE;

  // Configuré = identifiants Meta saisis (token + phone number id). Connecté = configuré ET actif.
  const configured = !!(config?.hasApiToken && config?.phoneNumberId);
  const connected = configured && !!config?.enabled;

  const closeConfig = () => {
    setOpen(false);
    // La config a pu changer dans le dialog → rafraîchit l'état de la card.
    queryClient.invalidateQueries({ queryKey: ['whatsapp', 'config'] });
  };

  // Icône config : warm tant que non configuré, neutre une fois configuré (même règle que Tuya/Netatmo).
  const configAction = (
    <Tooltip title={configured ? 'Configuration WhatsApp · Modifier' : 'Configurer le compte WhatsApp'} arrow>
      <IconButton
        size="small"
        onClick={() => setOpen(true)}
        aria-label="Configurer WhatsApp"
        sx={{ color: configured ? 'text.secondary' : WARM, '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Settings2 size={16} strokeWidth={2} />
      </IconButton>
    </Tooltip>
  );

  // Icône connexion : lien vert pour connecter/activer, lien barré (rouge au hover) pour déconnecter.
  const connectionAction = connected ? (
    <Tooltip title="Déconnecter (désactiver l'envoi WhatsApp)" arrow>
      <span>
        <IconButton
          size="small"
          onClick={() => setDisconnectOpen(true)}
          disabled={disconnect.isPending}
          aria-label="Déconnecter WhatsApp"
          sx={{ color: 'text.secondary', '&:hover': { color: DANGER, bgcolor: 'var(--err-soft)' } }}
        >
          <LinkOffIcon size={16} strokeWidth={2} />
        </IconButton>
      </span>
    </Tooltip>
  ) : (
    <Tooltip title={configured ? "Activer l'envoi WhatsApp" : 'Connecter le compte WhatsApp'} arrow>
      <span>
        <IconButton
          size="small"
          onClick={() => setOpen(true)}
          aria-label="Connecter WhatsApp"
          sx={{ color: ACCENT, '&:hover': { bgcolor: 'var(--ok-soft)' } }}
        >
          <LinkIcon size={16} strokeWidth={2} />
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
    <>
      {/* Section + card : design identique aux cartes IoT (Objets connectés). */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          mt: 3,
          mb: 2,
          px: 2,
          py: 1.75,
        }}
      >
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}>
          Messagerie
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>
          Envoyez vos messages WhatsApp via l'API native du provider, sans intermédiaire.
          Compte WhatsApp unique pour toute la plateforme.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 1.5,
            mt: 1,
          }}
        >
          <ServiceGridCard
            serviceTooltipId={service.id}
            tooltipData={{
              description: service.tooltipDescription,
              accessModality: service.accessModality,
              websiteUrl: service.websiteUrl,
              region: service.region,
              name: service.name,
            }}
            label={service.name}
            description={service.shortDescription}
            status={connected ? 'connected' : 'idle'}
            onClick={() => setOpen(true)}
            logo={
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '8px',
                  backgroundColor: service.brandColor,
                  color: service.brandTextColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
                aria-hidden="true"
              >
                WA
              </Box>
            }
            actions={
              <>
                {configAction}
                {connectionAction}
              </>
            }
          />
        </Box>
      </Paper>

      {/* Dialog de config du compte WhatsApp global — coque modale standard. */}
      <IntegrationConfigDialog open={open} onClose={closeConfig} maxWidth="lg">
        <Paper elevation={0} sx={{ borderRadius: '12px', overflow: 'hidden' }}>
          {/* Header — uniforme avec les autres modales d'intégration. */}
          <Box
            sx={{
              px: 2,
              py: 1.75,
              display: 'flex',
              alignItems: 'center',
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
                backgroundColor: service.brandColor,
                color: service.brandTextColor,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
              aria-hidden="true"
            >
              WA
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 600 }}>
                {service.name}
              </Typography>
              <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>
                {service.shortDescription}
              </Typography>
            </Box>
          </Box>

          {/* Body — configuration du compte global (pas de sélecteur d'org). */}
          <Box sx={{ p: 2 }}>
            <WhatsAppProviderConfigSection />
          </Box>
        </Paper>
      </IntegrationConfigDialog>

      {/* Confirmation de déconnexion (désactivation de l'envoi). */}
      <Dialog open={disconnectOpen} onClose={() => setDisconnectOpen(false)}>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>Déconnecter WhatsApp ?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.85rem' }}>
            L'envoi de messages WhatsApp sera désactivé pour toute la plateforme. Les identifiants
            restent enregistrés : vous pourrez réactiver à tout moment.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisconnectOpen(false)} disabled={disconnect.isPending} sx={{ textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={() => disconnect.mutate()}
            color="error"
            variant="contained"
            disabled={disconnect.isPending}
            sx={{ textTransform: 'none', boxShadow: 'none' }}
          >
            {disconnect.isPending ? <CircularProgress size={14} color="inherit" /> : 'Déconnecter'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
