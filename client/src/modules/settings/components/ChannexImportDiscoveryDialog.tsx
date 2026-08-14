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
import StatusChip from '../../../components/StatusChip';
import { Badge, Button } from '../../../components/ui';
import { Alert as UiAlert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  NativeSelect,
  NativeSelectOption,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { ArrowRight, Download, RefreshCw, CheckCircle2, AlertCircle, Info, Sparkles, Trash2, Link2, Image as ImageIcon } from 'lucide-react';

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
  /**
   * Rend le contenu SANS sa propre coquille Dialog, pour qu'il s'affiche comme
   * une vue du dialog parent (ChannexMappingDialog) au lieu d'une modale
   * empilee par-dessus. Une modale sur une modale coupe le fil de retour :
   * la croix de la modale du dessus laisse celle du dessous ouverte, et
   * l'utilisateur perd le chemin qui l'a amene la.
   */
  embedded?: boolean;
  /** Callback declenche apres un import reussi (>=1 property creee) pour refresh la liste parent. */
  onImported?: () => void;
  /**
   * Callback invoque quand l'utilisateur clique sur le CTA "Connecter une propriete
   * Baitly" depuis l'etat vide (hub sans aucune propriete) : permet au parent de
   * fermer ce sub-dialog et de basculer la vue principale sur 'CONNECT_EXISTING'.
   */
  onRequestConnectExisting?: () => void;
}

interface RowState {
  selected: boolean;
  propertyType: string; // overridable depuis suggestedType
}

/**
 * Gabarit unique des puces de metadonnees OTA : seule la VARIANTE du Badge
 * (`success` / `info` / `warning` / `secondary`) porte la couleur, et chacune
 * applique deja le couple fond `-soft` / encre `-ink` conforme AA.
 */
const OTA_BADGE_CLASS = 'h-[18px] text-2xs tabular-nums';

