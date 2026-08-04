/**
 * Channex Property Mapping Dialog
 *
 * Permet a un admin / manager de connecter / deconnecter / re-syncer les
 * properties de l'organisation avec leur equivalent Channex.
 *
 * Flux UX :
 *   1. Au clic sur la card Channex dans IntegrationsSection → ouverture du dialog
 *   2. Liste des properties Baitly + statut Channex (badge + tooltip)
 *   3. Property non connectee → bouton "Connecter" qui ouvre un sub-form
 *      avec 3 champs (property/room_type/rate_plan IDs Channex)
 *   4. Property connectee → boutons "Resync" + "Deconnecter"
 *
 * Reference : docs/strategy/channex-integration-plan.md (Sprint 5)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '../../../utils/cn';
import StatusChip from '../../../components/StatusChip';
import { Badge, Button } from '../../../components/ui';
import { Alert as UiAlert, AlertDescription } from '../../../components/ui';
import { TriangleAlert, Info } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { Field, FieldLabel, FieldDescription, Input } from '../../../components/ui';
import { Plus, RefreshCw, Trash2, CheckCircle2, AlertCircle, Clock, PauseCircle, ExternalLink, Download, Link2, ArrowLeft, ChevronRight, Globe, Home, Sparkles, Settings as SettingsIcon } from 'lucide-react';

import { useTranslation } from '../../../hooks/useTranslation';
import { propertiesApi, type Property } from '../../../services/api/propertiesApi';
import {
  channexApi,
  CHANNEX_OTA_OPTIONS,
  CHANNEX_STATUS_META,
  type ChannexConnectMode,
  type ChannexMappingDto,
  type ChannexOtaCode,
  type ChannexSyncStatus,
} from '../../../services/api/channexApi';
import ChannexEmbedDialog from './ChannexEmbedDialog';
import ChannexOtaPickerDialog from './ChannexOtaPickerDialog';
import ChannexImportDiscoveryDialog from './ChannexImportDiscoveryDialog';
import ChannexFullDisconnectDialog from './ChannexFullDisconnectDialog';
import ChannexPreflightBanner from './ChannexPreflightBanner';
import ChannexHealthSummaryPanel from './ChannexHealthSummaryPanel';
import ChannexDiagnoseDialog from './ChannexDiagnoseDialog';
import ChannexPriceDriftsDialog from './ChannexPriceDriftsDialog';
import { OTA_LOGO_BY_CODE } from './OtaSyncBadges';

interface ChannexMappingDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Mode guide (end-user) : utilise depuis le dashboard. Reformule l'ecran de
   * choix initial de maniere plus chaleureuse, masque le diagnostic technique
   * derriere un toggle discret, et degrade gracieusement si l'API Channex
   * (incomplete) echoue (les 3 cards restent cliquables). Defaut false =
   * comportement identique a l'integration Settings (inchange).
   */
  guided?: boolean;
}

interface ConnectFormState {
  open: boolean;
  property: Property | null;
  mode: ChannexConnectMode;
  channexPropertyId: string;
  channexRoomTypeId: string;
  channexDefaultRatePlanId: string;
  submitting: boolean;
  error: string | null;
}

const initialConnectForm: ConnectFormState = {
  open: false,
  property: null,
  mode: 'AUTO_CREATE',
  channexPropertyId: '',
  channexRoomTypeId: '',
  channexDefaultRatePlanId: '',
  submitting: false,
  error: null,
};

function StatusBadge({ status }: { status: ChannexSyncStatus }) {
  const meta = CHANNEX_STATUS_META[status];
  const icon = useMemo(() => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle2 size={14} strokeWidth={2} />;
      case 'PENDING':
        return <Clock size={14} strokeWidth={2} />;
      case 'ERROR':
        return <AlertCircle size={14} strokeWidth={2} />;
      case 'DISABLED':
        return <PauseCircle size={14} strokeWidth={2} />;
    }
  }, [status]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Tooltip pose une ref sur son enfant, que StatusChip ne transmet pas
            (React 18, composant fonction) : sans ce span, l'infobulle ne s'ancre pas. */}
        <span className="inline-flex">
          <StatusChip tokens={{ color: meta.color, bg: `${meta.color}1A` }} label={meta.label} icon={icon} className="text-[0.7rem]" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{meta.description}</TooltipContent>
    </Tooltip>
  );
}

// Carte d'action « choix » — style Signature (tokens, hover accent, sans
// transform). NB : `${ACCENT}1A` était invalide (var() + alpha) → on utilise
// les tokens dédiés var(--accent-soft).
const CHOICE_CARD_CLASS = [
  'flex items-center gap-[9px] w-full py-[14px] px-[16px] rounded-[12px]',
  'border border-solid border-[var(--line)] bg-[var(--card)] text-start cursor-pointer',
  'transition-[border-color,background-color] duration-150 motion-reduce:transition-none',
  'hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]',
  'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
].join(' ');

const CHOICE_ICON_CLASS = 'w-10 h-10 rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0';

