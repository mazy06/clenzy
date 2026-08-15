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
import { useAuth } from '../../../hooks/useAuth';
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
          <StatusChip tokens={{ color: meta.color, bg: `${meta.color}1A` }} label={meta.label} icon={icon} className="text-2xs" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{meta.description}</TooltipContent>
    </Tooltip>
  );
}

// Carte d'action « choix » — tokens Baitly UI, survol par le fond (jamais par
// un liseré latéral) et sans transform. Les trois cartes tiennent sur une seule
// rangée : le choix se lit d'un coup d'œil au lieu de se dérouler.
const CHOICE_CARD_CLASS = [
  'flex flex-col items-start gap-[9px] h-full w-full p-[13px] rounded-xl',
  'border border-solid text-start cursor-pointer',
  'transition-[border-color,background-color] duration-150 motion-reduce:transition-none',
  'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
].join(' ');

/**
 * Carte d'entrée de l'écran de choix. `emphasis` porte la hiérarchie : les deux
 * chemins qui font ENTRER un logement priment sur la maintenance des comptes,
 * qui reste volontairement sourde.
 */
function ChoiceCard({
  icon,
  title,
  description,
  hint,
  cta,
  emphasis,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  hint?: string;
  /** Libelle de l'appel a l'action, traduit par l'appelant (hook `t` en amont). */
  cta: string;
  emphasis: 'primary' | 'neutral' | 'quiet';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        CHOICE_CARD_CLASS,
        emphasis === 'primary' && 'border-primary/45 bg-primary-soft/45 hover:border-primary hover:bg-primary-soft/75',
        emphasis === 'neutral' && 'border-border bg-card hover:border-primary hover:bg-primary-soft/45',
        emphasis === 'quiet' && 'border-border bg-background hover:border-primary hover:bg-primary-soft/35',
      )}
    >
      <div className="flex items-center gap-1.5 w-full">
        <div
          className={cn(
            'size-9 rounded-lg flex items-center justify-center shrink-0',
            emphasis === 'quiet' ? 'bg-muted text-muted-foreground' : 'bg-primary-soft text-primary',
          )}
        >
          {icon}
        </div>
        {hint && (
          // `--bui-primary` est un bleu nuit (#1B2A35 en clair, #E8EEF5 en
          // sombre), pas une teinte vive : il tient comme encre de texte.
          <span className="ms-auto text-2xs font-semibold uppercase tracking-wide text-primary">
            {hint}
          </span>
        )}
      </div>
      <div className="min-w-0 w-full">
        <p className="text-xs font-bold mb-0.5 text-foreground text-balance">{title}</p>
        <span className="text-xs text-muted-foreground block leading-[1.5]">{description}</span>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-foreground">
        {cta}
        <ChevronRight size={14} className="cn-rtl-flip" />
      </span>
    </button>
  );
}

