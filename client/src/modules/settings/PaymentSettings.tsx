import React, { useState, useEffect, useCallback } from "react";
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { Spinner } from '../../components/ui';
import { cn } from '../../utils/cn';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import PageTabs from '../../components/PageTabs';
import { useNotification } from '../../hooks/useNotification';
import {
  Save,
  Payment,
  AccountBalance,
  PieChart,
  CreditCard,
  Public,
} from "../../icons";
import { Info, TriangleAlert } from "lucide-react";
import {
  Alert as UiAlert,
  AlertDescription as UiAlertDescription,
} from "../../components/ui";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../components/ui";
import { useQuery } from "@tanstack/react-query";
import { channelLogo } from "../../components/channelLogos";
import { managementContractsApi } from "../../services/api/managementContractsApi";
import { paymentConfigApi } from "../../services/api/paymentConfigApi";
import { splitConfigApi } from "../../services/api/splitConfigApi";
import { monetizationConfigApi } from "../../services/api/monetizationConfigApi";
import type {
  PaymentMethodConfig,
  PaymentProviderType,
  SplitConfiguration,
} from "../../types/payment";
import { PAYMENT_PROVIDER_LABELS } from "../../types/payment";
import { useTranslation } from "../../hooks/useTranslation";
import {
  useCommissionOverview,
  useSaveCommission,
} from "../../hooks/useAccounting";
import type { ChannelCommissionOverview } from "../../services/api/accountingApi";
import SettingsSection from "./components/SettingsSection";
import { useAuth } from "../../hooks/useAuth";
import MaintenanceDepositSection from "./MaintenanceDepositSection";
import SplitBarEditor from "./components/SplitBarEditor";
import ServicesActivitiesPanel from "./components/ServicesActivitiesPanel";
import type { SplitBarSegment } from "./components/SplitBarEditor";
import { useSettingsHeaderActions } from "./SettingsHeaderContext";
import SettingsToggleRow from "./components/SettingsToggleRow";
import PaymentProviderConfigDialog from "./components/PaymentProviderConfigDialog";
import { Settings as SettingsIcon } from "../../icons";

// ─── Provider metadata ───────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  STRIPE: "#635BFF",
  PAYTABS: "#1A8FE3",
  CMI: "#E4002B",
  PAYZONE: "#00B67A",
  YOUCAN_PAY: "#7B2CBF",
  PAYPAL: "#003087",
};

const PROVIDER_REGIONS: Record<string, string> = {
  STRIPE: "Europe",
  PAYTABS: "Arabie Saoudite",
  CMI: "Maroc",
  PAYZONE: "Maroc",
  YOUCAN_PAY: "Maroc",
  PAYPAL: "Global",
};

// ─── Teintes des parts (palette Baitly UI) ──────────────────────────────────

/**
 * Chaque part porte DEUX teintes, et elles ne sont pas interchangeables :
 * l'aplat sert de remplissage a la barre et de pastille de legende, l'encre
 * sert au TEXTE des champs — la teinte vive n'y passerait pas le seuil AA.
 */
const SHARE_FILL = {
  owner: "var(--bui-success)",
  platform: "var(--bui-primary)",
  concierge: "var(--bui-warning)",
} as const;

const SHARE_INK = {
  owner: "var(--bui-success-ink)",
  platform: "var(--bui-primary)",
  concierge: "var(--bui-warning-ink)",
} as const;

/**
 * Taux a utiliser pour projeter un reversement : ce que le canal a reellement
 * factures s'il l'a remonte, sinon le taux de reference. La colonne « Source »
 * du detail dit lequel des deux a servi.
 */
function effectiveRate(row: ChannelCommissionOverview | null): number {
  if (!row) return 0;
  return row.observedRate ?? row.referenceRate;
}

/** Providers configurables via le dialog (credentials chiffres en BDD).
 *  STRIPE est configure cote application.yml (global), pas par-tenant.
 *
 *  PAYPAL est volontairement absent : le provider a ete retire du backend
 *  (cf. `PaymentProviderType` cote serveur — la valeur d'enum n'est conservee
 *  que pour Hibernate, aucun `PaymentProvider` ni webhook ne l'implemente).
 *  L'exposer ici laissait un admin saisir des credentials pour un fournisseur
 *  inexistant, et activer un moyen de paiement qui n'encaisserait jamais.
 */
const CONFIGURABLE_PROVIDERS: PaymentProviderType[] = [
  "PAYTABS",
  "CMI",
  "PAYZONE",
  "YOUCAN_PAY",
];
const STUB_PROVIDERS: PaymentProviderType[] = [];

const allProviders: PaymentProviderType[] = [
  "STRIPE",
  "PAYTABS",
  "CMI",
  "PAYZONE",
  "YOUCAN_PAY",
];

/**
 * Verifie si la config d'un provider est suffisamment renseignee pour
 * etre activee.
 * - STRIPE   : toujours OK (config globale application.yml).
 * - PAYTABS  : profileId + region dans configJson (server_key chiffré BDD).
 * - CMI      : okUrl + failUrl dans configJson (client_id + store_key BDD).
 * - PAYZONE  : webhookUrl dans configJson (api_key BDD). MAD principal.
 * - YOUCAN_PAY : presence du record (cle privee chiffree, non exposee).
 */