export default function ChannexImportDiscoveryDialog({
  open,
  onClose,
  embedded = false,
  onImported,
  onRequestConnectExisting,
}: ChannexImportDiscoveryDialogProps) {
  const { t } = useTranslation();
  const { isPlatformStaff } = useAuth();
  const staffMode = isPlatformStaff();

  // Options du dropdown propertyType : source unique = PROPERTY_TYPES dans
  // utils/statusUtils.ts (synchronise avec l'enum PropertyType cote backend).
  // Memoizee pour eviter de recalculer les options a chaque map().
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
  /** Deplie le choix d'OTA depuis l'encart « aucun compte connecte ». */
  const [otaPickerExpanded, setOtaPickerExpanded] = useState(false);
  /** Logement du hub en attente de confirmation de suppression (irreversible). */
  const [hubDeleteTarget, setHubDeleteTarget] = useState<ChannexDiscoveredProperty | null>(null);
  const [hubDeleting, setHubDeleting] = useState(false);
  /** Property du hub dont le rattachement est en cours (une seule a la fois). */
  const [reattaching, setReattaching] = useState<string | null>(null);

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

  /**
   * Rattache la property du hub au logement Baitly que le backend a reconnu,
   * au lieu d'en creer un second.
   *
   * Le logement conserve ainsi ses tarifs, son calendrier et ses reservations —
   * c'est tout l'interet par rapport a un import, qui repartirait de zero.
   */
  const handleReattach = useCallback(async (p: ChannexDiscoveredProperty) => {
    if (p.reattachPropertyId == null) return;
    setReattaching(p.channexPropertyId);
    setError(null);
    try {
      const result = await channexApi.reattachProperty(p.channexPropertyId, p.reattachPropertyId);
      const failure = result.details.find((d) => d.status === 'ERROR');
      if (failure) {
        setError(failure.message);
      } else {
        await refresh();
        if (onImported) onImported();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Le rattachement a echoue.');
    } finally {
      setReattaching(null);
    }
  }, [refresh, onImported]);

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
      setOtaPickerExpanded(false);
      setHubDeleteTarget(null);
      setHubDeleting(false);
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
   * Supprime definitivement du hub un logement orphelin. Le backend refuse si
   * le logement est encore mappe ou relie a une plateforme : son message est
   * repris tel quel, c'est lui qui indique la bonne marche a suivre.
   */
  const handleDeleteHubProperty = async () => {
    const target = hubDeleteTarget;
    if (!target) return;
    setHubDeleting(true);
    setError(null);
    try {
      await channexApi.deleteHubProperty(target.channexPropertyId);
      setHubDeleteTarget(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error
        ? err.message
        : 'Impossible de supprimer ce logement du hub.');
      setHubDeleteTarget(null);
    } finally {
      setHubDeleting(false);
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

  /**
   * Logements du hub reellement rattaches a un channel OTA. Distinct de
   * `totalInHub`, qui compte aussi ceux que Baitly a pousses lui-meme
   * (mode AUTO_CREATE, pivot OAuth) : sans cette distinction le stepper
   * annoncait des annonces « detectees » alors qu'aucun OTA n'etait connecte.
   */
  const otaDetectedCount = useMemo(
    () => discovered.filter((p) => (p.connectedOtas?.length ?? 0) > 0 || p.hasActiveOta).length,
    [discovered],
  );

  const activeOtaCount = connectedOtas.filter((o) => o.isActive || o.hasOauthToken).length;

  /**
   * Liste des OTA connectables. Extraite de l'etat « hub vide » parce qu'elle
   * sert desormais aussi quand le hub contient deja des logements sans qu'aucun
   * compte OTA ne soit autorise : l'ecran ne proposait alors QUE l'import, donc
   * la derniere etape, sans jamais offrir la premiere.
   */
  const otaPickerList = (
    <div className="flex flex-col gap-1.5">
      {CHANNEX_OTA_OPTIONS.map((option) => {
        const isLoading = settingUpOta === option.code;
        const disabled = settingUpOta !== null && !isLoading;
        // Detecte si un channel pour cet OTA existe deja (OAuth fait)
        const existing = connectedOtas.find(
          (ota) => ota.otaName.toLowerCase() === option.apiChannelName.toLowerCase()
            || ota.otaName.toLowerCase() === option.name.toLowerCase()
        );
        return (
          // La couleur de marque est une valeur d'execution : elle passe par une
          // variable CSS posee inline, que les classes hover/focus peuvent lire.
          <button
            type="button"
            key={option.code}
            onClick={() => handleSetupOauth(option.code, existing?.channelId)}
            disabled={settingUpOta !== null}
            style={{ '--ota-brand': option.brandColor } as React.CSSProperties}
            className={cn(
              'flex items-center gap-2 w-full p-[7.5px] rounded-xl border border-solid text-start',
              'transition-colors duration-[180ms] ease-out-quart motion-reduce:transition-none',
              'focus-visible:[outline:2px_solid_var(--ota-brand)] focus-visible:outline-offset-2',
              settingUpOta !== null ? 'cursor-wait' : 'cursor-pointer',
              isLoading
                ? 'border-[var(--ota-brand)] bg-[color-mix(in_srgb,var(--ota-brand)_3%,transparent)]'
                : 'border-border bg-card',
              settingUpOta === null
                && 'hover:border-[var(--ota-brand)] hover:bg-[color-mix(in_srgb,var(--ota-brand)_3%,transparent)]',
              disabled && 'opacity-45',
            )}
          >
            <img className="size-10 rounded-lg object-contain bg-card border border-solid border-border p-0.5 shrink-0" src={OTA_LOGO_BY_CODE[option.code]} alt={option.name} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-row items-center gap-[4.5px] mb-[1.5px]">
                <p className="text-xs font-semibold leading-[1.3] text-foreground">
                  {existing ? `Re-détecter mes annonces ${option.name}` : `Connecter ${option.name}`}
                </p>
                {existing && (
                  <Badge variant="success" className="h-[18px] text-2xs [&>svg]:text-success [&>svg]:ms-0.5"><CheckCircle2 size={11} />Compte autorisé</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground block leading-[1.3]">
                {isLoading
                  ? 'Préparation de la connexion…'
                  : existing
                    ? 'Rouvre l\'assistant pour rattacher les annonces ajoutées récemment'
                    : option.description}
              </span>
            </div>
            <div className={cn('shrink-0 flex items-center', !isLoading && 'text-muted-foreground')} style={isLoading ? { color: option.brandColor } : undefined}>
              {isLoading
                ? <Spinner className="size-3.5" style={{ color: option.brandColor }} />
                : <ArrowRight size={14} strokeWidth={2.2} className="cn-rtl-flip" />}
            </div>
          </button>
        );
      })}
    </div>
  );

  const content = (
    <>
        <div className="flex-1">
        {/* Phase 1 UX : Stepper visuel 3 etapes (Autoriser → Detecter → Synchroniser)
            qui montre ou en est l'utilisateur dans le flow Connect, base sur l'etat
            reel (nb OTAs connectes, nb properties detectees, nb importees). */}
        <div className="mb-2">
          <ChannexImportProgressStepper
            connectedOtaCount={activeOtaCount}
            totalInHub={totalInHub}
            otaDetectedCount={otaDetectedCount}
            importedCount={discovered.filter((p) => p.isImported).length}
          />
        </div>

        {/* Banner d'aide */}
        <div className="flex flex-row items-start gap-1.5 p-[7.5px] mb-3 rounded-lg border border-solid border-primary/20 bg-primary-soft/50">
          <div className="mt-[1.5px] shrink-0 text-primary">
            <Info size={14} />
          </div>
          <span className="text-xs text-muted-foreground leading-[1.5]">
            Une fois votre compte Airbnb (ou autre plateforme) connecté, toutes les annonces
            détectées apparaissent ici. Cochez celles à importer dans Baitly — leur nom,
            devise, pays et capacité sont pré-remplis automatiquement.
          </span>
        </div>

        {/* Etape 1 manquante alors que le hub contient deja des logements.
            Ce cas se produit quand des logements ont ete POUSSES depuis Baitly
            (« Connecter un de mes logements ») sans qu'aucun compte OTA ne soit
            autorise : l'ecran ne montrait alors que le tableau d'import, c'est
            a dire la derniere etape, sans jamais offrir la premiere. */}
        {!loading && !error && activeOtaCount === 0 && totalInHub > 0 && (
          <div className="mb-3 rounded-lg border border-solid border-warning/25 bg-warning-soft/40 p-[9px]">
            <div className="flex flex-row items-start gap-1.5">
              <div className="mt-[1.5px] shrink-0 text-warning">
                <TriangleAlert size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground leading-[1.3] mb-0.5">
                  Aucun compte OTA n'est encore connecté
                </p>
                <span className="text-xs text-muted-foreground block leading-[1.5]">
                  Les {totalInHub} logement{totalInHub > 1 ? 's' : ''} ci-dessous {totalInHub > 1 ? 'viennent' : 'vient'} du
                  hub de distribution, pas d'une plateforme. Connectez Airbnb ou Booking pour
                  que vos annonces en ligne soient détectées.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                aria-expanded={otaPickerExpanded}
                onClick={() => setOtaPickerExpanded((v) => !v)}
              >
                {otaPickerExpanded ? 'Masquer' : 'Connecter une plateforme'}
              </Button>
            </div>
            {otaPickerExpanded && (
              <div className="mt-[9px]">
                {otaPickerList}
              </div>
            )}
          </div>
        )}

        {/* Loading initial */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-9">
            <Spinner className="size-6" />
            <p className="text-xs text-muted-foreground">
              Recherche des proprietes en ligne...
            </p>
          </div>
        )}

        {/* Erreur */}
        {error && !loading && (
          <UiAlert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </UiAlert>
        )}

        {/* Recap apres import */}
        {importResult && (
          <UiAlert variant={importResult.errors > 0 ? 'warning' : 'success'} className="mb-3">
            <AlertDescription>
              <strong>{importResult.created}</strong> creees
              {importResult.skipped > 0 && (
                <> · <strong>{importResult.skipped}</strong> ignorees (deja mappees)</>
              )}
              {importResult.errors > 0 && (
                <> · <strong>{importResult.errors}</strong> erreurs</>
              )}
            </AlertDescription>
          </UiAlert>
        )}

        {/* Cas 1 : Hub vide (aucune propriete cote distribution)
            → on propose de connecter un OTA DIRECTEMENT depuis ce dialog
            (picker des 5 OTAs majeurs). Click sur une card declenche le
            setup-oauth backend qui cree une property pivot + ouvre l'iframe. */}
        {!loading && !error && discovered.length === 0 && totalInHub === 0 && !importResult && (
          <div className="py-3 px-1.5">
            <div className="flex flex-col items-center text-center mb-[15px]">
              <div className="size-14 rounded-full bg-primary-soft text-primary inline-flex items-center justify-center mb-[9px]">
                <Info size={24} />
              </div>
              <p className="text-xs font-semibold mb-0.5 text-foreground">
                Connectez un compte OTA pour importer vos annonces
              </p>
              <span className="text-xs text-muted-foreground block max-w-[500px] leading-[1.6]">
                Choisissez la plateforme sur laquelle vos logements sont déjà en ligne.
                Après authentification, Baitly détectera automatiquement vos annonces
                et vous proposera de les importer.
              </span>
            </div>

            {/* Picker OTA inline + indication "Re-detecter" si un channel existe deja */}
            <div className="mb-3">
              {otaPickerList}
            </div>

            {/* Action secondaire : si l'utilisateur prefere passer par une property Baitly existante */}
            {onRequestConnectExisting && (
              <div className="flex flex-row gap-1.5 justify-center mt-3">
                <span className="text-xs text-muted-foreground self-center">
                  Ou bien :
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRequestConnectExisting}
                  className="text-muted-foreground"
                >
                  Connecter un logement déjà dans Baitly
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refresh}
                  className="text-muted-foreground"
                >
                  <RefreshCw size={12} />
                  Rafraichir
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Cas 2 : Hub non vide mais tout deja importe */}
        {!loading && !error && discovered.length === 0 && totalInHub > 0 && !importResult && (
          <div className="py-6 px-3">
            <div className="flex flex-col items-center text-center mb-[18px]">
              <div className="size-14 rounded-full bg-success-soft text-success inline-flex items-center justify-center mb-2">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-xs font-semibold mb-0.5 text-foreground">
                Tout est synchronise
              </p>
              <span className="text-xs text-muted-foreground block mb-3 max-w-[480px] leading-[1.6]">
                Vos {totalInHub} propriete{totalInHub > 1 ? 's' : ''} en ligne {totalInHub > 1 ? 'sont' : 'est'} deja
                import{totalInHub > 1 ? 'ees' : 'ee'} dans Baitly. Si vous avez ajoute de nouvelles
                proprietes cote OTA depuis, re-detectez-les ci-dessous.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
              >
                <RefreshCw size={14} />
                Verifier a nouveau
              </Button>
            </div>

            {/* Section "Re-detecter listings" : visible si au moins 1 OTA est connecte */}
            {connectedOtas.length > 0 && (
              <>
                <Separator className="my-3" />
                <span className="text-xs text-muted-foreground font-semibold block mb-1.5 text-center">
                  Re-detecter de nouveaux listings ajoutes recemment cote OTA
                </span>
                <div className="flex flex-col gap-1.5">
                  {CHANNEX_OTA_OPTIONS
                    .flatMap((option) => {
                      const existing = connectedOtas.find(
                        (ota) => ota.otaName.toLowerCase() === option.apiChannelName.toLowerCase()
                          || ota.otaName.toLowerCase() === option.name.toLowerCase()
                      );
                      if (!existing) return [];
                      const isLoading = settingUpOta === option.code;
                      return [
                        <button
                          type="button"
                          key={option.code}
                          onClick={() => handleSetupOauth(option.code, existing.channelId)}
                          disabled={settingUpOta !== null}
                          style={{ '--ota-brand': option.brandColor } as React.CSSProperties}
                          className={cn(
                            'flex items-center gap-2 w-full p-[7.5px] rounded-xl border border-solid text-start',
                            'transition-colors duration-[180ms] ease-out-quart motion-reduce:transition-none',
                            settingUpOta !== null ? 'cursor-wait' : 'cursor-pointer',
                            isLoading
                              ? 'border-[var(--ota-brand)] bg-[color-mix(in_srgb,var(--ota-brand)_3%,transparent)]'
                              : 'border-border bg-card',
                            settingUpOta === null
                              && 'hover:border-[var(--ota-brand)] hover:bg-[color-mix(in_srgb,var(--ota-brand)_3%,transparent)]',
                          )}
                        >
                          <img className="size-9 rounded-lg object-contain bg-card border border-solid border-border p-0.5 shrink-0" src={OTA_LOGO_BY_CODE[option.code]} alt={option.name} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold leading-[1.3] text-foreground">
                              Re-detecter mes listings {option.name}
                            </p>
                            <span className="text-xs text-muted-foreground block leading-[1.3]">
                              {isLoading
                                ? 'Ouverture du widget...'
                                : 'Rouvre le wizard onglet Listing pour mapper de nouveaux listings'}
                            </span>
                          </div>
                          <div className={cn('shrink-0 flex items-center', !isLoading && 'text-faint')} style={isLoading ? { color: option.brandColor } : undefined}>
                            {isLoading
                              ? <Spinner className="size-3.5" style={{ color: option.brandColor }} />
                              : <ArrowRight size={14} strokeWidth={2.2} className="cn-rtl-flip" />}
                          </div>
                        </button>,
                      ];
                    })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Liste des properties non-mappees */}
        {!loading && discovered.length > 0 && (
          <>
            {/* Header avec resume du diff (au lieu de select-all classique) */}
            <div className="flex items-center gap-2 p-1.5 px-2 rounded-lg bg-background mb-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground flex-1 tabular-nums">
                {discovered.length} propriete{discovered.length > 1 ? 's' : ''} dans le hub
                {diff.toImport.length > 0 && (
                  <> · <span className="font-semibold text-primary">
                    +{diff.toImport.length} a importer
                  </span></>
                )}
                {diff.toDisconnect.length > 0 && (
                  <> · <span className="text-destructive-ink font-semibold">
                    −{diff.toDisconnect.length} a desimporter
                  </span></>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={refresh}
                className="text-muted-foreground"
              >
                <RefreshCw size={12} />
                Rafraichir
              </Button>
            </div>

            {/* Banner info si user a coche des desimports (perte sync) */}
            {diff.toDisconnect.length > 0 && (
              <UiAlert variant="warning" className="mb-1.5 text-xs">
                <TriangleAlert />
                <AlertDescription><strong>{diff.toDisconnect.length} propriete{diff.toDisconnect.length > 1 ? 's' : ''}</strong>{' '}va etre desimport{diff.toDisconnect.length > 1 ? 'ees' : 'ee'}: le lien avec le hub sera
                supprime mais la Property Baitly correspondante sera conservee (vous pourrez la re-importer
                plus tard).</AlertDescription>
              </UiAlert>
            )}

            <div className="flex flex-col gap-[3px]">
              {discovered.map((p) => {
                const row = rows[p.channexPropertyId] ?? { selected: p.isImported, propertyType: 'APARTMENT' };
                // Etat visuel par diff — quatre cas fermes, donc quatre jeux de
                // classes LITTERAUX (l'ancien code passait `divider` /
                // `background.paper`, jetons MUI invalides en CSS, et
                // concatenait un alpha sur un `var()`).
                // - importee & cochee → vert (existante, conservee)
                // - importee & decochee → rouge (sera desimportee)
                // - non-importee & cochee → marque (sera importee)
                // - non-importee & decochee → neutre (ignoree)
                const hasLinkedOta = (p.connectedOtas?.length ?? 0) > 0 || p.hasActiveOta;
                const rowClass = p.isImported
                  ? (row.selected ? 'border-success/60 bg-success-soft/30' : 'border-destructive/60 bg-destructive-soft/30')
                  : (row.selected ? 'border-primary/60 bg-primary-soft/50' : 'border-border bg-card');
                return (
                  <div className={cn('flex items-start gap-[9px] p-[7.5px] rounded-xl border border-solid transition-colors duration-[180ms] ease-out-quart motion-reduce:transition-none', rowClass)} key={p.channexPropertyId}>
                    {/* Teinte de la case cochee : deux jeux de classes LITTERAUX,
                        une classe Tailwind ne pouvant pas naitre d'une variable. */}
                    <Checkbox
                      checked={row.selected}
                      onCheckedChange={(checked) => toggleRow(p.channexPropertyId, checked === true)}
                      aria-label={`Selectionner ${p.title || 'cette propriete'}`}
                      className={cn(
                        'mt-0.5',
                        p.isImported
                          ? 'data-checked:bg-success data-checked:border-success'
                          : 'data-checked:bg-primary data-checked:border-primary',
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-row items-center gap-[4.5px] mb-[1.5px] flex-wrap">
                        <p className="text-xs font-semibold truncate me-0.5 text-foreground">
                          {p.title || 'Sans titre'}
                        </p>
                        {p.isImported && (
                          <StatusChip size="sm" tokens={row.selected
                              ? { color: 'var(--bui-success-ink)', bg: 'var(--bui-success-soft)' }
                              : { color: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' }} label={row.selected
                              ? `Importee${p.clenzyPropertyName ? ` (${p.clenzyPropertyName})` : ''}`
                              : 'Sera desimportee'} icon={<CheckCircle2 size={11} />} className="text-2xs" />
                        )}
                        {/* "Actif" est affiche dans la colonne droite (a cote des
                            logos OTA) — pas dans la rangee titre. */}
                        {/* Indicateur d'auto-creation cote Channex pendant l'import :
                            si room_type ou rate_plan manquent, on les creera automatiquement
                            (le user sait a quoi s'attendre avant de cliquer Importer). */}
                        {(!p.hasRoomType || !p.hasRatePlan) && (
                          <Badge variant="warning" className="h-[18px] text-2xs [&>svg]:text-warning [&>svg]:ms-0.5"><Sparkles size={11} />{!p.hasRoomType && !p.hasRatePlan
                                ? 'Room + Rate auto-crees'
                                : !p.hasRoomType ? 'Room auto-cree' : 'Rate auto-cree'}</Badge>
                        )}
                        {/* Contenu enrichi disponible (photos, description, address) :
                            visible quand le tier de distribution payant sync depuis Airbnb. */}
                        {p.photoCount > 0 && (
                          <Badge variant="info" className="h-[18px] text-2xs tabular-nums [&>svg]:text-info [&>svg]:ms-0.5"><ImageIcon size={11} />{`${p.photoCount} photo${p.photoCount > 1 ? 's' : ''}`}</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground block leading-[1.4]">
                        {[
                          p.country,
                          p.currency,
                          p.maxOccupancy ? `${p.maxOccupancy} pers max` : null,
                          p.hasAddress ? '✓ adresse' : null,
                          p.hasDescription ? '✓ description' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>

                      {/* Ce logement existe deja dans Baitly : l'importer en
                          creerait un SECOND, l'ancien gardant tarifs, calendrier
                          et reservations. La case reste utilisable — on propose,
                          on n'interdit pas — mais le rattachement est a un clic. */}
                      {p.reattachPropertyId != null && (
                        <div className="mt-[6px] flex flex-wrap items-center gap-[6px] rounded-lg border border-solid border-info/40 bg-info-soft/40 px-[7.5px] py-[6px]">
                          <Link2 size={13} className="shrink-0 text-info" />
                          <span className="min-w-0 flex-1 text-xs leading-[1.4] text-info-ink">
                            Déjà présent dans Baitly sous «&nbsp;{p.reattachPropertyName}&nbsp;» —
                            le rattacher conserve ses tarifs et son historique.
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-[26px] shrink-0 gap-1 text-xs"
                            disabled={reattaching !== null}
                            onClick={() => { void handleReattach(p); }}
                          >
                            {reattaching === p.channexPropertyId
                              ? <Spinner className="size-3" />
                              : <Link2 size={12} />}
                            Rattacher
                          </Button>
                        </div>
                      )}
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
                        <div className="flex flex-row flex-wrap items-center gap-[3px] mt-[3px]">
                          {/* Type listing brut (donnee structuree primaire) */}
                          {p.otaListingType && (
                            <StatusChip size="sm" tokens={{ color: 'var(--bui-info-ink)', bg: 'var(--bui-info-soft)' }} label={`Type OTA : ${p.otaListingType}`} className="text-2xs font-mono" />
                          )}
                          {/* Tarifs */}
                          {p.otaNightlyPrice != null && (
                            <Badge variant="success" className={OTA_BADGE_CLASS}>{`${p.otaNightlyPrice} ${p.currency || 'EUR'} / nuit`}</Badge>
                          )}
                          {p.otaWeekendPrice != null && p.otaWeekendPrice !== p.otaNightlyPrice && (
                            <Badge variant="success" className={OTA_BADGE_CLASS}>{`weekend : ${p.otaWeekendPrice} ${p.currency || 'EUR'}`}</Badge>
                          )}
                          {p.otaGuestsIncluded != null && (
                            <Badge variant="info" className={OTA_BADGE_CLASS}>{`${p.otaGuestsIncluded} voyageur${p.otaGuestsIncluded > 1 ? 's' : ''} inclus`}</Badge>
                          )}
                          {p.otaPricePerExtraPerson != null && p.otaPricePerExtraPerson > 0 && (
                            <Badge variant="info" className={OTA_BADGE_CLASS}>{`+${p.otaPricePerExtraPerson} ${p.currency || 'EUR'} / voyageur supp.`}</Badge>
                          )}
                          {p.otaMonthlyPriceFactor != null && p.otaMonthlyPriceFactor > 0 && (
                            <Badge variant="secondary" className={cn(OTA_BADGE_CLASS, 'bg-field text-muted-foreground')}>{`-${p.otaMonthlyPriceFactor}% mensuel`}</Badge>
                          )}
                          {/* Sejour */}
                          {p.otaMinNights != null && (
                            <Badge variant="warning" className={OTA_BADGE_CLASS}>{`min ${p.otaMinNights} nuit${p.otaMinNights > 1 ? 's' : ''}`}</Badge>
                          )}
                          {p.otaMaxNights != null && p.otaMaxNights < 365 && (
                            <Badge variant="warning" className={OTA_BADGE_CLASS}>{`max ${p.otaMaxNights} nuits`}</Badge>
                          )}
                          {/* Check-in/out */}
                          {p.otaCheckOutTime != null && (
                            <Badge variant="info" className={OTA_BADGE_CLASS}>{`check-out ${p.otaCheckOutTime}h`}</Badge>
                          )}
                          {p.otaCheckInTimeStart && p.otaCheckInTimeStart !== 'FLEXIBLE' && (
                            <Badge variant="info" className={OTA_BADGE_CLASS}>{`check-in ${p.otaCheckInTimeStart}h`}</Badge>
                          )}
                          {/* Politiques */}
                          {p.otaCancellationPolicy && (
                            <Badge variant="destructive" className={cn(OTA_BADGE_CLASS, 'bg-destructive-soft text-destructive-ink')}>{`annulation : ${p.otaCancellationPolicy}`}</Badge>
                          )}
                          {p.otaInstantBooking && (
                            <Badge variant="destructive" className={cn(OTA_BADGE_CLASS, 'bg-destructive-soft text-destructive-ink')}>{`booking : ${p.otaInstantBooking}`}</Badge>
                          )}
                          {/* Regles du logement (true uniquement = autorise par le host) */}
                          {p.otaAllowsPets === true && (
                            <Badge variant="secondary" className={cn(OTA_BADGE_CLASS, 'bg-field text-muted-foreground')}>animaux acceptes</Badge>
                          )}
                          {p.otaAllowsSmoking === true && (
                            <Badge variant="secondary" className={cn(OTA_BADGE_CLASS, 'bg-field text-muted-foreground')}>fumeurs acceptes</Badge>
                          )}
                          {p.otaAllowsEvents === true && (
                            <Badge variant="secondary" className={cn(OTA_BADGE_CLASS, 'bg-field text-muted-foreground')}>evenements acceptes</Badge>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Colonne droite : logos OTA + chip "Actif" en haut,
                        dropdown type Baitly en dessous. */}
                    <div className="flex flex-col gap-1.5 items-end shrink-0">
                      {(p.connectedOtas?.length > 0 || p.hasActiveOta) && (
                        <div className="flex flex-row items-center gap-[4.5px]">
                          {p.connectedOtas && p.connectedOtas.length > 0 && (
                            <OtaSyncBadges otas={p.connectedOtas} size={22} />
                          )}
                          {p.hasActiveOta && (
                            <Badge variant="success" className="h-5 text-2xs [&>svg]:text-success [&>svg]:ms-0.5"><CheckCircle2 size={11} />Actif</Badge>
                          )}
                        </div>
                      )}
                      {/* Dropdown type Baitly : visible UNIQUEMENT pour les nouveaux
                          imports (proprietes non-importees). */}
                      {!p.isImported && (
                        <div className="flex flex-row items-center gap-1">
                          <NativeSelect
                            size="sm"
                            className="min-w-[130px]"
                            aria-label="Type de propriete Baitly"
                            value={row.propertyType}
                            onChange={(e) => updateType(p.channexPropertyId, e.target.value)}
                            disabled={!row.selected}
                          >
                            {propertyTypeOptions.map((opt) => (
                              <NativeSelectOption key={opt.value} value={opt.value}>
                                {opt.label}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                          {/* Seule sortie pour un orphelin du hub : sans mapping
                              Baitly, aucun autre ecran ne le designe. Reservee aux
                              lignes non importees — une ligne importee se retire
                              par la deconnexion complete, qui libere les OTA.
                              Desactivee quand une plateforme y est encore reliee :
                              le backend refuserait, autant le dire avant le clic. */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={hasLinkedOta}
                                  aria-label={`Supprimer « ${p.title || 'ce logement'} » du hub`}
                                  className="text-muted-foreground hover:text-destructive-ink hover:bg-destructive-soft"
                                  onClick={() => setHubDeleteTarget(p)}
                                >
                                  <Trash2 size={15} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {hasLinkedOta
                                ? 'Déconnectez d\'abord la plateforme reliée'
                                : 'Supprimer du hub'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Details du recap (errors / skipped) */}
            {importResult && importResult.details.some((d) => d.status !== 'CREATED') && (
              <div className="mt-3">
                <Separator className="mb-1.5" />
                <span className="text-xs text-muted-foreground font-semibold block mb-0.5">
                  Detail des cas particuliers
                </span>
                <div className="flex flex-col gap-[3px]">
                  {importResult.details
                    .flatMap((d) => d.status !== 'CREATED' ? [
                      <div
                        key={d.channexPropertyId}
                        className="flex flex-row items-center gap-1.5 text-xs"
                      >
                        <AlertCircle
                          size={12}
                          className={cn('shrink-0', d.status === 'ERROR' ? 'text-destructive' : 'text-warning')}
                        />
                        <span className="text-xs text-muted-foreground flex-1 truncate">
                          {d.channexPropertyId.slice(0, 8)} : {d.message}
                        </span>
                      </div>,
                    ] : [])}
                </div>
              </div>
            )}
          </>
        )}
        </div>

      {/* Footer avec bouton Import */}
      {!loading && discovered.length > 0 && (
        // Le trait de separation court d'un bord a l'autre : `-mx-4` annule la
        // gouttiere du conteneur, `px-4` la restitue au contenu.
        <div className="flex justify-between items-center gap-3 -mx-4 px-4 pt-3 mt-3 border-t border-solid border-border flex-wrap">
          {/* Override multi-tenant — visible uniquement pour les platform staff
              (SUPER_ADMIN / SUPER_MANAGER). Permet d'attribuer la property creee
              a une autre org + un autre user (sinon owner = self). */}
          {staffMode && diff.toImport.length > 0 ? (
            <div className="flex flex-row items-center gap-1.5 flex-1 min-w-0">
              <span className="text-xs text-muted-foreground font-semibold shrink-0">
                Attribuer à :
              </span>
              {/* Le placeholder de l'ancien renderValue devient la premiere option. */}
              <NativeSelect
                size="sm"
                className="min-w-[160px]"
                aria-label="Organisation cible"
                value={targetOrgId === '' ? '' : String(targetOrgId)}
                onChange={(e) => setTargetOrgId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <NativeSelectOption value="">Mon organisation (par défaut)</NativeSelectOption>
                {organizations.map((o) => (
                  <NativeSelectOption key={o.id} value={o.id}>
                    {o.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {targetOrgId !== '' && (
                <NativeSelect
                  size="sm"
                  className="min-w-[160px]"
                  aria-label="Owner cible"
                  value={targetOwnerId === '' ? '' : String(targetOwnerId)}
                  onChange={(e) => setTargetOwnerId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <NativeSelectOption value="">
                    {usersInOrg.length === 0 ? 'Aucun user dans cette org' : 'Choisir un owner'}
                  </NativeSelectOption>
                  {usersInOrg.map((u) => {
                    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
                    const label = fullName ? `${fullName} (${u.email})` : u.email;
                    return (
                      <NativeSelectOption key={u.id} value={u.id}>
                        {label}
                      </NativeSelectOption>
                    );
                  })}
                </NativeSelect>
              )}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex flex-row items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            {embedded ? 'Retour' : 'Fermer'}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleApply}
            disabled={importing || !hasChanges}
          >
            {importing ? <Spinner className="size-3" /> : <Download size={14} />}
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
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
    {embedded ? (
      // Vue integree au dialog parent : pas de coquille, pas d'en-tete (le
      // parent porte le titre et la fleche de retour).
      // Hauteur laissee au contenu : le parent porte deja `max-h` + defilement.
      // Un `flex-1 min-h-0` ici donnerait un plancher de zero a la vue.
      open ? <div className="flex flex-col">{content}</div> : null
    ) : (
      <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent className="sm:max-w-4xl min-h-[min(70vh,700px)] max-h-[90vh] overflow-y-auto flex flex-col">
          {/* La croix de fermeture est fournie par DialogContent : `pe-14` reserve sa place. */}
          <DialogHeader className="flex-row items-start gap-2 pe-14">
            <div className="size-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
              <Download size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-semibold leading-[1.3]">
                Importer un logement déjà en ligne
              </DialogTitle>
              <DialogDescription className="text-xs block leading-[1.4]">
                Détecte les annonces Airbnb, Booking ou Vrbo déjà connues du hub de distribution et pas encore dans Baitly
              </DialogDescription>
            </div>
          </DialogHeader>

          {content}
        </DialogContent>
      </Dialog>
    )}

    {/* Confirmation de suppression d'un orphelin du hub. Modale de confirmation
        au-dessus de la vue : c'est le cas ou l'empilement se justifie — une
        action irreversible doit bloquer le reste. */}
    <Dialog
      open={hubDeleteTarget !== null}
      onOpenChange={(next) => { if (!next && !hubDeleting) setHubDeleteTarget(null); }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex-row items-start gap-1.5 pe-10">
          <div className="size-8 rounded-lg bg-destructive-soft text-destructive flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 size={18} />
          </div>
          <div className="min-w-0">
            <DialogTitle className="font-semibold leading-[1.3]">
              Supprimer ce logement du hub&nbsp;?
            </DialogTitle>
          </div>
        </DialogHeader>
        <DialogDescription>
          <strong>{hubDeleteTarget?.title || 'Ce logement'}</strong> sera définitivement retiré du
          hub de distribution, avec son type de chambre et son plan tarifaire. Cette action est
          irréversible : pour le remettre en ligne, il faudra le recréer depuis Baitly ou le
          redétecter depuis la plateforme. Aucun logement Baitly n'est touché.
        </DialogDescription>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={hubDeleting}
            onClick={() => setHubDeleteTarget(null)}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={hubDeleting}
            onClick={handleDeleteHubProperty}
          >
            {hubDeleting ? <Spinner className="size-3" /> : <Trash2 size={14} />}
            {hubDeleting ? 'Suppression…' : 'Supprimer du hub'}
          </Button>
        </DialogFooter>
      </DialogContent>
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
