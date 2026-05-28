/**
 * Channex Embedded Dialog — Connexion OTAs (Airbnb, Booking, Vrbo, Expedia)
 *
 * Embarque le widget officiel Channex dans une iframe pour permettre a l'admin
 * de connecter ses comptes OTAs a une property deja mappee, sans quitter Baitly.
 *
 * Flux :
 *   1. Au clic sur le bouton "Connecter OTAs" dans ChannexMappingDialog,
 *      ce composant fetch une URL signee via channexApi.getEmbedUrl()
 *   2. La URL contient un token one-time valable 15 min
 *   3. La iframe charge le widget et l'utilisateur connecte ses OTAs
 *   4. A la fermeture du dialog → trigger pullBookings() pour rapatrier les
 *      reservations existantes sur les OTAs nouvellement connectes
 *
 * Ref Channex : docs.channex.io/api-v.1-documentation/channel-iframe
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Skeleton,
  Stack,
  Tooltip,
} from '@mui/material';
import { X, Link2, Info, RefreshCw } from 'lucide-react';

import {
  channexApi,
  CHANNEX_OTA_OPTIONS,
  type ChannexOtaCode,
} from '../../../services/api/channexApi';

interface ChannexEmbedDialogProps {
  open: boolean;
  onClose: () => void;
  /** Property Baitly a connecter aux OTAs (doit deja avoir un mapping Channex actif). */
  clenzyPropertyId: number | null;
  /** Nom affiche dans le header du dialog. */
  propertyName: string;
  /** Code OTA Channex pour pre-filtrer le wizard (ABB/BDC/...). null = tous OTAs. */
  channelCode?: ChannexOtaCode | null;
  /**
   * URL iframe pre-calculee (cas du flow auto-create channel via API).
   * Si fournie, on ne refait pas d'appel a getEmbedUrl — on charge directement
   * cette URL (qui pointe deja sur le channel cree avec OAuth en 1 clic).
   */
  prefetchedEmbedUrl?: string | null;
  /**
   * Mode d'utilisation du widget (controle le texte du banner d'aide) :
   * - 'create_channel' (defaut) : guide vers le bouton "+ Create" pour creer un nouveau channel OAuth
   * - 'remap_listings' : guide vers la ligne du channel existant + onglet "Listing" pour mapper de nouveaux listings OTA
   */
  bannerHint?: 'create_channel' | 'remap_listings';
  /** Callback declenche a la fermeture (utile pour trigger pullBookings cote parent). */
  onClosedAfterConnection?: () => void;
}