const isProviderConfigured = (
  type: PaymentProviderType,
  config?: PaymentMethodConfig
): boolean => {
  if (type === "STRIPE") return true;
  if (!config) return false;
  const json = (config.config ?? {}) as Record<string, unknown>;
  if (type === "PAYTABS") {
    return (
      json.profileId != null &&
      typeof json.region === "string" &&
      json.region.length > 0
    );
  }
  if (type === "CMI") {
    return typeof json.okUrl === "string" && typeof json.failUrl === "string";
  }
  if (type === "PAYZONE") {
    // L'api_key elle-même n'est pas exposée par l'API (chiffrée), donc on
    // s'appuie sur la presence d'au moins une clef provider-specific dans
    // configJson — la webhookUrl est requise au moment du saving du dialog.
    return typeof json.webhookUrl === "string" && json.webhookUrl.length > 0;
  }
  if (type === "YOUCAN_PAY") {
    // La clé privée (chiffrée) n'est pas exposée par l'API — l'existence du
    // record suffit (elle est requise au save du dialog).
    return config.id != null;
  }
  return false;
};

export default function PaymentSettings() {
  const { hasAnyRole } = useAuth();
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const [configs, setConfigs] = useState<PaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configDialogProvider, setConfigDialogProvider] =
    useState<PaymentProviderType | null>(null);
  const [providersOpen, setProvidersOpen] = useState(false);

  // Split config state
  const [splitConfig, setSplitConfig] = useState<SplitConfiguration | null>(
    null
  );
  const [ownerPct, setOwnerPct] = useState("80");
  const [platformPct, setPlatformPct] = useState("5");
  const [conciergePct, setConciergePct] = useState("15");
  // Un seul indicateur de sauvegarde : le header n'a qu'un bouton.
  const [saving, setSaving] = useState(false);
  const monetization = useMonetizationForm();

  // Parts figees par contrat : elles n'absorbent plus les ajustements, ce sont
  // les autres qui servent de variable. Etat d'edition pur, jamais persiste.
  const [lockedShares, setLockedShares] = useState<Record<string, boolean>>({});
  const [simulatedChannel, setSimulatedChannel] = useState<string | null>(null);
  const [splitTab, setSplitTab] = useState(0);

  const { data: overviewRows = [] } = useCommissionOverview();

  // Combien de logements echappent a la repartition ci-dessus : sous contrat de
  // gestion, SplitPaymentService lit le taux du contrat et non split_configurations.
  // L'afficher evite de lire cet ecran comme la regle unique, ce qu'il n'est pas.
  const { data: activeContracts = [] } = useQuery({
    queryKey: ["management-contracts", "ACTIVE"],
    queryFn: () => managementContractsApi.getAll({ status: "ACTIVE" }),
    staleTime: 300_000,
  });
  const contractedCount = new Set(
    activeContracts
      .filter((c) => c.commissionRate != null && c.commissionRate > 0)
      .map((c) => c.propertyId),
  ).size;

  // Le canal le plus utilise ouvre la simulation (le backend trie par volume).
  const activeChannel = simulatedChannel ?? overviewRows[0]?.channel ?? null;
  const activeRow =
    overviewRows.find((r) => r.channel === activeChannel) ?? null;
  const simulatedFee = effectiveRate(activeRow);

  const splitSegments: SplitBarSegment[] = [
    {
      key: "owner",
      label: t("settings.split.ownerShare"),
      value: parseFloat(ownerPct) || 0,
      color: SHARE_FILL.owner,
      locked: lockedShares.owner,
    },
    {
      key: "platform",
      label: t("settings.split.platformShare"),
      value: parseFloat(platformPct) || 0,
      color: SHARE_FILL.platform,
      locked: lockedShares.platform,
    },
    {
      key: "concierge",
      label: t("settings.split.conciergeShare"),
      value: parseFloat(conciergePct) || 0,
      color: SHARE_FILL.concierge,
      locked: lockedShares.concierge,
    },
  ];

  const handleSegmentsChange = (next: SplitBarSegment[]) => {
    const asString = (v: number) => String(Math.round(v * 10) / 10);
    for (const segment of next) {
      if (segment.key === "owner") setOwnerPct(asString(segment.value));
      if (segment.key === "platform") setPlatformPct(asString(segment.value));
      if (segment.key === "concierge") setConciergePct(asString(segment.value));
    }
  };

  const toggleShareLock = (key: string) =>
    setLockedShares((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    loadConfigs();
    loadSplitConfig();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await paymentConfigApi.getConfigs();
      setConfigs(data);
    } catch (error) {
      console.error("Failed to load payment configs:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSplitConfig = async () => {
    try {
      const configs = await splitConfigApi.getConfigs();
      const defaultConfig =
        configs.find((c) => c.isDefault) ?? configs[0] ?? null;
      if (defaultConfig) {
        setSplitConfig(defaultConfig);
        setOwnerPct(String(Math.round(defaultConfig.ownerShare * 10000) / 100));
        setPlatformPct(
          String(Math.round(defaultConfig.platformShare * 10000) / 100)
        );
        setConciergePct(
          String(Math.round(defaultConfig.conciergeShare * 10000) / 100)
        );
      }
    } catch (error) {
      console.error("Failed to load split config:", error);
    }
  };

  const handleToggle = async (
    providerType: PaymentProviderType,
    currentEnabled: boolean
  ) => {
    const config = getConfig(providerType);
    // Pour PayTabs/CMI : si on essaie d'activer mais pas encore configure → ouvre le dialog.
    if (
      !currentEnabled &&
      CONFIGURABLE_PROVIDERS.includes(providerType) &&
      !isProviderConfigured(providerType, config)
    ) {
      openConfigDialog(providerType);
      return;
    }
    try {
      await paymentConfigApi.updateConfig(providerType, {
        enabled: !currentEnabled,
      });
      setConfigs((prev) =>
        prev.map((c) =>
          c.providerType === providerType
            ? { ...c, enabled: !currentEnabled }
            : c
        )
      );
      showNotification(
        `${PAYMENT_PROVIDER_LABELS[providerType]} ${!currentEnabled ? "activé" : "désactivé"}`,
        "success",
      );
    } catch (error) {
      showNotification("Erreur lors de la mise à jour", "error");
    }
  };

  const openConfigDialog = (providerType: PaymentProviderType) => {
    setConfigDialogProvider(providerType);
    setConfigDialogOpen(true);
  };

  const handleSaveProviderConfig = async (
    data: Parameters<typeof paymentConfigApi.updateConfig>[1]
  ) => {
    if (!configDialogProvider) return;
    const updated = await paymentConfigApi.updateConfig(
      configDialogProvider,
      data
    );
    setConfigs((prev) => {
      const existing = prev.find(
        (c) => c.providerType === configDialogProvider
      );
      return existing
        ? prev.map((c) =>
            c.providerType === configDialogProvider ? updated : c
          )
        : [...prev, updated];
    });
    showNotification(`${PAYMENT_PROVIDER_LABELS[configDialogProvider]} configuré`, "success");
  };

  const splitTotal = useCallback(() => {
    const o = parseFloat(ownerPct) || 0;
    const p = parseFloat(platformPct) || 0;
    const c = parseFloat(conciergePct) || 0;
    return Math.round((o + p + c) * 100) / 100;
  }, [ownerPct, platformPct, conciergePct]);

  const saveSplit = async () => {
    const data = {
      name: splitConfig?.name ?? t("settings.split.configName"),
      ownerShare: parseFloat(ownerPct) / 100,
      platformShare: parseFloat(platformPct) / 100,
      conciergeShare: parseFloat(conciergePct) / 100,
      isDefault: true,
      active: true,
    };
    setSplitConfig(
      splitConfig?.id
        ? await splitConfigApi.update(splitConfig.id, data)
        : await splitConfigApi.create(data)
    );
  };

  /** true si la repartition affichee differe de celle enregistree. */
  const isSplitDirty = (() => {
    if (!splitConfig) return true;
    const asPct = (share: number) => String(Math.round(share * 10000) / 100);
    return (
      ownerPct !== asPct(splitConfig.ownerShare) ||
      platformPct !== asPct(splitConfig.platformShare) ||
      conciergePct !== asPct(splitConfig.conciergeShare)
    );
  })();

  // Le total a 100 % ne conditionne QUE la repartition : un total invalide ne
  // doit pas empecher d'enregistrer les commissions plateforme, qui sont une
  // configuration independante depuis que le bouton est mutualise.
  const splitBlocksSave = isSplitDirty && splitTotal() !== 100;
  const isDirty = isSplitDirty || monetization.isDirty;
  const canSave = isDirty && !splitBlocksSave && !saving;

  /**
   * Enregistrement unique du header : ne soumet que les sections modifiees.
   * Les deux configurations vivent dans des tables distinctes, donc dans deux
   * appels — mais l'utilisateur n'a qu'une action a faire.
   */
  const handleSaveAll = async () => {
    if (splitBlocksSave) {
      showNotification(t("settings.split.totalError"), "error");
      return;
    }
    setSaving(true);
    try {
      if (isSplitDirty) await saveSplit();
      if (monetization.isDirty) await monetization.save();
      showNotification(t("settings.split.saved"), "success");
    } catch {
      showNotification(t("settings.split.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const headerActions = useSettingsHeaderActions(
    <>
      <Button variant="outline" size="sm" onClick={() => setProvidersOpen(true)}>
        <CreditCard size={14} strokeWidth={1.75} />
        {t("settings.providers.open", "Fournisseurs")}
      </Button>
      <Button size="sm" disabled={!canSave} onClick={handleSaveAll}>
        {saving ? <Spinner className="size-3.5" /> : <Save size={14} strokeWidth={1.75} />}
        {saving
          ? t("settings.split.saving", "Sauvegarde...")
          : t("settings.split.save")}
      </Button>
    </>
  );

  const getConfig = (
    type: PaymentProviderType
  ): PaymentMethodConfig | undefined =>
    configs.find((c) => c.providerType === type);

  if (loading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner className="size-10" />
      </div>
    );
  }

  const total = splitTotal();
  const isValidTotal = total === 100;

  return (
    <div>
      {headerActions}
      {/* Fournisseurs de paiement — dans une modale : c'est une configuration
          qu'on ouvre pour brancher un PSP, pas une lecture du quotidien. */}
      <Dialog open={providersOpen} onOpenChange={setProvidersOpen}>
        <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="flex-row items-center gap-[7.5px] pb-1 space-y-0">
          <div
            className="size-8 rounded-md inline-flex items-center justify-center shrink-0 text-primary bg-primary-soft border border-solid border-primary/20"
            aria-hidden="true"
          >
            <Payment size={16} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base font-semibold tracking-tight text-balance leading-[1.25]">
              {t("settings.providers.title", "Fournisseurs de paiement")}
            </DialogTitle>
            <DialogDescription className="text-xs leading-[1.35]">
              {t(
                "settings.providers.subtitle",
                "Activez ou désactivez les fournisseurs pour votre organisation."
              )}
            </DialogDescription>
          </div>
        </DialogHeader>
        {/* Les filets haut/bas remplacent le `dividers` de la modale MUI. */}
        <div className="border-y border-solid border-border py-3 max-h-[60vh] overflow-y-auto">
          {allProviders.map((type, index) => {
            const config = getConfig(type);
            const enabled = config?.enabled ?? false;
            const isStub = STUB_PROVIDERS.includes(type);
            const isConfigurable = CONFIGURABLE_PROVIDERS.includes(type);
            const isConfigured = isProviderConfigured(type, config);
            const brandColor =
              PROVIDER_COLORS[type] ?? "var(--bui-muted-foreground)";

            const statusChips = (
              <>
                {isStub && <StatusChip tone="neutral" label="Bientôt" />}
                {isConfigurable && !isConfigured && (
                  <StatusChip tone="warn" label="À configurer" />
                )}
                {enabled && !isStub && <StatusChip tone="ok" label="Actif" />}
                {config?.sandboxMode && isConfigured && (
                  <StatusChip tone="warn" label="Sandbox" />
                )}
              </>
            );

            // Pour PayTabs/CMI : icône "Configurer" cliquable a droite de la
            // ligne (rebascule sur le dialog). On la rend en endAdornment via
            // le slot iconButton du SettingsToggleRow… mais ce composant
            // n'expose pas ce slot. On va plutot wrapper la ligne dans un
            // Box avec un IconButton positionne en absolu.
            const configureButton = isConfigurable ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openConfigDialog(type);
                    }}
                    className={cn(
                      'ms-[3px] hover:text-primary hover:bg-primary-soft',
                      isConfigured ? 'text-muted-foreground' : 'text-warning',
                    )}
                  >
                    <SettingsIcon size={16} strokeWidth={1.75} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isConfigured ? "Reconfigurer" : "Configurer les credentials"}
                </TooltipContent>
              </Tooltip>
            ) : null;

            return (
              <div className="relative" key={type}>
                <SettingsToggleRow
                  icon={CreditCard}
                  iconColor={brandColor}
                  title={
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-sm font-semibold text-inherit">
                        {PAYMENT_PROVIDER_LABELS[type]}
                      </span>
                      {statusChips}
                    </div>
                  }
                  description={PROVIDER_REGIONS[type]}
                  checked={enabled}
                  onChange={() => handleToggle(type, enabled)}
                  disabled={isStub}
                  divider={index < allProviders.length - 1}
                />
                {configureButton && (
                  // right-[56px] : a gauche du Switch (qui fait ~36px + margin)
                  <div className="absolute top-1/2 right-[56px] -translate-y-1/2 pointer-events-auto">
                    {configureButton}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setProvidersOpen(false)}>
            {t("common.close", "Fermer")}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3">
        {/* Acompte de maintenance : reglage de PLATEFORME, donc reserve au
            staff. Sa place est ici, avec ce qui touche a l'argent. */}
        {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && <MaintenanceDepositSection />}

        {/* ─── Revenue Split ─── */}
        <SettingsSection
          title={t("settings.split.title")}
          icon={PieChart}
          accent="warm"
          help={t("settings.split.subtitle")}
        >
          {/* Rangee interne a la section, pas le niveau de navigation de la
              page : `trail={false}` l'empeche de polluer le fil d'Ariane. */}
          <PageTabs
            className="mb-[10.5px]"
            trail={false}
            value={splitTab}
            onChange={setSplitTab}
            options={[
              { value: 0, label: t("settings.split.tabChannels", "Canaux de distribution") },
              { value: 1, label: t("settings.split.tabServices", "Services & activités") },
            ]}
          />

          {splitTab === 0 ? (
            <RevenueSplitPanel
              rows={overviewRows}
              activeChannel={activeChannel}
              onSelectChannel={setSimulatedChannel}
              upstreamLabel={t("settings.split.channelFee", "Commission canal")}
              upstreamRate={simulatedFee}
              segments={splitSegments}
              onSegmentsChange={handleSegmentsChange}
              onToggleLock={toggleShareLock}
              inputs={[
                { key: "owner", label: t("settings.split.ownerShare"), value: ownerPct, onChange: setOwnerPct, color: SHARE_INK.owner },
                { key: "platform", label: t("settings.split.platformShare"), value: platformPct, onChange: setPlatformPct, color: SHARE_INK.platform },
                { key: "concierge", label: t("settings.split.conciergeShare"), value: conciergePct, onChange: setConciergePct, color: SHARE_INK.concierge },
              ]}
              total={total}
              isValidTotal={isValidTotal}
              shares={[
                { key: "owner", label: t("settings.split.ownerShare"), pct: parseFloat(ownerPct) || 0, primary: true },
                { key: "platform", label: t("settings.split.platformShare"), pct: parseFloat(platformPct) || 0 },
                { key: "concierge", label: t("settings.split.conciergeShare"), pct: parseFloat(conciergePct) || 0 },
              ]}
              footer={<BookingEngineRateRow row={overviewRows.find((r) => r.editable)} />}
              notice={
                <>
                  {contractedCount > 0 && (
                    <UiAlert variant="warning" className="mt-3">
                      <TriangleAlert />
                      <UiAlertDescription>
                      {t(
                        "settings.split.contractOverride",
                        "{{count}} logement(s) sous contrat de gestion ne suivent pas cette répartition : le propriétaire y reçoit le solde après le taux de son contrat, et la commission se partage 25 % plateforme / 75 % conciergerie.",
                        { count: contractedCount },
                      )}
                      </UiAlertDescription>
                    </UiAlert>
                  )}
                  {!splitConfig && (
                    <UiAlert variant="info" className="mt-3">
                      <Info />
                      <UiAlertDescription>{t("settings.split.defaults")}</UiAlertDescription>
                    </UiAlert>
                  )}
                </>
              }
            />
          ) : (
            <ServicesActivitiesPanel
              platformPct={monetization.upsellFee}
              onPlatformPctChange={monetization.setUpsellFee}
              orgPct={monetization.upsellOrgPct}
              onOrgPctChange={monetization.setUpsellOrgPct}
              renderInput={(input) => (
                <ShareInput
                  key={input.key}
                  label={input.label}
                  value={input.value}
                  onChange={input.onChange}
                  color={input.color}
                />
              )}
            />
          )}
        </SettingsSection>

      </div>

      <PaymentProviderConfigDialog
        open={configDialogOpen}
        providerType={configDialogProvider}
        currentConfig={
          configDialogProvider ? getConfig(configDialogProvider) ?? null : null
        }
        onClose={() => setConfigDialogOpen(false)}
        onSave={handleSaveProviderConfig}
      />

    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface ShareInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
}

const ShareInput: React.FC<ShareInputProps> = ({
  label,
  value,
  onChange,
  color,
}) => (
  <Field className="w-full">
    <FieldLabel htmlFor={`share-${label}`}>{label}</FieldLabel>
    <div className="relative">
      <Input
        id={`share-${label}`}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={0}
        max={100}
        step={0.01}
        className="tabular-nums font-semibold pe-6"
        // La teinte vient d'une valeur d'execution : une classe arbitraire ne
        // peut pas naitre a la compilation.
        style={{ color }}
      />
      <span className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-sm text-muted-foreground">
        %
      </span>
    </div>
  </Field>
);

// ─── Projection des reversements par canal ──────────────────────────────────

/**
 * Ecart, en points de pourcentage, a partir duquel le taux constate merite
 * d'etre signale. En deca, la difference vient des arrondis et des sejours
 * partiellement remontes ; au-dela, le taux de repli ne represente plus ce que
 * la plateforme facture vraiment.
 */
const RATE_DRIFT_THRESHOLD = 1;

/** Base de projection : ce que le voyageur verse avant tout prelevement. */
const PROJECTION_BASE = 100;

const formatMoney = (value: number) => value.toFixed(2).replace(".", ",");

/** Provenance du taux affiche — la distinction que l'ecran ne faisait pas. */
type RateProvenance = "REAL" | "ESTIMATED" | "NO_STAY";

function provenanceOf(row: ChannelCommissionOverview): RateProvenance {
  if (row.realFeeCount > 0) return "REAL";
  return row.stayCount > 0 ? "ESTIMATED" : "NO_STAY";
}

function ProvenanceChip({ row }: { row: ChannelCommissionOverview }) {
  const { t } = useTranslation();
  const provenance = provenanceOf(row);

  const meta: Record<RateProvenance, { label: string; tone: StatusTone }> = {
    REAL: {
      label: t("settings.commissions.provenance.real", "Facturé"),
      tone: "ok",
    },
    ESTIMATED: {
      label: t("settings.commissions.provenance.estimated", "Estimé"),
      tone: "warn",
    },
    NO_STAY: {
      label: t("settings.commissions.provenance.noStay", "Aucun séjour"),
      tone: "neutral",
    },
  };

  const tooltip: Record<RateProvenance, string> = {
    REAL: t(
      "settings.commissions.provenance.realHint",
      "{{count}} séjour(s) sur {{total}} ont remonté la commission réellement prélevée par la plateforme.",
      { count: row.realFeeCount, total: row.stayCount }
    ),
    ESTIMATED: t(
      "settings.commissions.provenance.estimatedHint",
      "Aucun séjour n'a remonté sa commission : le taux de référence est appliqué au calcul de marge."
    ),
    NO_STAY: t(
      "settings.commissions.provenance.noStayHint",
      "Aucun séjour sur ce canal ces 12 derniers mois."
    ),
  };

  const { label, tone } = meta[provenance];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* L'infobulle pose une ref sur son enfant, que StatusChip ne transmet
            pas (React 18, composant fonction) : sans ce span, elle ne s'ancre pas. */}
        <span className="inline-flex">
          <StatusChip
            size="sm"
            tone={tone}
            label={label}
            className="tracking-[0.01em]"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip[provenance]}</TooltipContent>
    </Tooltip>
  );
}

function ChannelCell({ row }: { row: ChannelCommissionOverview }) {
  const logo = channelLogo(row.channel);
  return (
    <div className="flex items-center gap-1.5">
      <div className="size-6 rounded-full inline-flex items-center justify-center shrink-0 border border-border bg-card overflow-hidden">
        {logo ? (
          <img className="size-3.5 object-contain" src={logo} alt="" aria-hidden />
        ) : (
          <Public size={12} strokeWidth={1.75} className="text-muted-foreground" />
        )}
      </div>
      <p className="text-sm font-semibold text-foreground whitespace-nowrap">
        {row.label}
      </p>
    </div>
  );
}

/** Une colonne de reversement du tableau de projection. */
interface ProjectionShare {
  key: string;
  label: string;
  pct: number;
  /** Colonne mise en avant (le beneficiaire principal de l'onglet). */
  primary?: boolean;
}

interface ChannelProjectionTableProps {
  rows: ChannelCommissionOverview[];
  /**
   * Beneficiaires du net, dans l'ordre d'affichage. Parametre plutot que fige :
   * la composition depend du contrat de gestion, et l'ordre des colonnes doit
   * suivre celui de la barre pour que les deux se lisent ensemble.
   */
  shares: ProjectionShare[];
  /** Canal simule dans la barre — mis en evidence pour raccrocher les deux vues. */
  activeChannel: string | null;
}

/**
 * Ce que devient 100 € encaisses, canal par canal : la commission part d'abord,
 * puis le net se partage selon la repartition en cours d'edition.
 *
 * <p>C'est le maillon que les deux sections separees masquaient — une barre
 * « 80 % proprietaire » se lit comme 80 € sur 100 € verses par le voyageur,
 * alors qu'il en reste 67,60 € apres la commission d'un canal a 15,5 %.</p>
 */
/** Montants projetes du tableau : meme taille et chiffres tabulaires partout. */
const PROJECTION_NUMBER_CLASS = "text-xs tabular-nums";

function ChannelProjectionTable({
  rows,
  shares,
  activeChannel,
}: ChannelProjectionTableProps) {
  const { t } = useTranslation();

  // Seuls les ecarts au gabarit du kit sont poses ici : la graisse 700 et la
  // capitale sont deja portees par `.cn-table-head`.
  const headCellClass =
    "text-2xs tracking-[0.06em] text-muted-foreground whitespace-nowrap";

  if (rows.length === 0) {
    return (
      <UiAlert variant="destructive">
        <TriangleAlert />
        <UiAlertDescription>
          {t(
            "settings.commissions.error",
            "Erreur lors du chargement des commissions"
          )}
        </UiAlertDescription>
      </UiAlert>
    );
  }

  return (
    <Table className="min-w-[560px]">
      <TableHeader>
        <TableRow>
          <TableHead className={headCellClass}>
            {t("settings.commissions.channel", "Canal")}
          </TableHead>
          <TableHead className={cn(headCellClass, "text-end")}>
            {t("settings.commissions.fee", "Commission")}
          </TableHead>
          <TableHead className={cn(headCellClass, "text-end")}>
            {t("settings.commissions.net", "Net")}
          </TableHead>
          {shares.map((share) => (
            <TableHead key={share.key} className={cn(headCellClass, "text-end")}>
              {share.label}
            </TableHead>
          ))}
          <TableHead className={headCellClass}>
            {t("settings.commissions.source", "Source")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const rate = effectiveRate(row);
          const fee = (PROJECTION_BASE * rate) / 100;
          const net = PROJECTION_BASE - fee;
          const drifts =
            row.observedRate !== null &&
            Math.abs(row.observedRate - row.referenceRate) >=
              RATE_DRIFT_THRESHOLD;
          return (
            <TableRow
              key={row.channel}
              className={
                row.channel === activeChannel ? "bg-primary-soft/50" : undefined
              }
            >
              <TableCell>
                <ChannelCell row={row} />
              </TableCell>
              <TableCell className="text-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                  <span
                    className={cn(
                      PROJECTION_NUMBER_CLASS,
                      fee > 0 ? "text-destructive-ink" : "text-faint",
                      // Propriete arbitraire plutot que border-b + border-dotted :
                      // sans preflight, border-dotted poserait un style pointille
                      // sur les quatre cotes, a la largeur `medium` par defaut.
                      drifts
                        ? "[border-bottom:1px_dotted_var(--bui-warning)] cursor-help"
                        : "cursor-default",
                    )}
                  >
                    {fee > 0 ? `−${formatMoney(fee)}` : formatMoney(0)}
                  </span>
                  </TooltipTrigger>
                  {/* Pas d'infobulle quand il n'y a pas d'ecart : elle serait vide. */}
                  {drifts && (
                    <TooltipContent>
                      {t(
                        "settings.commissions.driftHint",
                        "Écart avec le taux appliqué : les marges calculées sur les séjours sans commission remontée sont décalées d’autant."
                      )}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TableCell>
              <TableCell className="text-end">
                <p className={cn(PROJECTION_NUMBER_CLASS, "text-muted-foreground")}>
                  {formatMoney(net)}
                </p>
              </TableCell>
              {shares.map((share) => (
                <TableCell key={share.key} className="text-end">
                  <p
                    className={cn(
                      PROJECTION_NUMBER_CLASS,
                      share.primary
                        ? "font-bold text-foreground"
                        : "font-normal text-muted-foreground",
                    )}
                  >
                    {formatMoney((net * share.pct) / 100)}
                  </p>
                </TableCell>
              ))}
              <TableCell>
                <ProvenanceChip row={row} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}


interface SplitPanelInput {
  key: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
}

interface RevenueSplitPanelProps {
  /** Canaux de distribution de l'organisation. */
  rows: ChannelCommissionOverview[];
  activeChannel: string | null;
  onSelectChannel: (channel: string) => void;
  /** Libelle du segment preleve en amont (commission canal / part plateforme). */
  upstreamLabel: string;
  upstreamRate: number;
  segments: SplitBarSegment[];
  onSegmentsChange: (segments: SplitBarSegment[]) => void;
  onToggleLock: (key: string) => void;
  inputs: SplitPanelInput[];
  total: number;
  isValidTotal: boolean;
  /** Colonnes de reversement du tableau de projection. */
  shares: ProjectionShare[];
  /** Bloc optionnel sous le tableau (ex. taux du booking engine). */
  footer?: React.ReactNode;
  /** Message optionnel entre le total et le detail (ex. « valeurs par defaut »). */
  notice?: React.ReactNode;
}

/**
 * Panneau de repartition d'un onglet : simulation par canal, barre editable,
 * champs, total et projection.
 *
 * <p>Reserve aux canaux de distribution. L'onglet « Services & activites » ne
 * reutilise pas ce panneau : les activites passent par affiliation, aucun
 * montant ne transite par Baitly, donc il n'y a ni commission prelevee ni
 * repartition a projeter — le meme rendu y simulerait un partage inexistant.</p>
 */
function RevenueSplitPanel({
  rows,
  activeChannel,
  onSelectChannel,
  upstreamLabel,
  upstreamRate,
  segments,
  onSegmentsChange,
  onToggleLock,
  inputs,
  total,
  isValidTotal,
  shares,
  footer,
  notice,
}: RevenueSplitPanelProps) {
  const { t } = useTranslation();

  return (
    <>
          {/* Etage 1 — ce que le canal preleve avant tout partage. */}
          <div className="flex items-center gap-1 flex-wrap mb-2">
            <p className="text-xs text-muted-foreground font-medium me-0.5">
              {t("settings.split.simulateOn", "Simuler sur")}
            </p>
            {rows.map((row) => (
              // `font: inherit` du sx est rendu par famille + interlignage herites,
              // la taille et la graisse etant de toute facon redefinies juste apres.
              <button
                key={row.channel}
                type="button"
                onClick={() => onSelectChannel(row.channel)}
                aria-pressed={activeChannel === row.channel}
                className={cn(
                  "[font-family:inherit] leading-[inherit] text-xs px-1.5 py-[2.25px] rounded-md cursor-pointer border border-solid",
                  "transition-[border-color,color] duration-150 ease-out-quart motion-reduce:transition-none",
                  "hover:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
                  activeChannel === row.channel
                    ? "font-semibold border-primary/45 bg-primary-soft text-primary"
                    : "font-medium border-border bg-transparent text-muted-foreground",
                )}
              >
                {row.label}
              </button>
            ))}
          </div>

          {/* Etage 2 — partage du net, ajustable a la souris. */}
          <div className="mb-3">
            <SplitBarEditor
              segments={segments}
              onChange={onSegmentsChange}
              onToggleLock={onToggleLock}
              upstream={
                upstreamRate > 0
                  ? {
                      label: upstreamLabel,
                      value: upstreamRate,
                    }
                  : undefined
              }
            />
          </div>

          {/* Champs de saisie — memes reglages que la barre, valeur exacte. */}
          <div className="flex flex-col min-[600px]:flex-row gap-[7.5px] mb-[9px]">
            {inputs.map((input) => (
              <ShareInput
                key={input.key}
                label={input.label}
                value={input.value}
                onChange={input.onChange}
                color={input.color}
              />
            ))}
          </div>

          {/* Total — l'enregistrement vit dans le header de la page. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs text-muted-foreground font-medium">
              Total
            </p>
            <StatusChip
              tone={isValidTotal ? "ok" : "err"}
              label={`${total}%`}
              className="tabular-nums"
            />
            {!isValidTotal && (
              <p className="text-xs text-destructive-ink font-medium">
                {t("settings.split.totalError")}
              </p>
            )}
          </div>

          {notice}

          {/* Detail par canal — toujours visible : c'est ce tableau qui relie
              la commission du canal au reversement reel, l'information que les
              deux sections separees masquaient. */}
          <div className="mt-2.5 border-t border-border pt-2">
            <p className="text-sm font-semibold tracking-tight text-muted-foreground">
              {t("settings.split.detailTitle", "Détail par canal")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-0.5 leading-[1.5]">
              {t(
                "settings.split.projectionHint",
                "Projection sur 100 € encaissés, à répartition constante. Ce n’est pas un relevé de reversements."
              )}
            </p>
            <ChannelProjectionTable
              rows={rows}
              shares={shares}
              activeChannel={activeChannel}
            />
            {footer}
          </div>
    </>
  );
}

/**
 * Taux du booking engine — le seul que l'hote fixe lui-meme, les commissions
 * OTA etant imposees par la plateforme. Sorti du tableau : une cellule
 * editable au milieu de montants projetes se lit comme un montant modifiable.
 */
function BookingEngineRateRow({
  row,
}: {
  row: ChannelCommissionOverview | undefined;
}) {
  const { t } = useTranslation();
  const saveMutation = useSaveCommission();
  const [rate, setRate] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!row) return null;
  const value = rate ?? String(row.referenceRate);

  const handleSave = async () => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return;
    await saveMutation.mutateAsync({
      channel: row.channel.toUpperCase(),
      data: { channelName: row.channel.toUpperCase(), commissionRate: parsed },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex items-center gap-1.5 mt-[7.5px] pt-[7.5px] border-t border-dashed border-border flex-wrap">
      <p className="text-xs text-muted-foreground font-medium">
        {t("settings.commissions.bookingEngineRate", "Taux du booking engine")}
      </p>
      <div className="relative inline-block w-[110px]">
        <Input
          type="number"
          value={value}
          onChange={(e) => setRate(e.target.value)}
          min={0}
          max={100}
          step={0.5}
          aria-label={t(
            "settings.commissions.bookingEngineRate",
            "Taux du booking engine"
          )}
          className="text-center text-sm font-semibold tabular-nums pe-6"
        />
        <span className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-sm text-muted-foreground">
          %
        </span>
      </div>
      {saved ? (
        <StatusChip tone="ok" label={t("common.saved", "Sauvegardé")} />
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                aria-label={t("common.save", "Enregistrer")}
                className="size-7 rounded-md border border-solid border-border text-muted-foreground transition-[border-color,background-color,color] duration-150 ease-out-quart motion-reduce:transition-none hover:text-primary hover:border-primary/40 hover:bg-primary-soft"
              >
                <Save size={13} strokeWidth={1.75} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("common.save", "Enregistrer")}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// ─── Monétisation livret (upsells + commissions activités) ──────────────────

/**
 * Etat du formulaire « Commission plateforme », remonte hors de la section pour
 * que l'enregistrement unique du header puisse le lire et le soumettre.
 */
/**
 * Etat du formulaire de monetisation, remonte hors des sections pour que
 * l'enregistrement unique du header puisse le lire et le soumettre.
 *
 * <p>Porte les quatre taux : la part PLATEFORME (staff-only, prelevee en
 * premier) et la part ORG/conciergerie, calculee sur ce qui reste apres la
 * plateforme — la meme cascade que cote canaux de distribution.</p>
 */
export interface MonetizationForm {
  upsellFee: string;
  setUpsellFee: (v: string) => void;
  upsellOrgPct: string;
  setUpsellOrgPct: (v: string) => void;
  loading: boolean;
  isDirty: boolean;
  save: () => Promise<void>;
}

interface MonetizationSnapshot {
  upsellFee: string;
  upsellOrgPct: string;
}

const EMPTY_SNAPSHOT: MonetizationSnapshot = {
  upsellFee: "",
  upsellOrgPct: "",
};

function useMonetizationForm(): MonetizationForm {
  const [form, setForm] = useState<MonetizationSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  // Dernier etat connu du serveur — sert de reference pour savoir s'il reste
  // quelque chose a enregistrer, le bouton n'etant plus a cote des champs.
  const [saved, setSaved] = useState<MonetizationSnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    let active = true;
    monetizationConfigApi
      .get()
      .then((c) => {
        if (!active) return;
        const next: MonetizationSnapshot = {
          upsellFee: String(c.upsellPlatformFeePct ?? ""),
          upsellOrgPct: String(c.upsellOrgCommissionPct ?? ""),
        };
        setForm(next);
        setSaved(next);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const patch = useCallback(
    (key: keyof MonetizationSnapshot) => (value: string) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const save = useCallback(async () => {
    const num = (v: string) => parseFloat(v) || 0;
    // Deux endpoints distincts : la part plateforme est staff-only, la part
    // conciergerie est editable par l'org. On n'appelle que ce qui a change.
    let latest = null;
    if (form.upsellFee !== saved.upsellFee) {
      latest = await monetizationConfigApi.updatePlatform({
        upsellPlatformFeePct: num(form.upsellFee),
      });
    }
    if (form.upsellOrgPct !== saved.upsellOrgPct) {
      latest = await monetizationConfigApi.updateOrg({
        upsellOrgCommissionPct: num(form.upsellOrgPct),
      });
    }
    if (latest) {
      const next: MonetizationSnapshot = {
        upsellFee: String(latest.upsellPlatformFeePct),
        upsellOrgPct: String(latest.upsellOrgCommissionPct),
      };
      setForm(next);
      setSaved(next);
    }
  }, [form, saved]);

  return {
    upsellFee: form.upsellFee,
    setUpsellFee: patch("upsellFee"),
    upsellOrgPct: form.upsellOrgPct,
    setUpsellOrgPct: patch("upsellOrgPct"),
    loading,
    isDirty:
      form.upsellFee !== saved.upsellFee ||
      form.upsellOrgPct !== saved.upsellOrgPct,
    save,
  };
}
