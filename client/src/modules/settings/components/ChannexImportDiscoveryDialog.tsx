/**
 * Channex Import Discovery Dialog — Import en masse depuis Channex
 *
 * Detecte les properties Channex qui n'ont pas encore de mapping Baitly
 * (typiquement creees automatiquement par Channex apres OAuth Airbnb) et
 * permet a l'admin de les importer en masse comme Properties Baitly avec
 * leurs metadonnees deja pre-remplies.
 *
 * Flow :
 *   1. Au montage : GET /integrations/channex/discover
 *   2. Liste les properties Channex non-mappees avec checkboxes
 *   3. Admin selectionne + override le type Baitly (APARTMENT/HOUSE/STUDIO/...)
 *   4. Click "Importer" → POST /integrations/channex/import
 *   5. Recap : N created, M skipped, K errors
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Box,
  Typography,
  Stack,
  CircularProgress,
  Alert,
  Checkbox,
  FormControl,
  Select,
  MenuItem,
  Button,
  Divider,
  Chip,
  ButtonBase,
} from '@mui/material';
import { X, Download, RefreshCw, CheckCircle2, AlertCircle, Info, Sparkles, Image as ImageIcon } from 'lucide-react';

import {
  channexApi,
  CHANNEX_OTA_OPTIONS,
  type ChannexConnectedOta,
  type ChannexDiscoveredProperty,
  type ChannexImportItem,
  type ChannexImportResult,
  type ChannexOtaCode,
} from '../../../services/api/channexApi';
import ChannexEmbedDialog from './ChannexEmbedDialog';
import OtaSyncBadges, { OTA_LOGO_BY_CODE } from './OtaSyncBadges';
import ChannexImportProgressStepper from './ChannexImportProgressStepper';
import { PROPERTY_TYPES } from '../../../utils/statusUtils';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAuth } from '../../../hooks/useAuth';
import { organizationsApi, type OrganizationDto } from '../../../services/api/organizationsApi';
import { usersApi, type User } from '../../../services/api/usersApi';

interface ChannexImportDiscoveryDialogProps {
  open: boolean;
  onClose: () => void;
  /** Callback declenche apres un import reussi (>=1 property creee) pour refresh la liste parent. */
  onImported?: () => void;
  /**
   * Callback invoque quand l'utilisateur clique sur le CTA "Connecter une propriete
   * Baitly" depuis l'etat vide (hub sans aucune propriete) : permet au parent de
   * fermer ce sub-dialog et de basculer la vue principale sur 'CONNECT_EXISTING'.
   */
  onRequestConnectExisting?: () => void;
}

const ACCENT = 'var(--accent)';

interface RowState {
  selected: boolean;
  propertyType: string; // overridable depuis suggestedType
}