export default function ChannexEmbedDialog({
  open,
  onClose,
  clenzyPropertyId,
  propertyName,
  channelCode,
  prefetchedEmbedUrl,
  bannerHint = 'create_channel',
  onClosedAfterConnection,
}: ChannexEmbedDialogProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interacted, setInteracted] = useState(false);
  // Cle utilisee pour forcer le reload de l'iframe (cas typique : UI Channex
  // figee sur "Await your action" alors que l'OAuth a deja reussi en backend).
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const selectedOta = channelCode
    ? CHANNEX_OTA_OPTIONS.find((o) => o.code === channelCode) ?? null
    : null;

  // 1. URL de l'iframe : soit pre-fournie (flow auto-create channel OU OAuth
  // global sans property cible), soit fetchee a la volee (flow fallback :
  // liste vide + clic + Create). Le clenzyPropertyId est requis UNIQUEMENT
  // pour le fetch a la volee.
  useEffect(() => {
    if (!open) return;

    // Cas 1 : URL pre-fournie par le parent (flow optimal — channel deja cree
    // via API ou OAuth global setup, on ouvre direct l'iframe)
    if (prefetchedEmbedUrl) {
      setEmbedUrl(prefetchedEmbedUrl);
      setLoading(false);
      setError(null);
      setInteracted(false);
      return;
    }

    // Cas 2 : fetch a la volee — necessite clenzyPropertyId
    if (clenzyPropertyId == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEmbedUrl(null);
    setInteracted(false);

    channexApi
      .getEmbedUrl(clenzyPropertyId, 'fr', channelCode ?? undefined)
      .then((res) => {
        if (cancelled) return;
        setEmbedUrl(res.url);
      })
      .catch((err) => {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        // Cas frequent : la property Channex liee a ete supprimee cote Channex
        // (cleanup manuel, reset staging, etc.) → le mapping Baitly est stale.
        // On detecte les erreurs Channex 404 / "not found" / "property not found"
        // et on donne une instruction claire au lieu d'un message generique.
        const looksLikeStaleMapping = /not.?found|404|invalide.*api|property.*invalid|does not exist/i.test(raw);
        if (looksLikeStaleMapping) {
          setError(
            'La propriete liee au hub de distribution a ete supprimee ou n\'existe plus. '
              + 'Fermez ce dialog, deconnectez la propriete (icone corbeille rouge), '
              + 'puis reconnectez-la pour reparer le lien.'
          );
        } else {
          setError(raw || 'Impossible de generer le lien vers le hub de distribution.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, clenzyPropertyId, channelCode, prefetchedEmbedUrl]);

  // 2. Listener postMessage Channex (events depuis l'iframe)
  // Channex ne documente pas explicitement les events mais en emet (channel.connected, ...).
  // On loggue tout en dev pour debug, et on flag "interacted" pour declencher pullBookings au close.
  useEffect(() => {
    if (!open) return;

    const handleMessage = (event: MessageEvent) => {
      // Filtre minimum : on n'ecoute que les messages venant du domaine Channex
      const origin = event.origin || '';
      if (!origin.includes('channex.io')) return;

      // eslint-disable-next-line no-console
      console.debug('[ChannexEmbed] postMessage:', event.data);

      // Heuristique : si Channex emet un event "channel.*" ou "connected", on flag
      const data = event.data;
      if (typeof data === 'object' && data !== null) {
        const type = String(data.type || data.event || '').toLowerCase();
        if (type.includes('channel') || type.includes('connect')) {
          setInteracted(true);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [open]);

  // 3. A la fermeture, si l'utilisateur a interagi avec un channel → trigger pullBookings parent
  const handleClose = () => {
    onClose();
    if (interacted && onClosedAfterConnection) {
      onClosedAfterConnection();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { height: 'min(90vh, 900px)' } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 1.5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: selectedOta ? selectedOta.brandColor : 'rgba(15, 118, 110, 0.1)',
              color: selectedOta ? selectedOta.brandColorFg : '#0F766E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            {selectedOta ? selectedOta.initials : <Link2 size={18} />}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              fontWeight={600}
              noWrap
              sx={{ lineHeight: 1.2 }}
            >
              {selectedOta
                ? `Connecter ${selectedOta.name} — ${propertyName}`
                : `Connecter les OTAs — ${propertyName}`}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', lineHeight: 1.2 }}
            >
              {selectedOta
                ? `${selectedOta.description} · via le hub de distribution`
                : 'Airbnb · Booking.com · Vrbo · Expedia — via le hub'}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
          {embedUrl && (
            <Tooltip title="Rafraichir l'iframe (utile si bloque sur 'Await your action' apres OAuth)">
              <IconButton
                onClick={() => setIframeKey((k) => k + 1)}
                size="small"
                aria-label="Rafraichir"
              >
                <RefreshCw size={16} />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={handleClose} size="small" aria-label="Fermer">
            <X size={18} />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
        }}
      >
        {/* Banner d'aide : guide vers le bouton + Create de Channex si la
            liste s'affiche au lieu du wizard. Channex ne supporte pas toujours
            un deep-link direct vers le formulaire de creation. */}
        {embedUrl && !error && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.25,
              px: 2,
              py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'rgba(15, 118, 110, 0.04)',
            }}
          >
            <Box
              sx={{
                color: '#0F766E',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              <Info size={14} />
            </Box>
            {bannerHint === 'remap_listings' && selectedOta ? (
              // Vue specifique : OAuth deja fait, l'utilisateur doit naviguer
              // dans la liste de channels du wizard pour mapper de nouveaux
              // listings. Etapes numerotees car la UX Channex n'est pas
              // immediate (clic titre != clic Actions, onglet Listing pas
              // visible avant d'entrer dans le detail, etc.)
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    lineHeight: 1.5,
                    color: 'text.primary',
                    fontWeight: 600,
                    mb: 0.5,
                  }}
                >
                  OAuth{' '}
                  <Box component="span" sx={{ color: selectedOta.brandColor, fontWeight: 700 }}>
                    {selectedOta.name}
                  </Box>{' '}
                  deja actif — suivez ces 3 etapes pour mapper vos listings :
                </Typography>
                <Stack spacing={0.5}>
                  {[
                    {
                      step: 1,
                      content: (
                        <>
                          Ouvrez le detail du channel{' '}
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: 0.625,
                              py: 0.125,
                              borderRadius: 0.5,
                              bgcolor: `${selectedOta.brandColor}1A`,
                              color: selectedOta.brandColor,
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          >
                            New {selectedOta.name} Channel
                          </Box>
                          {' '}— cliquez sur le <strong>titre</strong>, ou sur{' '}
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: 0.625,
                              py: 0.125,
                              borderRadius: 0.5,
                              bgcolor: 'rgba(100, 116, 139, 0.15)',
                              color: 'text.secondary',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          >
                            Actions &rsaquo; Edit
                          </Box>
                          .
                        </>
                      ),
                    },
                    {
                      step: 2,
                      content: (
                        <>
                          Dans le detail, ouvrez l'onglet{' '}
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: 0.625,
                              py: 0.125,
                              borderRadius: 0.5,
                              bgcolor: 'rgba(16, 185, 129, 0.12)',
                              color: '#059669',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          >
                            Mapping
                          </Box>
                          {' '}— vos listings {selectedOta.name} s'affichent avec le
                          statut{' '}
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: 0.625,
                              py: 0.125,
                              borderRadius: 0.5,
                              bgcolor: 'rgba(220, 38, 38, 0.12)',
                              color: '#DC2626',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              textDecoration: 'underline',
                              textDecorationStyle: 'dashed',
                            }}
                          >
                            Not mapped
                          </Box>
                          .
                        </>
                      ),
                    },
                    {
                      step: 3,
                      content: (
                        <>
                          Cliquez sur{' '}
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: 0.625,
                              py: 0.125,
                              borderRadius: 0.5,
                              bgcolor: 'rgba(220, 38, 38, 0.12)',
                              color: '#DC2626',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          >
                            Not mapped
                          </Box>
                          {' '}→ un dropdown s'ouvre. Selectionnez une room + un rate
                          plan (le pivot Baitly si vous n'avez encore rien d'autre),
                          puis{' '}
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: 0.625,
                              py: 0.125,
                              borderRadius: 0.5,
                              bgcolor: 'rgba(16, 185, 129, 0.12)',
                              color: '#059669',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          >
                            Save
                          </Box>
                          . Fermez le wizard et cliquez{' '}
                          <strong>Re-detecter</strong> dans Baitly — la propriete
                          apparaitra (renommable a l'import).
                        </>
                      ),
                    },
                  ].map(({ step, content }) => (
                    <Stack key={step} direction="row" spacing={0.875} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          bgcolor: '#0F766E',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        {step}
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ lineHeight: 1.55, flex: 1 }}
                      >
                        {content}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                {prefetchedEmbedUrl && selectedOta ? (
                <>
                  Channel <strong>{selectedOta.name}</strong> deja cree dans le hub (title, devise, mapping pre-remplis).
                  Cliquez sur la ligne{' '}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 0.75,
                      py: 0.125,
                      borderRadius: 0.5,
                      bgcolor: `${selectedOta.brandColor}1A`,
                      color: selectedOta.brandColor,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}
                  >
                    {selectedOta.name} - {propertyName}
                  </Box>{' '}
                  dans la liste ci-dessous, puis sur le bouton{' '}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 0.75,
                      py: 0.125,
                      borderRadius: 0.5,
                      bgcolor: `${selectedOta.brandColor}1A`,
                      color: selectedOta.brandColor,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}
                  >
                    Connect with {selectedOta.name}
                  </Box>{' '}
                  pour finaliser l'{selectedOta.code === 'ABB' ? 'OAuth' : 'authentification'} — autorisez les popups.
                </>
              ) : selectedOta ? (
                <>
                  Cliquez sur{' '}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 0.75,
                      py: 0.125,
                      borderRadius: 0.5,
                      bgcolor: 'rgba(59, 130, 246, 0.1)',
                      color: '#3B82F6',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}
                  >
                    + Create
                  </Box>{' '}
                  en haut a droite, puis selectionnez{' '}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 0.75,
                      py: 0.125,
                      borderRadius: 0.5,
                      bgcolor: `${selectedOta.brandColor}1A`,
                      color: selectedOta.brandColor,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}
                  >
                    {selectedOta.name}
                  </Box>
                  . La connexion ouvre une fenetre {selectedOta.code === 'ABB' ? 'OAuth' : 'de credentials'} — autorisez les popups.
                </>
              ) : (
                <>
                  Si la liste de channels s'affiche vide, cliquez sur{' '}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 0.75,
                      py: 0.125,
                      borderRadius: 0.5,
                      bgcolor: 'rgba(59, 130, 246, 0.1)',
                      color: '#3B82F6',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}
                  >
                    + Create
                  </Box>{' '}
                  en haut a droite pour choisir un OTA (Airbnb, Booking.com, Vrbo, Expedia).
                  La connexion ouvre une fenetre OAuth chez l'OTA — autorisez les popups pour ce site.
                </>
              )}
            </Typography>
            )}
          </Box>
        )}

        {error && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          </Box>
        )}

        {loading && (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ flex: 1, p: 4 }}
          >
            <CircularProgress size={24} thickness={4} />
            <Typography variant="body2" color="text.secondary">
              Generation de la session de connexion...
            </Typography>
          </Stack>
        )}

        {!loading && !error && !embedUrl && (
          <Box sx={{ p: 2 }}>
            <Skeleton variant="rectangular" height="60vh" sx={{ borderRadius: 1 }} />
          </Box>
        )}

        {embedUrl && (
          <Box
            component="iframe"
            ref={iframeRef}
            // key={iframeKey} : changer la cle force React a recreer l'iframe →
            // nouvelle session Channex (utile si l'UI est figee apres OAuth).
            key={iframeKey}
            src={embedUrl}
            title="Widget de connexion OTA"
            sx={{
              flex: 1,
              width: '100%',
              border: 0,
              minHeight: 0,
            }}
            // PAS de sandbox : Channex est un provider de confiance qu'on embarque
            // consciemment. Le sandbox (meme permissif) casse la communication
            // entre l'iframe Channex et les popups OAuth qu'elle ouvre (Airbnb,
            // Booking) car les popups perdent leur reference window.opener quand
            // elles s'echappent du sandbox via allow-popups-to-escape-sandbox.
            // Resultat : l'iframe reste figee sur "Await your action at <OTA> side"
            // alors que l'OAuth a deja reussi cote serveur. Pas de sandbox = popups
            // peuvent notifier l'iframe correctement.
            allow="clipboard-write; popups"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