export default function ChannexMappingDialog({ open, onClose, guided = false }: ChannexMappingDialogProps) {
  const { t } = useTranslation();
  /**
   * Mode guide : le diagnostic technique (ChannexPreflightBanner) est masque
   * par defaut et expose derriere ce toggle discret. Jamais de HTTP 401 /
   * CHANNEX_API_KEY auto-affiche a l'utilisateur final.
   */
  const [showTechStatus, setShowTechStatus] = useState(false);
  /**
   * Mode guide : si un appel channexApi echoue (API incomplete), on n'affiche
   * pas d'erreur effrayante mais une note calme. Les 3 cards restent cliquables.
   */
  const [guidedDegraded, setGuidedDegraded] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [mappings, setMappings] = useState<Map<number, ChannexMappingDto>>(new Map());
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [connectForm, setConnectForm] = useState<ConnectFormState>(initialConnectForm);
  const [busyPropertyId, setBusyPropertyId] = useState<number | null>(null);
  const [pickerDialog, setPickerDialog] = useState<{ open: boolean; property: Property | null }>({
    open: false,
    property: null,
  });
  const [embedDialog, setEmbedDialog] = useState<{
    open: boolean;
    property: Property | null;
    channelCode: ChannexOtaCode | null;
    /** URL iframe pre-fournie (flow auto-create channel via API). null = fetch a la volee. */
    prefetchedUrl: string | null;
  }>({ open: false, property: null, channelCode: null, prefetchedUrl: null });
  /**
   * Smart Disconnect orchestre (Quick Win #2) : remplace l'ancien confirm basique
   * pour la deconnexion. Au lieu d'effacer uniquement le mapping local (= ne
   * touche pas Channex, laisse les OTA bloques cote host), l'orchestrateur
   * desactive les channels OTA cote hub (= libere immediatement Airbnb/Booking),
   * supprime les channels, nettoie la DB locale, et affiche une checklist du
   * resultat par etape pour la transparence.
   */
  const [smartDisconnect, setSmartDisconnect] = useState<{
    open: boolean;
    property: Property | null;
  }>({ open: false, property: null });
  /**
   * Diagnose dialog (Quick Win #5) declenche depuis le HealthSummaryPanel.
   * Permet a l'admin d'agir directement depuis le tableau de bord sans avoir
   * a localiser la property dans la liste.
   */
  const [diagnoseTarget, setDiagnoseTarget] = useState<{
    propertyId: number;
    propertyName: string;
  } | null>(null);
  /** Phase 5 audit O1 : dialog Price Drifts (liste + resolution). */
  const [priceDriftsOpen, setPriceDriftsOpen] = useState(false);
  /**
   * Phase 5 audit UX fix : compteur de drifts actifs. On masque le bouton
   * "Voir les conflits" tant qu'il n'y en a aucun pour eviter la confusion
   * (un bouton orange visible signifierait un probleme alors qu'il n'y en a pas).
   */
  const [activeDriftsCount, setActiveDriftsCount] = useState<number>(0);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  /**
   * Vue principale du dialog :
   * - 'CHOICE' : ecran de choix initial (3 cards)
   * - 'CONNECT_EXISTING' : liste des proprietes Baitly avec leur statut (sync, deconnexion, etc.)
   * - 'MANAGE_OTAS' : liste des channels OTA connectes au hub avec bouton Disconnect
   *   (le mode IMPORT_FROM_OTA bascule directement sur le sub-dialog ChannexImportDiscoveryDialog)
   */
  const [view, setView] = useState<'CHOICE' | 'CONNECT_EXISTING' | 'MANAGE_OTAS'>('CHOICE');
  // Etat de la vue MANAGE_OTAS : liste des channels chargee
  const [connectedOtas, setConnectedOtas] = useState<import('../../../services/api/channexApi').ChannexConnectedOta[]>([]);
  const [otasLoading, setOtasLoading] = useState(false);
  const [otasError, setOtasError] = useState<string | null>(null);
  const [disconnectOtaConfirm, setDisconnectOtaConfirm] = useState<
    import('../../../services/api/channexApi').ChannexConnectedOta | null
  >(null);

  // Reset la vue a 'CHOICE' a chaque ouverture du dialog (pour repartir du choix initial)
  useEffect(() => {
    if (open) {
      setView('CHOICE');
      // Mode guide : on repart d'un etat propre (diagnostic replie, pas de note degradee)
      setShowTechStatus(false);
      setGuidedDegraded(false);
    }
  }, [open]);

  // Fetch les OTAs connectes quand on bascule sur la vue MANAGE_OTAS
  const refreshConnectedOtas = useCallback(async () => {
    setOtasLoading(true);
    setOtasError(null);
    try {
      const list = await channexApi.listConnectedOtas();
      setConnectedOtas(list);
    } catch (err) {
      // Mode guide : on n'affiche pas d'erreur technique. La vue MANAGE_OTAS
      // retombe sur son etat vide naturel (liste vide) + note calme.
      if (guided) {
        setConnectedOtas([]);
        setGuidedDegraded(true);
      } else {
        setOtasError(err instanceof Error
          ? err.message
          : 'Impossible de charger la liste des OTAs connectes.');
      }
    } finally {
      setOtasLoading(false);
    }
  }, [guided]);

  useEffect(() => {
    if (open && view === 'MANAGE_OTAS') {
      void refreshConnectedOtas();
    }
  }, [open, view, refreshConnectedOtas]);

  const handleDisconnectOta = async () => {
    const ota = disconnectOtaConfirm;
    if (!ota) return;
    setDisconnectOtaConfirm(null);
    try {
      await channexApi.disconnectOta(ota.channelId);
      // Recharger la liste apres suppression
      await refreshConnectedOtas();
    } catch (err) {
      setOtasError(err instanceof Error
        ? `Echec de la deconnexion : ${err.message}`
        : 'Echec de la deconnexion.');
    }
  };

  /**
   * Fetch le compteur de drifts actifs en best-effort. Si l'API renvoie une
   * erreur (role insuffisant, network, etc.) on garde 0 (= le bouton reste
   * masque) plutot que de polluer la UI avec un message d'erreur secondaire.
   */
  const refreshDriftsCount = useCallback(async () => {
    try {
      const drifts = await channexApi.listPriceDrifts();
      setActiveDriftsCount(Array.isArray(drifts) ? drifts.length : 0);
    } catch {
      setActiveDriftsCount(0);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const [propsRes, mappingsRes] = await Promise.all([
        propertiesApi.getAll({ size: 200 }),
        channexApi.listMappings(),
      ]);
      const list = Array.isArray(propsRes) ? propsRes : [];
      setProperties(list);
      const map = new Map<number, ChannexMappingDto>();
      for (const m of mappingsRes) map.set(m.clenzyPropertyId, m);
      setMappings(map);
    } catch (err) {
      // Mode guide : degradation gracieuse. Le chargement des mappings peut
      // echouer (API Channex incomplete) alors que la liste des proprietes a
      // pu charger ; on conserve ce qu'on a et on affiche une note calme au
      // lieu d'une erreur technique. Les 3 cards restent cliquables.
      if (guided) {
        setGuidedDegraded(true);
      } else {
        setGlobalError(err instanceof Error ? err.message : 'Erreur lors du chargement.');
      }
    } finally {
      setLoading(false);
    }
    // Fetch parallele du compteur de drifts (best-effort, ne bloque pas le main)
    void refreshDriftsCount();
  }, [refreshDriftsCount, guided]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleConnectClick = (property: Property) => {
    setConnectForm({ ...initialConnectForm, open: true, property });
  };

  const handleConnectSubmit = async () => {
    if (!connectForm.property) return;

    // Validation conditionnelle selon le mode
    const payload: import('../../../services/api/channexApi').ChannexConnectRequest = {
      mode: connectForm.mode,
    };

    if (connectForm.mode === 'IMPORT_EXISTING') {
      const ids = {
        channexPropertyId: connectForm.channexPropertyId.trim(),
        channexRoomTypeId: connectForm.channexRoomTypeId.trim(),
        channexDefaultRatePlanId: connectForm.channexDefaultRatePlanId.trim(),
      };
      if (!ids.channexPropertyId || !ids.channexRoomTypeId || !ids.channexDefaultRatePlanId) {
        setConnectForm((s) => ({ ...s, error: 'Les 3 IDs Channex sont obligatoires en mode import.' }));
        return;
      }
      Object.assign(payload, ids);
    }
    // En mode AUTO_CREATE, le backend derive tout depuis la property Baitly

    setConnectForm((s) => ({ ...s, submitting: true, error: null }));
    try {
      const connectedProperty = connectForm.property;
      const mapping = await channexApi.connect(connectedProperty.id, payload);
      setMappings((prev) => {
        const next = new Map(prev);
        next.set(mapping.clenzyPropertyId, mapping);
        return next;
      });
      setConnectForm(initialConnectForm);

      // Apres connexion reussie -> on enchaine sur le picker OTA pour que
      // l'utilisateur choisisse quel OTA (Airbnb, Booking, ...) connecter en
      // premier. Le picker ouvre ensuite le widget Channex pre-filtre.
      setPickerDialog({ open: true, property: connectedProperty });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la connexion au hub de distribution.';
      setConnectForm((s) => ({ ...s, submitting: false, error: message }));
    }
  };

  /**
   * Ouvre le Smart Disconnect dialog (Quick Win #2). L'ancien confirm basique
   * qui ne nettoyait que la DB locale (sans toucher les channels Channex) est
   * remplace : il laissait Airbnb/Booking bloques cote host parce que le hub
   * continuait a pusher. Le nouveau dialog desactive les OTA d'abord, puis
   * propose un reset complet optionnel.
   */
  const handleDisconnect = (property: Property) => {
    setSmartDisconnect({ open: true, property });
  };

  /**
   * Callback du Smart Disconnect dialog apres succes : on retire le mapping
   * de l'etat local pour que l'UI bascule immediatement la property en mode
   * "non connectee" (bouton Connecter au lieu de Resync/Deconnecter).
   */
  const handleSmartDisconnectSuccess = () => {
    const property = smartDisconnect.property;
    if (!property) return;
    setMappings((prev) => {
      const next = new Map(prev);
      next.delete(property.id);
      return next;
    });
  };

  const handleResync = async (property: Property) => {
    setBusyPropertyId(property.id);
    setGlobalError(null);
    try {
      await channexApi.resync(property.id, 0);
      // Refresh juste le mapping concerne
      const fresh = await channexApi.getMapping(property.id);
      if (fresh) {
        setMappings((prev) => {
          const next = new Map(prev);
          next.set(fresh.clenzyPropertyId, fresh);
          return next;
        });
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Erreur lors du re-sync.');
    } finally {
      setBusyPropertyId(null);
    }
  };

  const handlePullBookings = async (property: Property) => {
    setBusyPropertyId(property.id);
    setGlobalError(null);
    try {
      const result = await channexApi.pullBookings(property.id);
      const msg = result.totalReceived === 0
        ? `Aucun booking trouve pour "${property.name}". Verifiez que vos OTAs sont bien connectees dans le hub de distribution.`
        : `Import termine : ${result.totalReceived} booking(s) recus de Channex (${result.importedOrIdempotent} traites${result.errors > 0 ? `, ${result.errors} erreur(s)` : ''}).`;
      // Toast simplifie via alert (window) — on peut migrer vers notistack plus tard
      window.alert(msg);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Erreur lors de l'import des bookings.");
    } finally {
      setBusyPropertyId(null);
    }
  };

  /**
   * Phase 5 — push pricing settings (weekend price, occupancy, LOS factors,
   * min/max nights) vers Channex. Bouton dans la row property.
   */
  const handlePushPricingSettings = async (property: Property) => {
    setBusyPropertyId(property.id);
    setGlobalError(null);
    try {
      const result = await channexApi.pushPricingSettings(property.id);
      // ChannexSyncResult.success indique le statut + message contient le detail
      if (!result.success) {
        setGlobalError(`Push pricing settings KO : ${result.message}`);
      }
    } catch (err) {
      setGlobalError(err instanceof Error
        ? `Push pricing settings KO : ${err.message}`
        : 'Push pricing settings KO');
    } finally {
      setBusyPropertyId(null);
    }
  };

  const handleResyncContent = async (property: Property) => {
    setBusyPropertyId(property.id);
    setGlobalError(null);
    try {
      const result = await channexApi.resyncContent(property.id);
      const renamed = result.scrapedName && result.scrapedName !== property.name;
      const msg = `Re-sync OK pour "${result.propertyName}"`
        + (renamed ? ` (renomme depuis "${property.name}")` : '')
        + ` : ${result.mappedAmenities.length} commodite(s) mappee(s), `
        + `${result.rawAmenitiesRemaining.length} brute(s) en attente`
        + (result.ignoredCount > 0 ? `, ${result.ignoredCount} ignoree(s)` : '')
        + `. Va dans Settings > Commodites OTA pour mapper les restantes.`;
      window.alert(msg);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Erreur lors du re-sync content.');
    } finally {
      setBusyPropertyId(null);
    }
  };

  const ACCENT = 'var(--accent)';

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          {/* La croix de fermeture vient de DialogContent : `pe-10` lui reserve sa place. */}
          <DialogHeader className="flex-row items-center gap-1.5 -mx-4 px-4 pb-[9px] pe-10 border-b border-solid border-[var(--line)]">
            {view !== 'CHOICE' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Retour au choix initial"
                      onClick={() => setView('CHOICE')}
                    >
                      <ArrowLeft size={18} />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Retour au choix initial</TooltipContent>
              </Tooltip>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[0.95rem] font-bold">
                {view === 'CHOICE'
                  ? (guided
                    ? t('channexGuided.title', 'Distribuez vos logements')
                    : 'Distribution OTA — Que voulez-vous faire ?')
                  : 'Connecter mes proprietes aux OTAs'}
              </DialogTitle>
              <DialogDescription className="text-[0.75rem]">
                {view === 'CHOICE'
                  ? (guided
                    ? t('channexGuided.subtitle', 'Mettez vos annonces sur Airbnb, Booking, Vrbo… et synchronisez tout depuis Baitly.')
                    : 'Choisissez si vous voulez importer une propriete deja en ligne, ou connecter une propriete deja dans Baitly.')
                  : 'Selectionnez une propriete pour l\'enregistrer dans le hub puis y brancher Airbnb, Booking, etc.'}
              </DialogDescription>
            </div>
          </DialogHeader>

          {view === 'CHOICE' ? (
            <div className="flex flex-col gap-[9px]">
              {/* Mode guide (end-user) : on masque le diagnostic technique et le
                  health panel par defaut (trop techniques) et on les expose
                  derriere un toggle discret. En mode Integrations (non guide),
                  comportement 100% inchange. */}
              {guided ? (
                <>
                  {/* Note calme de degradation gracieuse : si un appel Channex a
                      echoue (API incomplete), on ne montre PAS d'erreur technique. */}
                  {guidedDegraded && (
                    <UiAlert variant="info" className="text-[0.78rem]">
                      <Clock size={16} />
                      <AlertDescription>
                        {t(
                          'channexGuided.configuringNote',
                          'La connexion au Channel Manager est en cours de configuration. Vous pouvez tout de meme preparer vos logements ci-dessous.',
                        )}
                      </AlertDescription>
                    </UiAlert>
                  )}
                </>
              ) : (
                <>
                  {/* Quick Win #3 : Pre-flight diagnostic — verifie API, hub, capabilities
                      AVANT que l'utilisateur n'investisse 5 minutes dans un wizard OAuth. */}
                  <ChannexPreflightBanner defaultCollapsed />

                  {/* Phase 2 : Health summary — counts par status + items meritant attention,
                      click sur un item ouvre le diagnose pour cette property. */}
                  <ChannexHealthSummaryPanel
                    onAttentionItemClick={(item) => setDiagnoseTarget({
                      propertyId: item.clenzyPropertyId,
                      propertyName: item.propertyName,
                    })}
                  />
                </>
              )}

              {/* Phase 5 audit O1 : bouton ouverture du dialog Price Drifts.
                  Phase 5 audit UX fix : masque le bouton tant qu'il n'y a aucun
                  drift actif — un bouton orange visible suggererait un probleme
                  alors qu'il n'y en a pas. Affiche le count en suffixe quand > 0. */}
              {!guided && activeDriftsCount > 0 && (
                <div className="flex justify-end">
                  {/* Alerte discrete au-dessus du contenu : ghost teinte --warn plutot
                      que default — ce n'est pas l'action principale de l'ecran. */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPriceDriftsOpen(true)}
                    className="text-[var(--warn)] hover:bg-[var(--warn-soft)]"
                  >
                    <AlertCircle />
                    Voir les conflits de prix Baitly ↔ OTA ({activeDriftsCount})
                  </Button>
                </div>
              )}

              {!guided && (
                <span className="cn-text-caption text-muted-foreground block leading-[1.5] mb-0.5">
                  Deux scenarios possibles selon votre situation :
                </span>
              )}

              {/* Card 1 : Importer une propriete deja en ligne dans un OTA */}
              <button
                type="button"
                onClick={() => setImportDialogOpen(true)}
                className={CHOICE_CARD_CLASS}
              >
                <div className={CHOICE_ICON_CLASS}>
                  <Globe size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="cn-text-body2 font-bold mb-0.5">
                    {guided
                      ? t('channexGuided.importTitle', 'Importer mes annonces existantes')
                      : 'Importer une propriete deja en ligne'}
                  </p>
                  <span className="cn-text-caption text-muted-foreground block leading-[1.5]">
                    {guided
                      ? t('channexGuided.importDesc', 'Depuis Airbnb, Booking ou Vrbo — infos pré-remplies.')
                      : 'Vous avez deja des listings sur Airbnb / Booking / Vrbo qui ne sont pas encore dans Baitly. Detectez et importez-les en masse avec leurs metadonnees (nom, devise, capacite) deja pre-remplies.'}
                  </span>
                </div>
                <div className="text-muted-foreground opacity-60 shrink-0 self-center">
                  <ChevronRight size={18} />
                </div>
              </button>

              {/* Card 2 : Connecter une propriete deja dans le PMS */}
              <button
                type="button"
                onClick={() => setView('CONNECT_EXISTING')}
                className={CHOICE_CARD_CLASS}
              >
                <div className={CHOICE_ICON_CLASS}>
                  <Home size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="cn-text-body2 font-bold mb-0.5">
                    {guided
                      ? t('channexGuided.connectTitle', 'Connecter un de mes logements')
                      : 'Connecter une propriete deja dans Baitly'}
                  </p>
                  <span className="cn-text-caption text-muted-foreground block leading-[1.5]">
                    {guided
                      ? t('channexGuided.connectDesc', 'Un logement déjà dans Baitly, publié sur les plateformes.')
                      : 'Vous avez une propriete dans Baitly que vous voulez distribuer sur Airbnb, Booking, Vrbo, etc. Connectez-la au hub puis branchez les OTAs en quelques clics.'}
                  </span>
                </div>
                <div className="text-muted-foreground opacity-60 shrink-0 self-center">
                  <ChevronRight size={18} />
                </div>
              </button>

              {/* Card 3 : Gerer les OTAs connectes (voir/deconnecter Airbnb, Booking, etc.) */}
              <button
                type="button"
                onClick={() => setView('MANAGE_OTAS')}
                className={CHOICE_CARD_CLASS}
              >
                <div className={CHOICE_ICON_CLASS}>
                  <Link2 size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="cn-text-body2 font-bold mb-0.5">
                    {guided
                      ? t('channexGuided.manageTitle', 'Gerer mes OTA connectes')
                      : 'Gerer les OTAs connectes'}
                  </p>
                  <span className="cn-text-caption text-muted-foreground block leading-[1.5]">
                    {guided
                      ? t('channexGuided.manageDesc', 'Voir et déconnecter vos plateformes reliées.')
                      : 'Voir tous les OTAs (Airbnb, Booking, Vrbo, ...) actuellement connectes au hub, et les deconnecter si besoin (supprime le channel + les tokens OAuth).'}
                  </span>
                </div>
                <div className="text-muted-foreground opacity-60 shrink-0 self-center">
                  <ChevronRight size={18} />
                </div>
              </button>

              {/* Mode guide : diagnostic technique masque derriere un toggle
                  discret. Jamais auto-affiche (pas de HTTP 401 / CHANNEX_API_KEY
                  jete a l'utilisateur final). Le banner reste replie au mount. */}
              {guided && (
                <div className="flex justify-center pt-0.5">
                  {/* Toggle discret, volontairement efface : ghost xs en encre --muted. */}
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setShowTechStatus((v) => !v)}
                    className="text-[var(--muted)] hover:bg-transparent hover:text-[var(--accent)]"
                  >
                    {showTechStatus
                      ? t('channexGuided.techToggleHide', 'Masquer l\'etat technique')
                      : t('channexGuided.techToggleShow', 'Etat technique de la connexion')}
                  </Button>
                </div>
              )}
              {guided && showTechStatus && <ChannexPreflightBanner defaultCollapsed />}
            </div>
          ) : view === 'MANAGE_OTAS' ? (
            <div className="flex flex-col gap-[9px]">
              {/* Mode guide : si la liste des OTAs n'a pas pu charger (API
                  incomplete), note calme au lieu d'une erreur technique. */}
              {guided && guidedDegraded && (
                <UiAlert variant="info" className="text-[0.78rem]">
                  <Clock size={16} />
                  <AlertDescription>
                    {t(
                      'channexGuided.configuringNote',
                      'La connexion au Channel Manager est en cours de configuration. Vous pouvez tout de meme preparer vos logements ci-dessous.',
                    )}
                  </AlertDescription>
                </UiAlert>
              )}
              {!guided && otasError && (
                <UiAlert variant="destructive" className="text-[0.78rem]">
                  <TriangleAlert />
                  <AlertDescription>{otasError}</AlertDescription>
                </UiAlert>
              )}

              {otasLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner className="size-6" />
                </div>
              ) : connectedOtas.length === 0 ? (
                <div className="py-7 text-center px-3">
                  <div className="w-[56px] h-[56px] rounded-[50%] bg-[var(--accent-soft)] inline-flex items-center justify-center mb-[9px]" style={{ color: ACCENT }}>
                    <Link2 size={24} />
                  </div>
                  <p className="cn-text-body2 font-semibold mb-0.5">
                    Aucun OTA connecte
                  </p>
                  <span className="cn-text-caption text-muted-foreground block mb-3">
                    Pour connecter Airbnb / Booking / Vrbo, retournez au choix initial et selectionnez
                    "Importer une propriete deja en ligne".
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setView('CHOICE')}
                    variant="outline"
                  >
                    Retour au choix
                  </Button>
                </div>
              ) : (
                <>
                  <span className="cn-text-caption text-muted-foreground block mb-0.5">
                    {connectedOtas.length} OTA{connectedOtas.length > 1 ? 's' : ''} actuellement connecte{connectedOtas.length > 1 ? 's' : ''} au hub :
                  </span>
                  {connectedOtas.map((ota) => {
                    const otaOption = ota.otaName
                      ? CHANNEX_OTA_OPTIONS.find(
                          (o) => o.apiChannelName.toLowerCase() === ota.otaName.toLowerCase()
                            || o.name.toLowerCase() === ota.otaName.toLowerCase()
                        )
                      : null;
                    const brand = otaOption?.brandColor ?? ACCENT;
                    const brandFg = otaOption?.brandColorFg ?? '#FFFFFF';
                    const initials = otaOption?.initials ?? ota.otaName.slice(0, 2);
                    return (
                      <div className="flex items-center gap-2 p-2 rounded-[12px] border border-[var(--line)]" key={ota.channelId}>
                        <div className="w-[40px] h-[40px] rounded-[8px] flex items-center justify-center shrink-0 font-bold text-[0.95rem]" style={{ backgroundColor: brand, color: brandFg }}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-row items-center gap-1.5 mb-[1.5px] flex-wrap">
                            <p className="cn-text-body2 font-semibold truncate">
                              {otaOption?.name ?? ota.otaName} — {ota.title || 'Sans titre'}
                            </p>
                            {ota.isActive ? (
                              <Badge variant="secondary" className="h-[18px] text-[0.65rem] bg-[var(--ok-soft)] text-[var(--ok)]">Actif</Badge>
                            ) : ota.hasOauthToken ? (
                              <Badge variant="secondary" className="h-[18px] text-[0.65rem] bg-[var(--warn-soft)] text-[var(--warn)]">OAuth fait, mapping a finaliser</Badge>
                            ) : (
                              <Badge variant="secondary" className="h-[18px] text-[0.65rem] bg-[var(--err-soft)] text-[var(--err)]">Non authentifie</Badge>
                            )}
                          </div>
                          <span className="cn-text-caption text-muted-foreground block leading-[1.3]">
                            Lie a : {ota.attachedPropertyTitle || '(aucune)'}
                          </span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex shrink-0">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Deconnecter cet OTA"
                                onClick={() => setDisconnectOtaConfirm(ota)}
                                className="text-[var(--err)]"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Deconnecter cet OTA (supprime tokens OAuth)</TooltipContent>
                        </Tooltip>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          ) : (
            <>
          {globalError && (
            <UiAlert variant="destructive" className="mb-3 text-[0.78rem]">
              <TriangleAlert />
              <AlertDescription>{globalError}</AlertDescription>
            </UiAlert>
          )}

          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-7" />
            </div>
          ) : properties.length === 0 ? (
            <p className="cn-text-body1 text-center py-6 text-muted-foreground text-[0.85rem]">
              Aucune propriete dans votre organisation.
            </p>
          ) : (
            // Le separateur du Stack MUI devient une bordure haute par ligne
            // (la premiere n'en porte pas) : meme trait, sans composant intercale.
            <div className="flex flex-col">
              {properties.map((property) => {
                const mapping = mappings.get(property.id);
                const isBusy = busyPropertyId === property.id;
                return (
                  <div className="py-2 flex items-center justify-between gap-3 border-t border-solid border-[var(--line)] first:border-t-0" key={property.id}>
                    <div className="flex-1 min-w-0">
                      <p className="cn-text-body1 text-[0.85rem] font-semibold truncate">
                        {property.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="cn-text-body1 text-[0.7rem] text-muted-foreground truncate">
                          {property.city} · {property.type}
                        </p>
                        {mapping && <StatusBadge status={mapping.syncStatus} />}
                      </div>
                      {mapping?.lastSyncError && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="cn-text-body1 text-[0.7rem] text-[var(--err)] mt-0.5 italic max-w-[360px] overflow-hidden text-ellipsis whitespace-nowrap">
                              {mapping.lastSyncError}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent>{mapping.lastSyncError}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    <div className="flex flex-row gap-1.5 items-center">
                      {!mapping ? (
                        <Button
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleConnectClick(property)}
                        >
                          <Plus />
                          Connecter
                        </Button>
                      ) : (
                        <>
                          {/* Logos OTAs : tous les OTAs supportes (Airbnb / Booking
                              / Vrbo / Expedia / Agoda). En couleur + check vert si
                              cette property est sync sur l'OTA, grise si pas
                              connecte (cliquable pour lancer la connexion). */}
                          {(() => {
                            const propertyOtas = connectedOtas.filter(
                              (o) => o.attachedPropertyId === mapping.channexPropertyId,
                            );
                            return (
                              <div className="flex flex-row gap-[3px] items-center me-[3px]">
                                {CHANNEX_OTA_OPTIONS.map((opt) => {
                                  const conn = propertyOtas.find(
                                    (o) => o.otaName.toLowerCase() === opt.apiChannelName.toLowerCase()
                                      || o.otaName.toLowerCase() === opt.name.toLowerCase(),
                                  );
                                  const isActive = conn?.isActive ?? false;
                                  const hasToken = conn?.hasOauthToken ?? false;
                                  const tooltipLabel = isActive
                                    ? `${opt.name} · Sync active`
                                    : hasToken
                                      ? `${opt.name} · OAuth fait, mapping a finaliser`
                                      : `${opt.name} · Cliquer pour connecter`;
                                  const logo = OTA_LOGO_BY_CODE[opt.code];
                                  // Meme contenu pour les deux formes ; seule l'enveloppe change
                                  // (element inerte quand l'OTA est deja synchronise, bouton sinon).
                                  const badgeInner = (
                                    <>
                                      {logo && (
                                        <img className="w-full h-full rounded-[4px] object-contain bg-[var(--card)] border border-solid border-[var(--line)] p-0.5" src={logo} alt={opt.name} />
                                      )}
                                      {isActive && (
                                        <div className="absolute w-[11px] h-[11px] rounded-[50%] bg-[var(--ok)] text-[var(--on-accent)] flex items-center justify-center border-[2px] border-solid border-[var(--card)]" style={{ top: -3, right: -3 }}>
                                          <CheckCircle2 size={7} strokeWidth={4} />
                                        </div>
                                      )}
                                      {!isActive && hasToken && (
                                        <div className="absolute w-[9px] h-[9px] rounded-[50%] bg-[var(--warn)] border-[2px] border-solid border-[var(--card)]" style={{ top: -3, right: -3 }} />
                                      )}
                                    </>
                                  );
                                  return (
                                    <Tooltip key={opt.code}>
                                      <TooltipTrigger asChild>
                                        {isActive ? (
                                          <span className="relative inline-flex w-[22px] h-[22px] p-0 cursor-default">
                                            {badgeInner}
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setPickerDialog({ open: true, property })}
                                            disabled={isBusy}
                                            aria-label={tooltipLabel}
                                            className="relative inline-flex w-[22px] h-[22px] p-0 border-none bg-transparent cursor-pointer opacity-35 grayscale transition-[opacity,filter] duration-150 hover:opacity-70 hover:grayscale-[50%]"
                                          >
                                            {badgeInner}
                                          </button>
                                        )}
                                      </TooltipTrigger>
                                      <TooltipContent>{tooltipLabel}</TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            );
                          })()}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Re-sync contenu OTA"
                                  disabled={isBusy}
                                  onClick={() => handleResyncContent(property)}
                                  className="text-[#8B5CF6]"
                                >
                                  <Sparkles size={14} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Re-sync contenu OTA (nom, commodités) — re-scrape Airbnb + applique vos aliases</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Re-pousser prix et disponibilites"
                                  disabled={isBusy}
                                  onClick={() => handleResync(property)}
                                  className="text-[var(--accent)]"
                                >
                                  {isBusy ? <Spinner className="size-3.5" /> : <RefreshCw size={14} />}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Re-pousser prix + dispo Baitly vers les OTAs (6 mois)</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Importer les bookings OTA existants"
                                  disabled={isBusy}
                                  onClick={() => handlePullBookings(property)}
                                  className="text-[var(--info)]"
                                >
                                  <Download size={14} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Importer les bookings OTA existants (Airbnb / Booking / ...)</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Push pricing settings vers Channex"
                                  disabled={isBusy}
                                  onClick={() => handlePushPricingSettings(property)}
                                  className="text-[var(--ok)]"
                                >
                                  <SettingsIcon size={14} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Push pricing settings (weekend / occupancy / LOS / min-max nights) vers Channex</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Deconnecter"
                                  disabled={isBusy}
                                  onClick={() => handleDisconnect(property)}
                                  className="text-[var(--err)]"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Deconnecter</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-dialog: connect form */}
      <Dialog
        open={connectForm.open}
        onOpenChange={(next) => { if (!next) setConnectForm(initialConnectForm); }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader className="-mx-4 px-4 pb-[9px] pe-10 border-b border-solid border-[var(--line)]">
            <DialogTitle className="text-[0.9rem] font-bold">
              Connecter "{connectForm.property?.name}" au hub de distribution
            </DialogTitle>
            <DialogDescription className="text-[0.72rem] mt-0.5">
              {connectForm.mode === 'AUTO_CREATE'
                ? "Baitly va creer Property + Room Type + Rate Plan automatiquement dans le hub"
                : "Renseignez les 3 identifiants du hub (visibles dans votre dashboard)"}
            </DialogDescription>
          </DialogHeader>
          {connectForm.error && (
            <UiAlert variant="destructive" className="mb-3 text-[0.78rem]">
              <TriangleAlert />
              <AlertDescription>{connectForm.error}</AlertDescription>
            </UiAlert>
          )}

          {/* Mode toggle */}
          <div className="flex flex-col gap-1.5 mb-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setConnectForm((s) => ({ ...s, mode: 'AUTO_CREATE', error: null }))}
              className={cn(
                'p-[7.5px] border-[1.5px] border-solid rounded-[12px] cursor-pointer hover:border-[var(--accent)]',
                connectForm.mode === 'AUTO_CREATE'
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'border-[var(--line)] bg-[var(--card)]',
              )}
              style={{ transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            >
              <div className="flex items-center gap-1.5">
                {/* `divider` etait un jeton MUI dans un style inline : declaration
                    invalide, silencieusement ignoree. Le trait du kit est --line. */}
                <div className="w-[16px] h-[16px] rounded-[50%] border-[2px] border-solid shrink-0" style={{ borderColor: connectForm.mode === 'AUTO_CREATE' ? ACCENT : 'var(--line)', backgroundColor: connectForm.mode === 'AUTO_CREATE' ? ACCENT : 'transparent' }} />
                <p className="cn-text-body1 text-[0.8rem] font-semibold">
                  Creation automatique <span style={{ color: ACCENT, fontSize: '0.75rem', fontWeight: 700 }}>RECOMMANDE</span>
                </p>
              </div>
              <p className="cn-text-body1 text-[0.72rem] text-muted-foreground ms-4 mt-0.5">
                Baitly cree la Property, le Room Type et le Rate Plan automatiquement dans le hub de distribution en utilisant les infos de votre propriete.
              </p>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setConnectForm((s) => ({ ...s, mode: 'IMPORT_EXISTING', error: null }))}
              className={cn(
                'p-[7.5px] border-[1.5px] border-solid rounded-[12px] cursor-pointer hover:border-[var(--accent)]',
                connectForm.mode === 'IMPORT_EXISTING'
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'border-[var(--line)] bg-[var(--card)]',
              )}
              style={{ transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-[16px] h-[16px] rounded-[50%] border-[2px] border-solid shrink-0" style={{ borderColor: connectForm.mode === 'IMPORT_EXISTING' ? ACCENT : 'var(--line)', backgroundColor: connectForm.mode === 'IMPORT_EXISTING' ? ACCENT : 'transparent' }} />
                <p className="cn-text-body1 text-[0.8rem] font-semibold">
                  Importer des IDs existants
                </p>
              </div>
              <p className="cn-text-body1 text-[0.72rem] text-muted-foreground ms-4 mt-0.5">
                Vous avez deja cree la propriete dans le hub de distribution et possedez les 3 UUIDs.
              </p>
            </div>
          </div>

          {/* Champs IDs : visibles uniquement en mode IMPORT */}
          {connectForm.mode === 'IMPORT_EXISTING' && (
            <div className="flex flex-col gap-[9px]">
              <Field>
                <FieldLabel htmlFor="channex-property-id">Property ID (hub)</FieldLabel>
                <Input
                  id="channex-property-id"
                  className="w-full"
                  value={connectForm.channexPropertyId}
                  onChange={(e) =>
                    setConnectForm((s) => ({ ...s, channexPropertyId: e.target.value }))
                  }
                  disabled={connectForm.submitting}
                  placeholder="ex: 8f8a2c1a-4b5e-..."
                />
                <FieldDescription>UUID de la Property dans le hub de distribution</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="channex-room-type-id">Room Type ID (hub)</FieldLabel>
                <Input
                  id="channex-room-type-id"
                  className="w-full"
                  value={connectForm.channexRoomTypeId}
                  onChange={(e) =>
                    setConnectForm((s) => ({ ...s, channexRoomTypeId: e.target.value }))
                  }
                  disabled={connectForm.submitting}
                  placeholder="ex: 1d2e3f4a-..."
                />
                <FieldDescription>Room Type rattache a la property</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="channex-rate-plan-id">Default Rate Plan ID (hub)</FieldLabel>
                <Input
                  id="channex-rate-plan-id"
                  className="w-full"
                  value={connectForm.channexDefaultRatePlanId}
                  onChange={(e) =>
                    setConnectForm((s) => ({ ...s, channexDefaultRatePlanId: e.target.value }))
                  }
                  disabled={connectForm.submitting}
                  placeholder="ex: 5b6c7d8e-..."
                />
                <FieldDescription>Rate Plan par defaut utilise pour pousser les prix</FieldDescription>
              </Field>
            </div>
          )}

          {/* Recap mode AUTO_CREATE */}
          {connectForm.mode === 'AUTO_CREATE' && connectForm.property && (
            <UiAlert variant="info" className="text-[0.72rem]">
              <Info />
              <AlertDescription><strong>Sera cree dans le hub de distribution :</strong><ul className="m-0 ps-3 mt-[3px]">
                <li>Property : <em>{connectForm.property.name}</em> ({connectForm.property.city}, {connectForm.property.country})</li>
                <li>Room Type : 1 unite, capacite {connectForm.property.maxGuests} personnes</li>
                <li>Rate Plan : Standard Rate, per_room</li>
              </ul></AlertDescription>
            </UiAlert>
          )}

          <UiAlert variant="info" className="mt-3 text-[0.72rem]">
            <Info />
            <AlertDescription>Apres connexion, un push initial de 6 mois (prix + disponibilites) sera declenche automatiquement.
            {connectForm.mode === 'AUTO_CREATE' && (
              <> Pour connecter ensuite Airbnb / Booking / Vrbo, utilisez le bouton de connexion (lien) sur la propriete une fois creee.</>
            )}</AlertDescription>
          </UiAlert>

          <div className="flex justify-end gap-1.5 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConnectForm(initialConnectForm)}
              disabled={connectForm.submitting}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleConnectSubmit}
              disabled={connectForm.submitting}
            >
              {connectForm.submitting ? <Spinner className="size-3" /> : null}
              {connectForm.submitting ? 'Connexion...' : 'Connecter'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Picker OTA Baitly-native : choix de l'OTA avant d'ouvrir la iframe Channex.
          Le wizard Channex s'ouvre filtre sur l'OTA choisi (param available_channels)
          ce qui evite a l'utilisateur de chercher dans 500+ options.

          NOTE : on avait tente une pre-creation via POST /channels + mapping
          automatique, mais le mapping property↔channel n'est pas expose en
          API publique Channex (tous formats testes -> 422/500). Le wizard
          iframe reste l'unique chemin pour finaliser le mapping. Le call
          createOtaChannel reste cote backend pour usage futur (whitelabel
          ou si Channex expose l'endpoint). */}
      <ChannexOtaPickerDialog
        open={pickerDialog.open}
        onClose={() => setPickerDialog({ open: false, property: null })}
        propertyName={pickerDialog.property?.name ?? ''}
        onPick={(code) => {
          // Bascule du picker au widget iframe Channex pre-filtre sur l'OTA choisi
          const property = pickerDialog.property;
          setPickerDialog({ open: false, property: null });
          if (property) {
            setEmbedDialog({
              open: true,
              property,
              channelCode: code,
              prefetchedUrl: null, // pas de pre-create -> ChannexEmbedDialog fetche lui-meme
            });
          }
        }}
      />

      {/* Widget Channex embarque pour la finalisation (login OTA + mapping) */}
      <ChannexEmbedDialog
        open={embedDialog.open}
        onClose={() => setEmbedDialog({ open: false, property: null, channelCode: null, prefetchedUrl: null })}
        clenzyPropertyId={embedDialog.property?.id ?? null}
        propertyName={embedDialog.property?.name ?? ''}
        channelCode={embedDialog.channelCode}
        prefetchedEmbedUrl={embedDialog.prefetchedUrl}
        onClosedAfterConnection={() => {
          // L'utilisateur a connecte un OTA dans la iframe :
          // 1. Push Baitly -> Channex (resync) car maintenant qu'au moins 1 OTA
          //    est actif, les prix/dispos doivent etre distribues. C'est le
          //    PREMIER push (la connect() initiale ne push pas pour eviter de
          //    polluer Channex tant qu'aucun OTA n'est branche).
          // 2. Pull Channex -> Baitly (pullBookings) pour rapatrier les
          //    reservations existantes sur l'OTA fraichement connecte (Airbnb
          //    a typiquement deja des bookings actifs).
          if (embedDialog.property) {
            void handleResync(embedDialog.property);
            void handlePullBookings(embedDialog.property);
          }
        }}
      />

      {/* Import en masse depuis le hub (discovery des listings OTAs) */}
      <ChannexImportDiscoveryDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImported={() => {
          // Refresh la liste des properties + mappings pour faire apparaitre
          // les nouvelles properties Baitly fraichement importees, et bascule
          // sur la vue CONNECT_EXISTING pour les voir tout de suite.
          void refresh();
          setView('CONNECT_EXISTING');
        }}
        onRequestConnectExisting={() => {
          // CTA depuis l'etat "hub vide" : ferme le sub-dialog et bascule la
          // vue principale sur la liste des proprietes Baitly (pour que le
          // user puisse en connecter une et faire l'OAuth Airbnb).
          setImportDialogOpen(false);
          setView('CONNECT_EXISTING');
        }}
      />

      {/* Smart Disconnect orchestre (Quick Win #2) — remplace l'ancien confirm
          basique qui n'effacait que le mapping local sans toucher les channels
          Channex (= laissait Airbnb/Booking bloques cote host). */}
      {smartDisconnect.property && (
        <ChannexFullDisconnectDialog
          open={smartDisconnect.open}
          onClose={() => setSmartDisconnect({ open: false, property: null })}
          propertyId={smartDisconnect.property.id}
          propertyName={smartDisconnect.property.name}
          onSuccess={handleSmartDisconnectSuccess}
        />
      )}

      {/* Phase 5 audit O1 : Price Drifts dialog (liste tous les drifts actifs de l'org).
          UX fix : a chaque resolution on decremente le count local pour que le bouton
          du parent disparaisse en temps reel des qu'il n'y a plus de drift. */}
      <ChannexPriceDriftsDialog
        open={priceDriftsOpen}
        onClose={() => setPriceDriftsOpen(false)}
        onDriftResolved={() => setActiveDriftsCount((c) => Math.max(0, c - 1))}
      />

      {/* Diagnose dialog (Quick Win #5) declenche depuis le HealthSummaryPanel.
          Reuse les memes handlers que le full disconnect (le user peut faire
          full disconnect direct depuis le diagnose). */}
      {diagnoseTarget && (
        <ChannexDiagnoseDialog
          open={diagnoseTarget !== null}
          onClose={() => setDiagnoseTarget(null)}
          propertyId={diagnoseTarget.propertyId}
          onFullDisconnect={() => {
            // Ouvre le smart disconnect pour la meme property (chaine d'actions
            // depuis le tableau de bord).
            const target = diagnoseTarget;
            setDiagnoseTarget(null);
            if (target) {
              // On a besoin d'une Property pour le smart disconnect. On en
              // construit un stub minimal (l'id + le nom suffisent pour l'UI).
              setSmartDisconnect({
                open: true,
                property: { id: target.propertyId, name: target.propertyName } as Property,
              });
            }
          }}
          onOpenHub={() => {
            // Deja dans la mapping dialog → on bascule sur la vue CONNECT_EXISTING
            // pour que l'admin voie la property en question dans la liste.
            setDiagnoseTarget(null);
            setView('CONNECT_EXISTING');
          }}
          onResyncSuccess={() => { void refresh(); }}
        />
      )}

      {/* Confirmation de deconnexion OTA (suppression channel + tokens OAuth) */}
      <Dialog
        open={disconnectOtaConfirm !== null}
        onOpenChange={(next) => { if (!next) setDisconnectOtaConfirm(null); }}
      >
        <DialogContent>
          <DialogHeader className="flex-row items-start gap-1.5 pe-10">
            <div className="w-[32px] h-[32px] rounded-[8px] bg-[var(--err-soft)] text-[var(--err)] flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle size={18} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-semibold leading-[1.3]">
                Deconnecter cet OTA&nbsp;?
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription>
            <strong>{disconnectOtaConfirm?.otaName}</strong> sera deconnecte du hub.
            Les tokens OAuth seront supprimes et vous devrez refaire toute l'authentification
            pour reconnecter cet OTA. Les bookings deja synchronises restent dans Baitly.
          </DialogDescription>
          <DialogFooter>
            <Button
              onClick={() => setDisconnectOtaConfirm(null)}
              size="sm"
              variant="outline"
            >
              Annuler
            </Button>
            <Button
              onClick={handleDisconnectOta}
              size="sm"
              variant="destructive"
            >
              Deconnecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