export default function ChannexImportDiscoveryDialog({
  open,
  onClose,
  onImported,
  onRequestConnectExisting,
}: ChannexImportDiscoveryDialogProps) {
  const { t } = useTranslation();
  const { isPlatformStaff } = useAuth();
  const staffMode = isPlatformStaff();

  // Options du dropdown propertyType : source unique = PROPERTY_TYPES dans
  // utils/statusUtils.ts (synchronise avec l'enum PropertyType cote backend).
  // Memoizee pour eviter le re-render des Select MUI a chaque map().
  const propertyTypeOptions = React.useMemo(
    () => PROPERTY_TYPES.map((pt) => ({ value: pt.value, label: t(pt.i18nKey) })),
    [t],
  );

  // ─── Multi-tenant override (SUPER_ADMIN / SUPER_MANAGER uniquement) ─────
  // Permet de creer la Property dans une autre org + l'attribuer a un autre
  // user. Pour les non-staff, l'owner est auto = self (current user).
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [usersInOrg, setUsersInOrg] = useState<User[]>([]);
  const [targetOrgId, setTargetOrgId] = useState<number | ''>('');
  const [targetOwnerId, setTargetOwnerId] = useState<number | ''>('');

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState<ChannexDiscoveredProperty[]>([]);
  const [totalInHub, setTotalInHub] = useState(0);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [importResult, setImportResult] = useState<ChannexImportResult | null>(null);

  // OAuth global : etat de l'iframe a charger apres choix de l'OTA dans l'etat "Hub vide"
  const [settingUpOta, setSettingUpOta] = useState<ChannexOtaCode | null>(null);
  const [oauthEmbed, setOauthEmbed] = useState<{
    url: string;
    channelCode: ChannexOtaCode;
    /** true si on rouvre un OAuth existant (cas re-detection listings). */
    isRedetection: boolean;
  } | null>(null);

  // OTAs deja connectes (charges en parallele de la discovery) pour proposer
  // "Re-detecter mes listings" sur les OTAs deja OAuth (au lieu de tout recreer).
  const [connectedOtas, setConnectedOtas] = useState<ChannexConnectedOta[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setImportResult(null);
    try {
      // Charge en parallele la discovery + la liste des OTAs deja connectes,
      // pour pouvoir proposer "Re-detecter listings {OTA}" si un OAuth existe.
      const [discoveryRes, otas] = await Promise.all([
        channexApi.discoverUnmappedProperties(),
        channexApi.listConnectedOtas().catch(() => [] as ChannexConnectedOta[]),
      ]);
      setDiscovered(discoveryRes.items);
      setTotalInHub(discoveryRes.totalInHub);
      setConnectedOtas(otas);
      // Initialise rows : etat initial = etat actuel
      // - Importees : checkbox cochee par defaut (decocher = desimporter)
      // - Non-importees : checkbox vide par defaut (cocher = importer)
      const initial: Record<string, RowState> = {};
      for (const p of discoveryRes.items) {
        initial[p.channexPropertyId] = {
          selected: p.isImported,
          propertyType: p.suggestedType || 'APARTMENT',
        };
      }
      setRows(initial);
    } catch (err) {
      setError(err instanceof Error
        ? err.message
        : 'Impossible de detecter les proprietes du hub non encore importees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void refresh();
    } else {
      // Reset state a la fermeture pour repartir propre la prochaine fois
      setDiscovered([]);
      setTotalInHub(0);
      setRows({});
      setImportResult(null);
      setError(null);
      setSettingUpOta(null);
      setOauthEmbed(null);
      setConnectedOtas([]);
      setOrganizations([]);
      setUsersInOrg([]);
      setTargetOrgId('');
      setTargetOwnerId('');
    }
  }, [open, refresh]);

  // Charge la liste des organisations a l'ouverture (staff uniquement —
  // permet de selectionner l'org cible pour l'attribution de la property).
  useEffect(() => {
    if (!open || !staffMode) return;
    let cancelled = false;
    organizationsApi.listAll()
      .then((orgs) => { if (!cancelled) setOrganizations(orgs); })
      .catch(() => { /* silencieux — pas critique pour l'import */ });
    return () => { cancelled = true; };
  }, [open, staffMode]);

  // Charge la liste des users de l'org cible (refetch a chaque changement
  // d'org). Reset targetOwnerId si l'user precedent n'est plus dans la nouvelle org.
  useEffect(() => {
    if (!open || !staffMode || !targetOrgId) {
      setUsersInOrg([]);
      return;
    }
    let cancelled = false;
    usersApi.getAll()
      .then((all) => {
        if (cancelled) return;
        const inOrg = all.filter((u) => (u as { organizationId?: number }).organizationId === targetOrgId);
        setUsersInOrg(inOrg);
        // Reset owner si l'user precedent n'est plus valide
        if (targetOwnerId && !inOrg.some((u) => u.id === targetOwnerId)) {
          setTargetOwnerId('');
        }
      })
      .catch(() => { /* silencieux */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staffMode, targetOrgId]);

  const selectedCount = useMemo(
    () => Object.values(rows).filter((r) => r.selected).length,
    [rows],
  );

  // Diff entre l'etat actuel (rows) et l'etat initial (discovered[i].isImported) :
  // - toImport       : checkboxes cochees sur des proprietes NON-importees
  // - toDisconnect   : checkboxes decochees sur des proprietes IMPORTEES
  const diff = useMemo(() => {
    const toImport: ChannexDiscoveredProperty[] = [];
    const toDisconnect: ChannexDiscoveredProperty[] = [];
    for (const p of discovered) {
      const selected = rows[p.channexPropertyId]?.selected ?? p.isImported;
      if (selected && !p.isImported) toImport.push(p);
      else if (!selected && p.isImported) toDisconnect.push(p);
    }
    return { toImport, toDisconnect };
  }, [discovered, rows]);
  const hasChanges = diff.toImport.length + diff.toDisconnect.length > 0;

  const toggleAll = (checked: boolean) => {
    setRows((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], selected: checked };
      }
      return next;
    });
  };

  const toggleRow = (channexId: string, checked: boolean) => {
    setRows((prev) => ({
      ...prev,
      [channexId]: { ...prev[channexId], selected: checked },
    }));
  };

  const updateType = (channexId: string, type: string) => {
    setRows((prev) => ({
      ...prev,
      [channexId]: { ...prev[channexId], propertyType: type },
    }));
  };

  /**
   * Demarre l'OAuth global pour un OTA choisi (cas premier connect) OU rouvre
   * le widget sur un channel existant (cas re-detection de nouveaux listings).
   *
   * @param code              code OTA (ABB, BDC, ...)
   * @param existingChannelId si fourni, reutilise ce channel (preserve OAuth) au
   *                          lieu de creer une nouvelle session
   */
  const handleSetupOauth = async (code: ChannexOtaCode, existingChannelId?: string) => {
    setSettingUpOta(code);
    setError(null);
    try {
      const res = await channexApi.setupOauth(code, existingChannelId);
      setOauthEmbed({
        url: res.embedUrl,
        channelCode: code,
        isRedetection: !!existingChannelId,
      });
    } catch (err) {
      setError(err instanceof Error
        ? `Impossible de demarrer la connexion OTA : ${err.message}`
        : 'Impossible de demarrer la connexion OTA.');
    } finally {
      setSettingUpOta(null);
    }
  };

  /**
   * Applique le diff calcule (imports + disconnects) en sequence.
   * Imports d'abord, puis disconnects pour eviter qu'une property soit
   * supprimee avant que les imports references soient resolus.
   */
  const handleApply = async () => {
    if (!hasChanges) {
      setError('Aucune modification a appliquer.');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      // 1. Imports en masse (nouvelles cases cochees)
      let importResult: ChannexImportResult | null = null;
      if (diff.toImport.length > 0) {
        const imports: ChannexImportItem[] = diff.toImport.map((p) => ({
          channexPropertyId: p.channexPropertyId,
          propertyType: rows[p.channexPropertyId].propertyType,
        }));
        // Override staff : si SUPER_* a renseigne org + owner, on les passe.
        // Backend valide la coherence (user appartient bien a l'org cible).
        const overrides = staffMode && targetOrgId && targetOwnerId
          ? { targetOrganizationId: targetOrgId, targetOwnerId }
          : undefined;
        importResult = await channexApi.importProperties(imports, overrides);
      }

      // 2. Disconnects (cases decochees sur des proprietes importees)
      //    Chaque appel supprime le mapping Channex local + libere la Property
      //    Baitly de la sync hub (la Property elle-meme est conservee).
      let disconnectedCount = 0;
      const disconnectErrors: string[] = [];
      for (const p of diff.toDisconnect) {
        if (p.clenzyPropertyId == null) continue;
        try {
          await channexApi.disconnect(p.clenzyPropertyId);
          disconnectedCount++;
        } catch (err) {
          disconnectErrors.push(`${p.title}: ${err instanceof Error ? err.message : 'erreur'}`);
        }
      }

      // 3. Synthese visuelle
      setImportResult({
        totalRequested: diff.toImport.length + diff.toDisconnect.length,
        created: importResult?.created ?? 0,
        skipped: importResult?.skipped ?? 0,
        errors: (importResult?.errors ?? 0) + disconnectErrors.length,
        details: [
          ...(importResult?.details ?? []),
          ...diff.toDisconnect
            .flatMap((p) => !disconnectErrors.some((e) => e.startsWith(p.title))
              ? [{
                  channexPropertyId: p.channexPropertyId,
                  status: 'CREATED' as const, // reuse type, on differencie via message
                  clenzyPropertyId: p.clenzyPropertyId,
                  message: `Desimportee : "${p.title}" (Property Baitly conservee, sync hub arretee)`,
                }]
              : []),
        ],
      });

      if (disconnectErrors.length > 0) {
        setError('Certains disconnects ont echoue : ' + disconnectErrors.join(' · '));
      }

      // Refresh : les statuts ont change, recharger la liste
      if ((importResult?.created ?? 0) > 0 || disconnectedCount > 0) {
        if (onImported) onImported();
        // On refresh la discovery apres un court delai (laisse le user voir le recap)
        setTimeout(() => { void refresh(); }, 500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Echec de l\'operation.');
    } finally {
      setImporting(false);
    }
  };

  const allSelected = discovered.length > 0
    && discovered.every((p) => rows[p.channexPropertyId]?.selected);
  const someSelected = !allSelected && selectedCount > 0;

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: 'min(70vh, 700px)' } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          pb: 1.5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: 'var(--accent-soft)',
              color: ACCENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Download size={18} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.3 }}>
              Importer une propriete deja en ligne
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
              Detecte les listings Airbnb/Booking/Vrbo deja connus du hub de distribution et non encore dans Baitly
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small" aria-label="Fermer">
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Phase 1 UX : Stepper visuel 3 etapes (Autoriser → Detecter → Synchroniser)
            qui montre ou en est l'utilisateur dans le flow Connect, base sur l'etat
            reel (nb OTAs connectes, nb properties detectees, nb importees). */}
        <Box sx={{ mb: 1.5 }}>
          <ChannexImportProgressStepper
            connectedOtaCount={connectedOtas.filter((o) => o.isActive || o.hasOauthToken).length}
            totalInHub={totalInHub}
            importedCount={discovered.filter((p) => p.isImported).length}
          />
        </Box>

        {/* Banner d'aide */}
        <Stack
          direction="row"
          alignItems="flex-start"
          spacing={1}
          sx={{
            p: 1.25,
            mb: 2,
            borderRadius: 1,
            bgcolor: 'color-mix(in srgb, var(--accent) 4%, transparent)',
            border: '1px solid',
            borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
          }}
        >
          <Box sx={{ color: ACCENT, mt: 0.25, flexShrink: 0 }}>
            <Info size={14} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            Apres avoir connecte votre compte Airbnb (ou autre OTA) via le widget de configuration,
            tous vos listings detectes apparaissent ici. Selectionnez ceux a importer dans
            Baitly — leur nom, devise, pays et capacite sont pre-remplis automatiquement.
          </Typography>
        </Stack>

        {/* Loading initial */}
        {loading && (
          <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 6 }}>
            <CircularProgress size={24} thickness={4} />
            <Typography variant="body2" color="text.secondary">
              Recherche des proprietes en ligne...
            </Typography>
          </Stack>
        )}

        {/* Erreur */}
        {error && !loading && (
          <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Recap apres import */}
        {importResult && (
          <Alert
            severity={importResult.errors > 0 ? 'warning' : 'success'}
            variant="outlined"
            sx={{ mb: 2 }}
          >
            <strong>{importResult.created}</strong> creees
            {importResult.skipped > 0 && (
              <> · <strong>{importResult.skipped}</strong> ignorees (deja mappees)</>
            )}
            {importResult.errors > 0 && (
              <> · <strong>{importResult.errors}</strong> erreurs</>
            )}
          </Alert>
        )}

        {/* Cas 1 : Hub vide (aucune propriete cote distribution)
            → on propose de connecter un OTA DIRECTEMENT depuis ce dialog
            (picker des 5 OTAs majeurs). Click sur une card declenche le
            setup-oauth backend qui cree une property pivot + ouvre l'iframe. */}
        {!loading && !error && discovered.length === 0 && totalInHub === 0 && !importResult && (
          <Box sx={{ py: 2, px: 1 }}>
            <Stack alignItems="center" sx={{ mb: 2.5, textAlign: 'center' }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: 'var(--accent-soft)',
                  color: ACCENT,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1.5,
                }}
              >
                <Info size={24} />
              </Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                Connectez un compte OTA pour importer vos listings
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', maxWidth: 500, lineHeight: 1.6 }}
              >
                Choisissez l'OTA sur lequel vous avez deja des proprietes en ligne.
                Apres authentification, Baitly detectera automatiquement vos listings
                et vous proposera de les importer.
              </Typography>
            </Stack>

            {/* Picker OTA inline (5 cards horizontales en grid responsive)
                + indication "Re-detecter" si un channel existe deja pour cet OTA */}
            <Stack spacing={1} sx={{ mb: 2 }}>
              {CHANNEX_OTA_OPTIONS.map((option) => {
                const isLoading = settingUpOta === option.code;
                const disabled = settingUpOta !== null && !isLoading;
                // Detecte si un channel pour cet OTA existe deja (OAuth fait)
                const existing = connectedOtas.find(
                  (ota) => ota.otaName.toLowerCase() === option.apiChannelName.toLowerCase()
                    || ota.otaName.toLowerCase() === option.name.toLowerCase()
                );
                return (
                  <ButtonBase
                    key={option.code}
                    onClick={() => handleSetupOauth(option.code, existing?.channelId)}
                    disabled={settingUpOta !== null}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      width: '100%',
                      p: 1.25,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: isLoading ? option.brandColor : 'divider',
                      bgcolor: isLoading ? `${option.brandColor}08` : 'background.paper',
                      textAlign: 'left',
                      cursor: settingUpOta !== null ? 'wait' : 'pointer',
                      opacity: disabled ? 0.45 : 1,
                      transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                      '&:hover': settingUpOta === null ? {
                        borderColor: option.brandColor,
                        bgcolor: `${option.brandColor}08`,
                        transform: 'translateX(2px)',
                      } : {},
                      '&:focus-visible': {
                        outline: `2px solid ${option.brandColor}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <Box
                      component="img"
                      src={OTA_LOGO_BY_CODE[option.code]}
                      alt={option.name}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        objectFit: 'contain',
                        bgcolor: 'var(--card)',
                        border: '1px solid',
                        borderColor: 'divider',
                        p: 0.5,
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                          {existing ? `Re-detecter mes listings ${option.name}` : `Connecter ${option.name}`}
                        </Typography>
                        {existing && (
                          <Chip
                            size="small"
                            icon={<CheckCircle2 size={11} />}
                            label="OAuth fait"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: 'var(--ok-soft)',
                              color: 'var(--ok)',
                              '& .MuiChip-icon': { color: 'var(--ok)', ml: 0.5 },
                            }}
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
                        {isLoading
                          ? 'Preparation de la connexion...'
                          : existing
                            ? 'Rouvre le wizard pour mapper de nouveaux listings ajoutes recemment'
                            : option.description}
                      </Typography>
                    </Box>
                    <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: isLoading ? option.brandColor : 'text.disabled' }}>
                      {isLoading
                        ? <CircularProgress size={14} thickness={5} sx={{ color: option.brandColor }} />
                        : <Typography variant="caption" sx={{ fontWeight: 600 }}>→</Typography>}
                    </Box>
                  </ButtonBase>
                );
              })}
            </Stack>

            {/* Action secondaire : si l'utilisateur prefere passer par une property Baitly existante */}
            {onRequestConnectExisting && (
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  Ou bien :
                </Typography>
                <Button
                  size="small"
                  onClick={onRequestConnectExisting}
                  sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.78rem' }}
                >
                  Connecter une propriete Baitly existante
                </Button>
                <Button
                  size="small"
                  startIcon={<RefreshCw size={12} />}
                  onClick={refresh}
                  sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.78rem' }}
                >
                  Rafraichir
                </Button>
              </Stack>
            )}
          </Box>
        )}

        {/* Cas 2 : Hub non vide mais tout deja importe */}
        {!loading && !error && discovered.length === 0 && totalInHub > 0 && !importResult && (
          <Box sx={{ py: 4, px: 2 }}>
            <Stack alignItems="center" sx={{ mb: 3, textAlign: 'center' }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: 'var(--ok-soft)',
                  color: 'var(--ok)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1.5,
                }}
              >
                <CheckCircle2 size={24} />
              </Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                Tout est synchronise
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 2, maxWidth: 480, lineHeight: 1.6 }}
              >
                Vos {totalInHub} propriete{totalInHub > 1 ? 's' : ''} en ligne {totalInHub > 1 ? 'sont' : 'est'} deja
                import{totalInHub > 1 ? 'ees' : 'ee'} dans Baitly. Si vous avez ajoute de nouvelles
                proprietes cote OTA depuis, re-detectez-les ci-dessous.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshCw size={14} />}
                onClick={refresh}
                sx={{ textTransform: 'none' }}
              >
                Verifier a nouveau
              </Button>
            </Stack>

            {/* Section "Re-detecter listings" : visible si au moins 1 OTA est connecte */}
            {connectedOtas.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={600}
                  sx={{ display: 'block', mb: 1, textAlign: 'center' }}
                >
                  Re-detecter de nouveaux listings ajoutes recemment cote OTA
                </Typography>
                <Stack spacing={1}>
                  {CHANNEX_OTA_OPTIONS
                    .flatMap((option) => {
                      const existing = connectedOtas.find(
                        (ota) => ota.otaName.toLowerCase() === option.apiChannelName.toLowerCase()
                          || ota.otaName.toLowerCase() === option.name.toLowerCase()
                      );
                      if (!existing) return [];
                      const isLoading = settingUpOta === option.code;
                      return [
                        <ButtonBase
                          key={option.code}
                          onClick={() => handleSetupOauth(option.code, existing.channelId)}
                          disabled={settingUpOta !== null}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            width: '100%',
                            p: 1.25,
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: isLoading ? option.brandColor : 'divider',
                            bgcolor: isLoading ? `${option.brandColor}08` : 'background.paper',
                            textAlign: 'left',
                            cursor: settingUpOta !== null ? 'wait' : 'pointer',
                            transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                            '&:hover': settingUpOta === null ? {
                              borderColor: option.brandColor,
                              bgcolor: `${option.brandColor}08`,
                            } : {},
                          }}
                        >
                          <Box
                            component="img"
                            src={OTA_LOGO_BY_CODE[option.code]}
                            alt={option.name}
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: 1,
                              objectFit: 'contain',
                              bgcolor: 'var(--card)',
                              border: '1px solid',
                              borderColor: 'divider',
                              p: 0.5,
                              flexShrink: 0,
                            }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                              Re-detecter mes listings {option.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
                              {isLoading
                                ? 'Ouverture du widget...'
                                : 'Rouvre le wizard onglet Listing pour mapper de nouveaux listings'}
                            </Typography>
                          </Box>
                          <Box sx={{ flexShrink: 0, color: isLoading ? option.brandColor : 'text.disabled' }}>
                            {isLoading
                              ? <CircularProgress size={14} thickness={5} sx={{ color: option.brandColor }} />
                              : <Typography variant="caption" sx={{ fontWeight: 600 }}>→</Typography>}
                          </Box>
                        </ButtonBase>,
                      ];
                    })}
                </Stack>
              </>
            )}
          </Box>
        )}

        {/* Liste des properties non-mappees */}
        {!loading && discovered.length > 0 && (
          <>
            {/* Header avec resume du diff (au lieu de select-all classique) */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1,
                px: 1.5,
                borderRadius: 1,
                bgcolor: 'background.default',
                mb: 1,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                {discovered.length} propriete{discovered.length > 1 ? 's' : ''} dans le hub
                {diff.toImport.length > 0 && (
                  <> · <Box component="span" sx={{ color: ACCENT, fontWeight: 600 }}>
                    +{diff.toImport.length} a importer
                  </Box></>
                )}
                {diff.toDisconnect.length > 0 && (
                  <> · <Box component="span" sx={{ color: 'var(--err)', fontWeight: 600 }}>
                    −{diff.toDisconnect.length} a desimporter
                  </Box></>
                )}
              </Typography>
              <Button
                size="small"
                startIcon={<RefreshCw size={12} />}
                onClick={refresh}
                sx={{ textTransform: 'none', color: 'text.secondary' }}
              >
                Rafraichir
              </Button>
            </Box>

            {/* Banner info si user a coche des desimports (perte sync) */}
            {diff.toDisconnect.length > 0 && (
              <Alert severity="warning" variant="outlined" sx={{ mb: 1, fontSize: '0.78rem' }}>
                <strong>{diff.toDisconnect.length} propriete{diff.toDisconnect.length > 1 ? 's' : ''}</strong>
                {' '}va etre desimport{diff.toDisconnect.length > 1 ? 'ees' : 'ee'} : le lien avec le hub sera
                supprime mais la Property Baitly correspondante sera conservee (vous pourrez la re-importer
                plus tard).
              </Alert>
            )}

            <Stack spacing={0.5}>
              {discovered.map((p) => {
                const row = rows[p.channexPropertyId] ?? { selected: p.isImported, propertyType: 'APARTMENT' };
                // Etat visuel par diff :
                // - importee & cochee → couleur verte (existante, conservee)
                // - importee & decochee → couleur rouge (sera desimportee)
                // - non-importee & cochee → couleur accent (sera importee)
                // - non-importee & decochee → neutre (ignoree)
                let borderCol = 'divider';
                let bgCol = 'background.paper';
                if (p.isImported && row.selected) {
                  borderCol = 'var(--ok)';
                  bgCol = 'color-mix(in srgb, var(--ok) 4%, transparent)';
                } else if (p.isImported && !row.selected) {
                  borderCol = 'var(--err)';
                  bgCol = 'color-mix(in srgb, var(--err) 4%, transparent)';
                } else if (!p.isImported && row.selected) {
                  borderCol = ACCENT;
                  bgCol = 'color-mix(in srgb, var(--accent) 4%, transparent)';
                }
                return (
                  <Box
                    key={p.channexPropertyId}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      p: 1.25,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: borderCol,
                      bgcolor: bgCol,
                      transition: 'all 180ms ease-out',
                    }}
                  >
                    <Checkbox
                      checked={row.selected}
                      onChange={(e) => toggleRow(p.channexPropertyId, e.target.checked)}
                      size="small"
                      sx={{
                        p: 0.5,
                        color: p.isImported ? 'var(--ok)' : ACCENT,
                        '&.Mui-checked': { color: p.isImported ? 'var(--ok)' : ACCENT },
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ mr: 0.5 }}>
                          {p.title || 'Sans titre'}
                        </Typography>
                        {p.isImported && (
                          <Chip
                            size="small"
                            icon={<CheckCircle2 size={11} />}
                            label={row.selected
                              ? `Importee${p.clenzyPropertyName ? ` (${p.clenzyPropertyName})` : ''}`
                              : 'Sera desimportee'}
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: row.selected ? 'var(--ok-soft)' : 'var(--err-soft)',
                              color: row.selected ? 'var(--ok)' : 'var(--err)',
                              '& .MuiChip-icon': {
                                color: row.selected ? 'var(--ok)' : 'var(--err)',
                                ml: 0.5,
                              },
                            }}
                          />
                        )}
                        {/* "Actif" est affiche dans la colonne droite (a cote des
                            logos OTA) — pas dans la rangee titre. */}
                        {/* Indicateur d'auto-creation cote Channex pendant l'import :
                            si room_type ou rate_plan manquent, on les creera automatiquement
                            (le user sait a quoi s'attendre avant de cliquer Importer). */}
                        {(!p.hasRoomType || !p.hasRatePlan) && (
                          <Chip
                            size="small"
                            icon={<Sparkles size={11} />}
                            label={
                              !p.hasRoomType && !p.hasRatePlan
                                ? 'Room + Rate auto-crees'
                                : !p.hasRoomType ? 'Room auto-cree' : 'Rate auto-cree'
                            }
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: 'var(--warn-soft)',
                              color: 'var(--warn)',
                              '& .MuiChip-icon': { color: 'var(--warn)', ml: 0.5 },
                            }}
                          />
                        )}
                        {/* Contenu enrichi disponible (photos, description, address) :
                            visible quand le tier de distribution payant sync depuis Airbnb. */}
                        {p.photoCount > 0 && (
                          <Chip
                            size="small"
                            icon={<ImageIcon size={11} />}
                            label={`${p.photoCount} photo${p.photoCount > 1 ? 's' : ''}`}
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: 'var(--info-soft)',
                              color: 'var(--info)',
                              '& .MuiChip-icon': { color: 'var(--info)', ml: 0.5 },
                            }}
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
                        {[
                          p.country,
                          p.currency,
                          p.maxOccupancy ? `${p.maxOccupancy} pers max` : null,
                          p.hasAddress ? '✓ adresse' : null,
                          p.hasDescription ? '✓ description' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                      {/* Donnees STRUCTUREES OTA (rate_plan.settings) — pas de
                          scraping HTML. Chaque chip correspond a un champ JSON
                          de Channex (fiable et verifiable). Bedrooms/beds/baths/
                          maxGuests reels ne sont pas exposes par Channex public
                          (whitelabel only) donc absents ici. */}
                      {(p.otaListingType || p.otaNightlyPrice != null
                        || p.otaMinNights != null || p.otaMaxNights != null
                        || p.otaCheckOutTime != null || p.otaGuestsIncluded != null
                        || p.otaCancellationPolicy || p.otaInstantBooking
                        || p.otaAllowsPets != null) && (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" alignItems="center" sx={{ mt: 0.5, gap: 0.5 }}>
                          {/* Type listing brut (donnee structuree primaire) */}
                          {p.otaListingType && (
                            <Chip size="small" label={`Type OTA : ${p.otaListingType}`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--info-soft)', color: 'var(--info)', fontFamily: 'monospace' }} />
                          )}
                          {/* Tarifs */}
                          {p.otaNightlyPrice != null && (
                            <Chip size="small" label={`${p.otaNightlyPrice} ${p.currency || 'EUR'} / nuit`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--ok-soft)', color: 'var(--ok)' }} />
                          )}
                          {p.otaWeekendPrice != null && p.otaWeekendPrice !== p.otaNightlyPrice && (
                            <Chip size="small" label={`weekend : ${p.otaWeekendPrice} ${p.currency || 'EUR'}`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--ok-soft)', color: 'var(--ok)' }} />
                          )}
                          {p.otaGuestsIncluded != null && (
                            <Chip size="small" label={`${p.otaGuestsIncluded} voyageur${p.otaGuestsIncluded > 1 ? 's' : ''} inclus`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--info-soft)', color: 'var(--info)' }} />
                          )}
                          {p.otaPricePerExtraPerson != null && p.otaPricePerExtraPerson > 0 && (
                            <Chip size="small" label={`+${p.otaPricePerExtraPerson} ${p.currency || 'EUR'} / voyageur supp.`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--info-soft)', color: 'var(--info)' }} />
                          )}
                          {p.otaMonthlyPriceFactor != null && p.otaMonthlyPriceFactor > 0 && (
                            <Chip size="small" label={`-${p.otaMonthlyPriceFactor}% mensuel`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--field)', color: 'var(--muted)' }} />
                          )}
                          {/* Sejour */}
                          {p.otaMinNights != null && (
                            <Chip size="small" label={`min ${p.otaMinNights} nuit${p.otaMinNights > 1 ? 's' : ''}`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--warn-soft)', color: 'var(--warn)' }} />
                          )}
                          {p.otaMaxNights != null && p.otaMaxNights < 365 && (
                            <Chip size="small" label={`max ${p.otaMaxNights} nuits`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--warn-soft)', color: 'var(--warn)' }} />
                          )}
                          {/* Check-in/out */}
                          {p.otaCheckOutTime != null && (
                            <Chip size="small" label={`check-out ${p.otaCheckOutTime}h`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--info-soft)', color: 'var(--info)' }} />
                          )}
                          {p.otaCheckInTimeStart && p.otaCheckInTimeStart !== 'FLEXIBLE' && (
                            <Chip size="small" label={`check-in ${p.otaCheckInTimeStart}h`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--info-soft)', color: 'var(--info)' }} />
                          )}
                          {/* Politiques */}
                          {p.otaCancellationPolicy && (
                            <Chip size="small" label={`annulation : ${p.otaCancellationPolicy}`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--err-soft)', color: 'var(--err)' }} />
                          )}
                          {p.otaInstantBooking && (
                            <Chip size="small" label={`booking : ${p.otaInstantBooking}`}
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--err-soft)', color: 'var(--err)' }} />
                          )}
                          {/* Regles du logement (true uniquement = autorise par le host) */}
                          {p.otaAllowsPets === true && (
                            <Chip size="small" label="animaux acceptes"
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--field)', color: 'var(--muted)' }} />
                          )}
                          {p.otaAllowsSmoking === true && (
                            <Chip size="small" label="fumeurs acceptes"
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--field)', color: 'var(--muted)' }} />
                          )}
                          {p.otaAllowsEvents === true && (
                            <Chip size="small" label="evenements acceptes"
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'var(--field)', color: 'var(--muted)' }} />
                          )}
                        </Stack>
                      )}
                    </Box>
                    {/* Colonne droite : logos OTA + chip "Actif" en haut,
                        dropdown type Baitly en dessous. */}
                    <Stack direction="column" spacing={1} alignItems="flex-end" sx={{ flexShrink: 0 }}>
                      {(p.connectedOtas?.length > 0 || p.hasActiveOta) && (
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          {p.connectedOtas && p.connectedOtas.length > 0 && (
                            <OtaSyncBadges otas={p.connectedOtas} size={22} />
                          )}
                          {p.hasActiveOta && (
                            <Chip
                              size="small"
                              icon={<CheckCircle2 size={11} />}
                              label="Actif"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                bgcolor: 'var(--ok-soft)',
                                color: 'var(--ok)',
                                '& .MuiChip-icon': { color: 'var(--ok)', ml: 0.5 },
                              }}
                            />
                          )}
                        </Stack>
                      )}
                      {/* Dropdown type Baitly : visible UNIQUEMENT pour les nouveaux
                          imports (proprietes non-importees). */}
                      {!p.isImported && (
                        <FormControl size="small" sx={{ minWidth: 130 }}>
                          <Select
                            value={row.propertyType}
                            onChange={(e) => updateType(p.channexPropertyId, e.target.value)}
                            disabled={!row.selected}
                            sx={{ fontSize: '0.8rem' }}
                          >
                            {propertyTypeOptions.map((opt) => (
                              <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.85rem' }}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>

            {/* Details du recap (errors / skipped) */}
            {importResult && importResult.details.some((d) => d.status !== 'CREATED') && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 1 }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                  Detail des cas particuliers
                </Typography>
                <Stack spacing={0.5}>
                  {importResult.details
                    .flatMap((d) => d.status !== 'CREATED' ? [
                      <Stack
                        key={d.channexPropertyId}
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ fontSize: '0.75rem' }}
                      >
                        <AlertCircle
                          size={12}
                          style={{ color: d.status === 'ERROR' ? 'var(--err)' : 'var(--warn)', flexShrink: 0 }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }} noWrap>
                          {d.channexPropertyId.slice(0, 8)} : {d.message}
                        </Typography>
                      </Stack>,
                    ] : [])}
                </Stack>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      {/* Footer avec bouton Import */}
      {!loading && discovered.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
            px: 3,
            py: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            flexWrap: 'wrap',
          }}
        >
          {/* Override multi-tenant — visible uniquement pour les platform staff
              (SUPER_ADMIN / SUPER_MANAGER). Permet d'attribuer la property creee
              a une autre org + un autre user (sinon owner = self). */}
          {staffMode && diff.toImport.length > 0 ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, flexShrink: 0 }}>
                Attribuer à :
              </Typography>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select
                  value={targetOrgId}
                  onChange={(e) => setTargetOrgId(e.target.value as number | '')}
                  displayEmpty
                  sx={{ fontSize: '0.8rem' }}
                  renderValue={(v) => v
                    ? (organizations.find((o) => o.id === v)?.name ?? `Org #${v}`)
                    : 'Mon organisation'}
                >
                  <MenuItem value="" sx={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
                    Mon organisation (par défaut)
                  </MenuItem>
                  {organizations.map((o) => (
                    <MenuItem key={o.id} value={o.id} sx={{ fontSize: '0.85rem' }}>
                      {o.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {targetOrgId !== '' && (
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <Select
                    value={targetOwnerId}
                    onChange={(e) => setTargetOwnerId(e.target.value as number | '')}
                    displayEmpty
                    sx={{ fontSize: '0.8rem' }}
                    renderValue={(v) => v
                      ? (() => {
                          const u = usersInOrg.find((x) => x.id === v);
                          if (!u) return `User #${v}`;
                          const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
                          return name || u.email || `User #${v}`;
                        })()
                      : 'Choisir un owner'}
                  >
                    {usersInOrg.length === 0 && (
                      <MenuItem value="" disabled sx={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
                        Aucun user dans cette org
                      </MenuItem>
                    )}
                    {usersInOrg.map((u) => {
                      const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
                      const label = fullName ? `${fullName} (${u.email})` : u.email;
                      return (
                        <MenuItem key={u.id} value={u.id} sx={{ fontSize: '0.85rem' }}>
                          {label}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              )}
            </Stack>
          ) : (
            <Box sx={{ flex: 1 }} />
          )}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          <Button onClick={onClose} size="small" sx={{ textTransform: 'none', color: 'text.secondary' }}>
            Fermer
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleApply}
            disabled={importing || !hasChanges}
            startIcon={importing ? <CircularProgress size={12} color="inherit" /> : <Download size={14} />}
            sx={{ textTransform: 'none' }}
          >
            {importing
              ? 'Application en cours...'
              : !hasChanges
                ? 'Aucune modification'
                : diff.toImport.length > 0 && diff.toDisconnect.length > 0
                  ? `Appliquer (${diff.toImport.length} import${diff.toImport.length > 1 ? 's' : ''} · ${diff.toDisconnect.length} desimport${diff.toDisconnect.length > 1 ? 's' : ''})`
                  : diff.toImport.length > 0
                    ? `Importer ${diff.toImport.length} propriete${diff.toImport.length > 1 ? 's' : ''}`
                    : `Desimporter ${diff.toDisconnect.length} propriete${diff.toDisconnect.length > 1 ? 's' : ''}`}
          </Button>
          </Stack>
        </Box>
      )}
    </Dialog>

    {/* iframe OAuth pour la connexion OTA "globale" depuis l'etat Hub vide.
        Sub-dialog imbrique : se ferme apres OAuth + trigger refresh de la
        discovery → les listings detectes apparaissent immediatement. */}
    <ChannexEmbedDialog
      open={oauthEmbed !== null}
      onClose={() => {
        setOauthEmbed(null);
        // Apres fermeture iframe : refresh la discovery pour faire apparaitre
        // les listings du compte OTA fraichement OAuth'es ou nouvellement mappes.
        void refresh();
      }}
      clenzyPropertyId={null}
      propertyName=""
      channelCode={oauthEmbed?.channelCode ?? null}
      prefetchedEmbedUrl={oauthEmbed?.url ?? null}
      bannerHint={oauthEmbed?.isRedetection ? 'remap_listings' : 'create_channel'}
    />
    </>
  );
}