export default function ChannexMappingDialog({ open, onClose, guided = false }: ChannexMappingDialogProps) {
  const { t } = useTranslation();
  const { isSuperAdmin } = useAuth();
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
   * Reprise du cloisonnement : rattache les logements deja mappes au group
   * Channex de leur organisation. Necessaire une fois, sur l'existant cree
   * avant l'introduction des groups — le cloisonnement seul ne couvre que ce
   * qui est cree apres.
   */
  const [groupBackfill, setGroupBackfill] = useState<{
    running: boolean;
    report: import('../../../services/api/channexApi').ChannexGroupBackfillReport | null;
    error: string | null;
  }>({ running: false, report: null, error: null });
  /**
   * Purge des logements du hub sans organisation. Toujours en deux temps :
   * la simulation etablit la liste exacte, la confirmation seule supprime.
   * La suppression cote hub est irreversible.
   */
  const [purge, setPurge] = useState<{
    running: boolean;
    report: import('../../../services/api/channexApi').ChannexUngroupedPurgeReport | null;
    error: string | null;
    confirming: boolean;
  }>({ running: false, report: null, error: null, confirming: false });
  /**
   * Phase 5 audit UX fix : compteur de drifts actifs. On masque le bouton
   * "Voir les conflits" tant qu'il n'y en a aucun pour eviter la confusion
   * (un bouton orange visible signifierait un probleme alors qu'il n'y en a pas).
   */
  const [activeDriftsCount, setActiveDriftsCount] = useState<number>(0);
  /**
   * Vue principale du dialog. Les quatre vues vivent dans la MEME coquille :
   * l'import etait auparavant une modale empilee par-dessus celle-ci, ce qui
   * cassait le fil de retour (fermer celle du dessus laissait celle du dessous
   * ouverte, sans indice sur le chemin parcouru).
   * - 'CHOICE' : ecran de choix initial (3 entrees)
   * - 'IMPORT_FROM_OTA' : detection + import des annonces connues du hub
   * - 'CONNECT_EXISTING' : liste des proprietes Baitly avec leur statut
   * - 'MANAGE_OTAS' : plateformes reliees au hub, avec deconnexion
   */
  const [view, setView] = useState<'CHOICE' | 'IMPORT_FROM_OTA' | 'CONNECT_EXISTING' | 'MANAGE_OTAS'>('CHOICE');
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

  const handleGroupBackfill = async () => {
    setGroupBackfill({ running: true, report: null, error: null });
    try {
      const report = await channexApi.backfillHubGroups();
      setGroupBackfill({ running: false, report, error: null });
    } catch (err) {
      setGroupBackfill({
        running: false,
        report: null,
        error: err instanceof Error ? err.message : 'Le cloisonnement a echoue.',
      });
    }
  };

  /** `confirm=false` simule, `true` supprime. La confirmation ferme la modale. */
  const runPurge = async (confirm: boolean) => {
    setPurge((s) => ({ ...s, running: true, error: null }));
    try {
      const report = await channexApi.purgeUngroupedHubProperties(confirm);
      setPurge({ running: false, report, error: null, confirming: false });
    } catch (err) {
      setPurge({
        running: false,
        report: null,
        error: err instanceof Error ? err.message : 'La purge a echoue.',
        confirming: false,
      });
    }
  };

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

  /** Appel a l'action commun aux trois entrees de l'ecran de choix. */
  const choiceCta = t('common.continue', 'Continuer');

  /**
   * En-tete par vue. L'ancien ternaire annoncait « Connecter mes proprietes aux
   * OTAs » sur TOUTES les vues autres que le choix : le titre contredisait
   * l'ecran des la gestion des plateformes.
   */
  const header: { title: string; subtitle: string } =
    view === 'CHOICE'
      ? {
        title: guided
          ? t('channexGuided.title', 'Distribuez vos logements')
          : 'Distribution — que voulez-vous faire ?',
        subtitle: guided
          ? t('channexGuided.subtitle', 'Mettez vos annonces sur Airbnb, Booking, Vrbo… et synchronisez tout depuis Baitly.')
          : 'Importer un logement déjà en ligne, en connecter un déjà présent dans Baitly, ou gérer vos plateformes.',
      }
      : view === 'IMPORT_FROM_OTA'
        ? {
          title: 'Importer un logement déjà en ligne',
          subtitle: 'Autorisez votre compte, puis choisissez les annonces détectées à importer dans Baitly.',
        }
        : view === 'MANAGE_OTAS'
          ? {
            title: 'Mes plateformes connectées',
            subtitle: 'Les plateformes reliées au hub de distribution, et leur déconnexion.',
          }
          : {
            title: 'Connecter un logement Baitly',
            subtitle: 'Sélectionnez un logement pour l\'enregistrer dans le hub, puis y brancher Airbnb, Booking, etc.',
          };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent
          className={cn(
            'max-h-[85vh] overflow-y-auto flex flex-col',
            // Le tableau d'import porte des colonnes supplementaires : il a
            // besoin de la largeur que les autres vues n'utiliseraient pas.
            view === 'IMPORT_FROM_OTA' ? 'sm:max-w-4xl' : 'sm:max-w-3xl',
          )}
        >
          {/* La croix de fermeture vient de DialogContent : `pe-10` lui reserve sa place. */}
          <DialogHeader className="flex-row items-center gap-1.5 -mx-4 px-4 pb-[9px] pe-10 border-b border-solid border-border">
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
                      <ArrowLeft size={18} className="cn-rtl-flip" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Retour au choix initial</TooltipContent>
              </Tooltip>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-bold tracking-tight text-balance">
                {header.title}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {header.subtitle}
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
                    <UiAlert variant="info" className="text-xs">
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
                    className="text-warning-ink hover:bg-warning-soft"
                  >
                    <AlertCircle />
                    Voir les conflits de prix Baitly ↔ OTA ({activeDriftsCount})
                  </Button>
                </div>
              )}

              {/* Les trois entrées sur une rangée : le choix est comparatif,
                  l'empilement obligeait à faire défiler pour le lire. */}
              <div className="grid gap-[9px] items-stretch sm:grid-cols-3">
                {/* Entrée 1 : importer un logement déjà en ligne sur un OTA */}
                <ChoiceCard
                  emphasis="primary"
                  cta={choiceCta}
                  hint={t('channexGuided.importHint', 'Le plus courant')}
                  icon={<Globe size={20} />}
                  onClick={() => setView('IMPORT_FROM_OTA')}
                  title={guided
                    ? t('channexGuided.importTitle', 'Importer mes annonces existantes')
                    : 'Importer un logement déjà en ligne'}
                  description={guided
                    ? t('channexGuided.importDesc', 'Depuis Airbnb, Booking ou Vrbo — infos pré-remplies.')
                    : 'Vos annonces Airbnb, Booking ou Vrbo pas encore dans Baitly : détectées et importées en lot, métadonnées pré-remplies.'}
                />

                {/* Entrée 2 : connecter un logement déjà dans le PMS */}
                <ChoiceCard
                  emphasis="neutral"
                  cta={choiceCta}
                  icon={<Home size={20} />}
                  onClick={() => setView('CONNECT_EXISTING')}
                  title={guided
                    ? t('channexGuided.connectTitle', 'Connecter un de mes logements')
                    : 'Connecter un logement déjà dans Baitly'}
                  description={guided
                    ? t('channexGuided.connectDesc', 'Un logement déjà dans Baitly, publié sur les plateformes.')
                    : 'Un logement déjà saisi dans Baitly, à distribuer sur Airbnb, Booking, Vrbo… Il rejoint le hub, puis vous branchez les plateformes.'}
                />

                {/* Entrée 3 : maintenance des comptes OTA — volontairement sourde */}
                <ChoiceCard
                  emphasis="quiet"
                  cta={choiceCta}
                  icon={<Link2 size={20} />}
                  onClick={() => setView('MANAGE_OTAS')}
                  title={guided
                    ? t('channexGuided.manageTitle', 'Gérer mes plateformes connectées')
                    : 'Gérer les plateformes connectées'}
                  description={guided
                    ? t('channexGuided.manageDesc', 'Voir et déconnecter vos plateformes reliées.')
                    : 'Voir les plateformes reliées au hub et les déconnecter (supprime le canal et les autorisations).'}
                />
              </div>

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
                    className="text-muted-foreground hover:bg-transparent hover:text-primary"
                  >
                    {showTechStatus
                      ? t('channexGuided.techToggleHide', 'Masquer l\'etat technique')
                      : t('channexGuided.techToggleShow', 'Etat technique de la connexion')}
                  </Button>
                </div>
              )}
              {guided && showTechStatus && <ChannexPreflightBanner defaultCollapsed />}

              {/* Reprise du cloisonnement, réservée au staff plateforme :
                  l'opération traverse toutes les organisations. Volontairement
                  discrète — c'est une maintenance ponctuelle, pas une action
                  courante de l'écran. */}
              {!guided && isSuperAdmin() && (
                <div className="flex flex-col gap-1.5 pt-1.5 border-t border-solid border-border">
                  <div className="flex flex-row items-center gap-1.5 flex-wrap">
                    <span className="text-2xs text-muted-foreground flex-1 leading-[1.5] min-w-[220px]">
                      Rattache les logements déjà connectés au groupe Channex de leur organisation.
                      À lancer une fois : les logements créés avant le cloisonnement sont visibles
                      des autres organisations tant que ce n'est pas fait.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={groupBackfill.running}
                      onClick={handleGroupBackfill}
                    >
                      {groupBackfill.running ? <Spinner className="size-3" /> : <SettingsIcon size={14} />}
                      {groupBackfill.running ? 'Cloisonnement…' : 'Cloisonner le hub par organisation'}
                    </Button>
                  </div>
                  {groupBackfill.error && (
                    <UiAlert variant="destructive" className="text-xs">
                      <TriangleAlert />
                      <AlertDescription>{groupBackfill.error}</AlertDescription>
                    </UiAlert>
                  )}
                  {groupBackfill.report && (
                    <UiAlert
                      variant={groupBackfill.report.failures > 0 ? 'warning' : 'success'}
                      className="text-xs"
                    >
                      <AlertDescription>
                        <strong>{groupBackfill.report.propertiesAssigned}</strong> logement(s) rattaché(s)
                        {' · '}<strong>{groupBackfill.report.propertiesAlreadyIsolated}</strong> déjà cloisonné(s)
                        {' · '}<strong>{groupBackfill.report.organizationsProvisioned}</strong> groupe(s) créé(s)
                        {groupBackfill.report.failures > 0 && (
                          <> · <strong>{groupBackfill.report.failures}</strong> échec(s)</>
                        )}
                        {groupBackfill.report.messages.length > 0 && (
                          <span className="block mt-0.5 opacity-80">
                            {groupBackfill.report.messages.slice(0, 5).join(' · ')}
                          </span>
                        )}
                      </AlertDescription>
                    </UiAlert>
                  )}

                  {/* Purge des logements sans organisation. Simulation d'abord :
                      le bouton de suppression n'apparaît qu'une fois la liste
                      exacte établie. */}
                  <div className="flex flex-row items-center gap-1.5 flex-wrap">
                    <span className="text-2xs text-muted-foreground flex-1 leading-[1.5] min-w-[220px]">
                      Supprime du hub les logements qui n'appartiennent à aucune organisation :
                      ni dans un groupe, ni connectés à Baitly, ni reliés à une plateforme.
                      À lancer après le cloisonnement.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={purge.running}
                      onClick={() => runPurge(false)}
                    >
                      {purge.running ? <Spinner className="size-3" /> : <Trash2 size={14} />}
                      {purge.running ? 'Analyse…' : 'Analyser les logements sans organisation'}
                    </Button>
                  </div>
                  {purge.error && (
                    <UiAlert variant="destructive" className="text-xs">
                      <TriangleAlert />
                      <AlertDescription>{purge.error}</AlertDescription>
                    </UiAlert>
                  )}
                  {purge.report?.blockedByPendingBackfill && (
                    <UiAlert variant="warning" className="text-xs">
                      <TriangleAlert />
                      <AlertDescription>
                        Purge impossible pour l'instant : des logements connectés à Baitly ne sont
                        pas encore rattachés à un groupe. Tant que c'est le cas, « sans groupe » ne
                        veut pas dire « sans propriétaire ». Lancez d'abord le cloisonnement.
                      </AlertDescription>
                    </UiAlert>
                  )}
                  {purge.report && !purge.report.blockedByPendingBackfill && (
                    <UiAlert
                      variant={purge.report.failures > 0 ? 'warning' : purge.report.dryRun ? 'info' : 'success'}
                      className="text-xs"
                    >
                      <AlertDescription>
                        {purge.report.dryRun ? (
                          <>
                            <strong>{purge.report.candidates}</strong> logement(s) sur{' '}
                            {purge.report.totalInHub} seraient supprimés du hub.
                            {purge.report.candidates > 0 && (
                              <span className="block mt-0.5 opacity-80">
                                {purge.report.items
                                  .filter((item) => item.decision === 'PURGE')
                                  .slice(0, 8)
                                  .map((item) => item.title || item.channexPropertyId)
                                  .join(' · ')}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <strong>{purge.report.deleted}</strong> logement(s) supprimé(s) du hub
                            {purge.report.failures > 0 && (
                              <> · <strong>{purge.report.failures}</strong> échec(s)</>
                            )}
                          </>
                        )}
                      </AlertDescription>
                    </UiAlert>
                  )}
                  {purge.report?.dryRun && purge.report.candidates > 0
                    && !purge.report.blockedByPendingBackfill && (
                    <div className="flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={purge.running}
                        onClick={() => setPurge((s) => ({ ...s, confirming: true }))}
                      >
                        <Trash2 size={14} />
                        Supprimer ces {purge.report.candidates} logement(s)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : view === 'IMPORT_FROM_OTA' ? (
            /* Import rendu comme vue de CE dialog (pas de modale empilee) :
               l'en-tete et la fleche de retour ci-dessus restent le seul
               chemin de sortie. */
            <ChannexImportDiscoveryDialog
              embedded
              open
              onClose={() => setView('CHOICE')}
              onImported={() => {
                // Les nouvelles properties Baitly doivent apparaitre : on
                // recharge, puis on bascule sur la liste pour les montrer.
                void refresh();
                setView('CONNECT_EXISTING');
              }}
              onRequestConnectExisting={() => setView('CONNECT_EXISTING')}
            />
          ) : view === 'MANAGE_OTAS' ? (
            <div className="flex flex-col gap-[9px]">
              {/* Mode guide : si la liste des OTAs n'a pas pu charger (API
                  incomplete), note calme au lieu d'une erreur technique. */}
              {guided && guidedDegraded && (
                <UiAlert variant="info" className="text-xs">
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
                <UiAlert variant="destructive" className="text-xs">
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
                  <div className="size-14 rounded-full bg-primary-soft text-primary inline-flex items-center justify-center mb-[9px]">
                    <Link2 size={24} />
                  </div>
                  <p className="text-xs font-semibold mb-0.5 text-foreground">
                    Aucun OTA connecte
                  </p>
                  <span className="text-xs text-muted-foreground block mb-3">
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
                  <span className="text-xs text-muted-foreground block mb-0.5 tabular-nums">
                    {connectedOtas.length} OTA{connectedOtas.length > 1 ? 's' : ''} actuellement connecte{connectedOtas.length > 1 ? 's' : ''} au hub :
                  </span>
                  {connectedOtas.map((ota) => {
                    const otaOption = ota.otaName
                      ? CHANNEX_OTA_OPTIONS.find(
                          (o) => o.apiChannelName.toLowerCase() === ota.otaName.toLowerCase()
                            || o.name.toLowerCase() === ota.otaName.toLowerCase()
                        )
                      : null;
                    // OTA inconnu : repli sur la marque Baitly.
                    const brand = otaOption?.brandColor ?? 'var(--bui-primary)';
                    const brandFg = otaOption?.brandColorFg ?? 'var(--bui-primary-foreground)';
                    const initials = otaOption?.initials ?? ota.otaName.slice(0, 2);
                    return (
                      <div className="flex items-center gap-2 p-2 rounded-xl border border-solid border-border" key={ota.channelId}>
                        <div className="size-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm" style={{ backgroundColor: brand, color: brandFg }}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-row items-center gap-1.5 mb-[1.5px] flex-wrap">
                            <p className="text-xs font-semibold truncate text-foreground">
                              {otaOption?.name ?? ota.otaName} — {ota.title || 'Sans titre'}
                            </p>
                            {ota.isActive ? (
                              <Badge variant="success" className="h-[18px] text-2xs">Actif</Badge>
                            ) : ota.hasOauthToken ? (
                              <Badge variant="warning" className="h-[18px] text-2xs">OAuth fait, mapping a finaliser</Badge>
                            ) : (
                              <Badge variant="destructive" className="h-[18px] text-2xs bg-destructive-soft text-destructive-ink">Non authentifie</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground block leading-[1.3]">
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
                                className="text-destructive"
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
            <UiAlert variant="destructive" className="mb-3 text-xs">
              <TriangleAlert />
              <AlertDescription>{globalError}</AlertDescription>
            </UiAlert>
          )}

          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-7" />
            </div>
          ) : properties.length === 0 ? (
            <p className="text-sm text-center py-6 text-muted-foreground">
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
                  <div className="py-2 flex items-center justify-between gap-3 border-t border-solid border-border first:border-t-0" key={property.id}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-foreground">
                        {property.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                          {property.city} · {property.type}
                        </p>
                        {mapping && <StatusBadge status={mapping.syncStatus} />}
                      </div>
                      {/* Message d'erreur = TEXTE → encre `-ink` (contrat §2.4). */}
                      {mapping?.lastSyncError && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs text-destructive-ink mt-0.5 italic max-w-[360px] overflow-hidden text-ellipsis whitespace-nowrap">
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
                                        <img className="w-full h-full rounded-sm object-contain bg-card border border-solid border-border p-0.5" src={logo} alt={opt.name} />
                                      )}
                                      {/* Pastille d'etat en tete de ligne : inset LOGIQUE (le PMS est RTL). */}
                                      {isActive && (
                                        <div className="absolute -top-[3px] -end-[3px] size-[11px] rounded-full bg-success text-primary-foreground flex items-center justify-center border-2 border-solid border-card">
                                          <CheckCircle2 size={7} strokeWidth={4} />
                                        </div>
                                      )}
                                      {!isActive && hasToken && (
                                        <div className="absolute -top-[3px] -end-[3px] size-[9px] rounded-full bg-warning border-2 border-solid border-card" />
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
                                  className="text-muted-foreground"
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
                                  className="text-primary"
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
                                  className="text-info"
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
                                  className="text-success"
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
                                  className="text-destructive"
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
          <DialogHeader className="-mx-4 px-4 pb-[9px] pe-10 border-b border-solid border-border">
            <DialogTitle className="text-sm font-bold tracking-tight">
              Connecter "{connectForm.property?.name}" au hub de distribution
            </DialogTitle>
            <DialogDescription className="text-xs mt-0.5">
              {connectForm.mode === 'AUTO_CREATE'
                ? "Baitly va creer Property + Room Type + Rate Plan automatiquement dans le hub"
                : "Renseignez les 3 identifiants du hub (visibles dans votre dashboard)"}
            </DialogDescription>
          </DialogHeader>
          {connectForm.error && (
            <UiAlert variant="destructive" className="mb-3 text-xs">
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
                'p-[7.5px] border-[1.5px] border-solid rounded-xl cursor-pointer hover:border-primary',
                'transition-colors duration-[180ms] ease-out-quart motion-reduce:transition-none',
                connectForm.mode === 'AUTO_CREATE'
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-card',
              )}
            >
              <div className="flex items-center gap-1.5">
                {/* `divider` etait un jeton MUI dans un style inline : declaration
                    invalide, silencieusement ignoree. Le trait du kit est --border. */}
                <div className={cn('size-4 rounded-full border-2 border-solid shrink-0', connectForm.mode === 'AUTO_CREATE' ? 'border-primary bg-primary' : 'border-border bg-transparent')} />
                <p className="text-sm font-semibold text-foreground">
                  Creation automatique <span className="text-xs font-bold text-primary">RECOMMANDE</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground ms-4 mt-0.5">
                Baitly cree la Property, le Room Type et le Rate Plan automatiquement dans le hub de distribution en utilisant les infos de votre propriete.
              </p>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setConnectForm((s) => ({ ...s, mode: 'IMPORT_EXISTING', error: null }))}
              className={cn(
                'p-[7.5px] border-[1.5px] border-solid rounded-xl cursor-pointer hover:border-primary',
                'transition-colors duration-[180ms] ease-out-quart motion-reduce:transition-none',
                connectForm.mode === 'IMPORT_EXISTING'
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-card',
              )}
            >
              <div className="flex items-center gap-1.5">
                <div className={cn('size-4 rounded-full border-2 border-solid shrink-0', connectForm.mode === 'IMPORT_EXISTING' ? 'border-primary bg-primary' : 'border-border bg-transparent')} />
                <p className="text-sm font-semibold text-foreground">
                  Importer des IDs existants
                </p>
              </div>
              <p className="text-xs text-muted-foreground ms-4 mt-0.5">
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
            <UiAlert variant="info" className="text-xs">
              <Info />
              <AlertDescription><strong>Sera cree dans le hub de distribution :</strong><ul className="m-0 ps-3 mt-[3px]">
                <li>Property : <em>{connectForm.property.name}</em> ({connectForm.property.city}, {connectForm.property.country})</li>
                <li>Room Type : 1 unite, capacite {connectForm.property.maxGuests} personnes</li>
                <li>Rate Plan : Standard Rate, per_room</li>
              </ul></AlertDescription>
            </UiAlert>
          )}

          <UiAlert variant="info" className="mt-3 text-xs">
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

          Deux chemins, selon ce que Channex accepte :

          1. PRE-CREATION (createOtaChannel) quand on a les reglages du channel.
             Le channel naît deja rattache a la bonne propriete et le wizard
             s'ouvre directement dessus. C'est ce qui evite le piege observe le
             2026-08-14 : un channel cree dans le wizard sans choisir la
             propriete se retrouve rattache a rien, l'ecran de mapping affiche
             « No data » et le channel ne peut pas etre active.

          2. WIZARD SEUL en repli. Channex refuse la creation API d'Airbnb, Vrbo
             et Expedia (`channel: is invalid`) : pour eux le wizard est le seul
             chemin. L'echec de pre-creation est donc un cas NORMAL, pas une
             panne — on enchaîne sans rien dire a l'utilisateur. */}
      <ChannexOtaPickerDialog
        open={pickerDialog.open}
        onClose={() => setPickerDialog({ open: false, property: null })}
        propertyName={pickerDialog.property?.name ?? ''}
        onPick={async (code, settings) => {
          const property = pickerDialog.property;
          setPickerDialog({ open: false, property: null });
          if (!property) return;

          const option = CHANNEX_OTA_OPTIONS.find((o) => o.code === code);
          let prefetchedUrl: string | null = null;

          if (option && settings) {
            try {
              const created = await channexApi.createOtaChannel(
                property.id,
                option.apiChannelName,
                settings,
              );
              prefetchedUrl = created.embedUrl ?? null;
            } catch (err) {
              // Repli silencieux sur le wizard : cf. cas 2 ci-dessus.
              console.warn('Channex: pre-creation du channel impossible, repli wizard', err);
            }
          }

          setEmbedDialog({ open: true, property, channelCode: code, prefetchedUrl });
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

      {/* Confirmation de la purge. Action irreversible sur un service externe :
          elle bloque le reste, et rappelle la liste exacte etablie par la
          simulation plutot qu'un simple compte. */}
      <Dialog
        open={purge.confirming}
        onOpenChange={(next) => { if (!next && !purge.running) setPurge((s) => ({ ...s, confirming: false })); }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="flex-row items-start gap-1.5 pe-10">
            <div className="size-8 rounded-lg bg-destructive-soft text-destructive flex items-center justify-center shrink-0 mt-0.5">
              <Trash2 size={18} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-semibold leading-[1.3]">
                Supprimer {purge.report?.candidates} logement(s) du hub&nbsp;?
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription>
            Ces logements n'appartiennent à aucune organisation Baitly. Ils seront définitivement
            retirés du hub de distribution, avec leurs types de chambre et plans tarifaires.
            Irréversible. Aucun logement Baitly n'est touché.
          </DialogDescription>
          {purge.report && purge.report.items.some((item) => item.decision === 'PURGE') && (
            <div className="max-h-[180px] overflow-y-auto rounded-lg border border-solid border-border bg-background p-1.5">
              {purge.report.items
                .filter((item) => item.decision === 'PURGE')
                .map((item) => (
                  <span
                    key={item.channexPropertyId ?? item.title}
                    className="block text-xs text-muted-foreground leading-[1.6] truncate"
                  >
                    {item.title || item.channexPropertyId}
                  </span>
                ))}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={purge.running}
              onClick={() => setPurge((s) => ({ ...s, confirming: false }))}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={purge.running}
              onClick={() => runPurge(true)}
            >
              {purge.running ? <Spinner className="size-3" /> : <Trash2 size={14} />}
              {purge.running ? 'Suppression…' : 'Supprimer définitivement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation de deconnexion OTA (suppression channel + tokens OAuth) */}
      <Dialog
        open={disconnectOtaConfirm !== null}
        onOpenChange={(next) => { if (!next) setDisconnectOtaConfirm(null); }}
      >
        <DialogContent>
          <DialogHeader className="flex-row items-start gap-1.5 pe-10">
            <div className="size-8 rounded-lg bg-destructive-soft text-destructive flex items-center justify-center shrink-0 mt-0.5">
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
