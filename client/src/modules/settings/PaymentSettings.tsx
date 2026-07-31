import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  TextField,
  Button,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
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

const STATUS_CHIP_SX = {
  height: 20,
  fontSize: "0.65rem",
  fontWeight: 600,
  letterSpacing: "0.02em",
  borderRadius: "5px",
  "& .MuiChip-label": { px: 0.75 },
} as const;

function buildStatusChipSx(color: string) {
  return {
    ...STATUS_CHIP_SX,
    backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
    color,
    border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
  } as const;
}

// ─── Share colors (palette Baitly) ──────────────────────────────────────────

const SHARE_OWNER = "var(--ok)";
const SHARE_PLATFORM = "var(--accent)";
const SHARE_CONCIERGE = "var(--warn)";

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
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<PaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });
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
      color: SHARE_OWNER,
      locked: lockedShares.owner,
    },
    {
      key: "platform",
      label: t("settings.split.platformShare"),
      value: parseFloat(platformPct) || 0,
      color: SHARE_PLATFORM,
      locked: lockedShares.platform,
    },
    {
      key: "concierge",
      label: t("settings.split.conciergeShare"),
      value: parseFloat(conciergePct) || 0,
      color: SHARE_CONCIERGE,
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
      setSnackbar({
        open: true,
        message: `${PAYMENT_PROVIDER_LABELS[providerType]} ${
          !currentEnabled ? "activé" : "désactivé"
        }`,
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Erreur lors de la mise à jour",
        severity: "error",
      });
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
    setSnackbar({
      open: true,
      message: `${PAYMENT_PROVIDER_LABELS[configDialogProvider]} configuré`,
      severity: "success",
    });
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
      setSnackbar({
        open: true,
        message: t("settings.split.totalError"),
        severity: "error",
      });
      return;
    }
    setSaving(true);
    try {
      if (isSplitDirty) await saveSplit();
      if (monetization.isDirty) await monetization.save();
      setSnackbar({
        open: true,
        message: t("settings.split.saved"),
        severity: "success",
      });
    } catch {
      setSnackbar({
        open: true,
        message: t("settings.split.error"),
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const headerActions = useSettingsHeaderActions(
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<CreditCard size={14} strokeWidth={1.75} />}
        onClick={() => setProvidersOpen(true)}
      >
        {t("settings.providers.open", "Fournisseurs")}
      </Button>
      <Button
        variant="contained"
        disableElevation
        size="small"
        startIcon={
          saving ? (
            <CircularProgress size={14} color="inherit" />
          ) : (
            <Save size={14} strokeWidth={1.75} />
          )
        }
        disabled={!canSave}
        onClick={handleSaveAll}
      >
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
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  const total = splitTotal();
  const isValidTotal = total === 100;

  return (
    <div>
      {headerActions}
      {/* Fournisseurs de paiement — dans une modale : c'est une configuration
          qu'on ouvre pour brancher un PSP, pas une lecture du quotidien. */}
      <Dialog
        open={providersOpen}
        onClose={() => setProvidersOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="payment-providers-title"
      >
        <DialogTitle
          id="payment-providers-title"
          sx={{ display: "flex", alignItems: "center", gap: 1.25, pb: 1 }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "8px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "color-mix(in srgb, var(--accent) 8%, transparent)",
              color: "var(--accent)",
              border:
                "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <Payment size={16} strokeWidth={1.75} />
          </Box>
          <div className="min-w-0">
            <p className="cn-text-body1 text-[0.95rem] font-semibold leading-[1.25]">
              {t("settings.providers.title", "Fournisseurs de paiement")}
            </p>
            <p className="cn-text-body1 text-[0.72rem] text-muted-foreground leading-[1.35]">
              {t(
                "settings.providers.subtitle",
                "Activez ou désactivez les fournisseurs pour votre organisation."
              )}
            </p>
          </div>
        </DialogTitle>
        <DialogContent dividers>
          {allProviders.map((type, index) => {
            const config = getConfig(type);
            const enabled = config?.enabled ?? false;
            const isStub = STUB_PROVIDERS.includes(type);
            const isConfigurable = CONFIGURABLE_PROVIDERS.includes(type);
            const isConfigured = isProviderConfigured(type, config);
            const brandColor = PROVIDER_COLORS[type] ?? "var(--muted)";

            const statusChips = (
              <>
                {isStub && (
                  <Chip
                    label="Bientôt"
                    size="small"
                    sx={buildStatusChipSx("var(--muted)")}
                  />
                )}
                {isConfigurable && !isConfigured && (
                  <Chip
                    label="À configurer"
                    size="small"
                    sx={buildStatusChipSx("var(--warn)")}
                  />
                )}
                {enabled && !isStub && (
                  <Chip
                    label="Actif"
                    size="small"
                    sx={buildStatusChipSx("var(--ok)")}
                  />
                )}
                {config?.sandboxMode && isConfigured && (
                  <Chip
                    label="Sandbox"
                    size="small"
                    sx={buildStatusChipSx("var(--warn)")}
                  />
                )}
              </>
            );

            // Pour PayTabs/CMI : icône "Configurer" cliquable a droite de la
            // ligne (rebascule sur le dialog). On la rend en endAdornment via
            // le slot iconButton du SettingsToggleRow… mais ce composant
            // n'expose pas ce slot. On va plutot wrapper la ligne dans un
            // Box avec un IconButton positionne en absolu.
            const configureButton = isConfigurable ? (
              <Tooltip
                title={
                  isConfigured ? "Reconfigurer" : "Configurer les credentials"
                }
                arrow
              >
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    openConfigDialog(type);
                  }}
                  sx={{
                    ml: 0.5,
                    color: isConfigured ? "text.secondary" : "var(--warn)",
                    "&:hover": {
                      color: "var(--accent)",
                      backgroundColor: "var(--accent-soft)",
                    },
                  }}
                >
                  <SettingsIcon size={16} strokeWidth={1.75} />
                </IconButton>
              </Tooltip>
            ) : null;

            return (
              <div className="relative" key={type}>
                <SettingsToggleRow
                  icon={CreditCard}
                  iconColor={brandColor}
                  title={
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[0.8125rem] font-semibold text-inherit">
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
                  <Box
                    sx={{
                      position: "absolute",
                      top: "50%",
                      right: 56, // a gauche du Switch (qui fait ~36px + margin)
                      transform: "translateY(-50%)",
                      pointerEvents: "auto",
                    }}
                  >
                    {configureButton}
                  </Box>
                )}
              </div>
            );
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProvidersOpen(false)} size="small">
            {t("common.close", "Fermer")}
          </Button>
        </DialogActions>
      </Dialog>

      <div className="flex flex-col gap-3">
        {/* ─── Revenue Split ─── */}
        <SettingsSection
          title={t("settings.split.title")}
          icon={PieChart}
          accent="warm"
          help={t("settings.split.subtitle")}
        >
          <Tabs
            value={splitTab}
            onChange={(_, v) => setSplitTab(v)}
            variant="scrollable"
            scrollButtons={false}
            sx={{
              minHeight: 34,
              mb: 1.75,
              borderBottom: "1px solid",
              borderColor: "divider",
              "& .MuiTab-root": {
                minHeight: 34,
                py: 0,
                px: 1.25,
                fontSize: "0.78rem",
                fontWeight: 600,
                textTransform: "none",
                color: "text.secondary",
                "&.Mui-selected": { color: "var(--accent)" },
              },
              "& .MuiTabs-indicator": { backgroundColor: "var(--accent)", height: 2 },
            }}
          >
            <Tab label={t("settings.split.tabChannels", "Canaux de distribution")} />
            <Tab label={t("settings.split.tabServices", "Services & activités")} />
          </Tabs>

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
                { key: "owner", label: t("settings.split.ownerShare"), value: ownerPct, onChange: setOwnerPct, color: SHARE_OWNER },
                { key: "platform", label: t("settings.split.platformShare"), value: platformPct, onChange: setPlatformPct, color: SHARE_PLATFORM },
                { key: "concierge", label: t("settings.split.conciergeShare"), value: conciergePct, onChange: setConciergePct, color: SHARE_CONCIERGE },
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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ borderRadius: "8px" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
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
  <TextField
    label={label}
    type="number"
    size="small"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    InputProps={{
      endAdornment: <InputAdornment position="end">%</InputAdornment>,
      inputProps: { min: 0, max: 100, step: 0.01 },
      sx: {
        "& input": {
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
          color,
        },
      },
    }}
    fullWidth
  />
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

  const meta: Record<
    RateProvenance,
    { label: string; color: string; soft: string }
  > = {
    REAL: {
      label: t("settings.commissions.provenance.real", "Facturé"),
      color: "var(--ok)",
      soft: "var(--ok-soft)",
    },
    ESTIMATED: {
      label: t("settings.commissions.provenance.estimated", "Estimé"),
      color: "var(--warn)",
      soft: "var(--warn-soft)",
    },
    NO_STAY: {
      label: t("settings.commissions.provenance.noStay", "Aucun séjour"),
      color: "var(--muted)",
      soft: "color-mix(in srgb, var(--muted) 8%, transparent)",
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

  const { label, color, soft } = meta[provenance];

  return (
    <Tooltip title={tooltip[provenance]}>
      <Chip
        label={label}
        size="small"
        sx={{
          height: 20,
          fontSize: "0.65rem",
          fontWeight: 600,
          letterSpacing: "0.01em",
          backgroundColor: soft,
          color,
          border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
          borderRadius: "6px",
          "& .MuiChip-label": { px: 0.75 },
        }}
      />
    </Tooltip>
  );
}

function ChannelCell({ row }: { row: ChannelCommissionOverview }) {
  const logo = channelLogo(row.channel);
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-[24px] h-[24px] rounded-[50%] inline-flex items-center justify-center shrink-0 border border-[divider] bg-[background.paper] overflow-hidden">
        {logo ? (
          <img className="w-[14px] h-[14px] object-contain" src={logo} alt="" aria-hidden />
        ) : (
          <Public size={12} strokeWidth={1.75} color="var(--muted)" />
        )}
      </div>
      <p className="cn-text-body1 text-[0.8125rem] font-semibold text-foreground whitespace-nowrap">
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
function ChannelProjectionTable({
  rows,
  shares,
  activeChannel,
}: ChannelProjectionTableProps) {
  const { t } = useTranslation();

  const headCellSx = {
    fontWeight: 700,
    fontSize: "0.62rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "text.secondary",
    whiteSpace: "nowrap" as const,
  };

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
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 560 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={headCellSx}>
              {t("settings.commissions.channel", "Canal")}
            </TableCell>
            <TableCell align="right" sx={headCellSx}>
              {t("settings.commissions.fee", "Commission")}
            </TableCell>
            <TableCell align="right" sx={headCellSx}>
              {t("settings.commissions.net", "Net")}
            </TableCell>
            {shares.map((share) => (
              <TableCell key={share.key} align="right" sx={headCellSx}>
                {share.label}
              </TableCell>
            ))}
            <TableCell sx={headCellSx}>
              {t("settings.commissions.source", "Source")}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const rate = effectiveRate(row);
            const fee = (PROJECTION_BASE * rate) / 100;
            const net = PROJECTION_BASE - fee;
            const drifts =
              row.observedRate !== null &&
              Math.abs(row.observedRate - row.referenceRate) >=
                RATE_DRIFT_THRESHOLD;
            const numberSx = {
              fontSize: "0.78rem",
              fontVariantNumeric: "tabular-nums" as const,
            };
            return (
              <TableRow
                key={row.channel}
                hover
                sx={
                  row.channel === activeChannel
                    ? {
                        bgcolor:
                          "color-mix(in srgb, var(--accent) 6%, transparent)",
                      }
                    : undefined
                }
              >
                <TableCell>
                  <ChannelCell row={row} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip
                    title={
                      drifts
                        ? t(
                            "settings.commissions.driftHint",
                            "Écart avec le taux appliqué : les marges calculées sur les séjours sans commission remontée sont décalées d’autant."
                          )
                        : ""
                    }
                  >
                    <Typography
                      component="span"
                      sx={{
                        ...numberSx,
                        color: fee > 0 ? "var(--err)" : "text.disabled",
                        borderBottom: drifts
                          ? "1px dotted var(--warn)"
                          : "none",
                        cursor: drifts ? "help" : "default",
                      }}
                    >
                      {fee > 0 ? `−${formatMoney(fee)}` : formatMoney(0)}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">
                  <Typography sx={{ ...numberSx, color: "text.secondary" }}>
                    {formatMoney(net)}
                  </Typography>
                </TableCell>
                {shares.map((share) => (
                  <TableCell key={share.key} align="right">
                    <Typography
                      sx={{
                        ...numberSx,
                        fontWeight: share.primary ? 700 : 400,
                        color: share.primary ? "text.primary" : "text.secondary",
                      }}
                    >
                      {formatMoney((net * share.pct) / 100)}
                    </Typography>
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
    </TableContainer>
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
            <p className="cn-text-body1 text-[0.72rem] text-muted-foreground font-medium me-0.5">
              {t("settings.split.simulateOn", "Simuler sur")}
            </p>
            {rows.map((row) => (
              <Box
                key={row.channel}
                component="button"
                type="button"
                onClick={() => onSelectChannel(row.channel)}
                aria-pressed={activeChannel === row.channel}
                sx={{
                  font: "inherit",
                  fontSize: "0.72rem",
                  fontWeight: activeChannel === row.channel ? 600 : 500,
                  px: 1,
                  py: 0.375,
                  borderRadius: "7px",
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor:
                    activeChannel === row.channel
                      ? "color-mix(in srgb, var(--accent) 45%, transparent)"
                      : "divider",
                  bgcolor:
                    activeChannel === row.channel
                      ? "var(--accent-soft)"
                      : "transparent",
                  color:
                    activeChannel === row.channel
                      ? "var(--accent)"
                      : "text.secondary",
                  transition:
                    "border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)",
                  "&:hover": { color: "var(--accent)" },
                  "&:focus-visible": {
                    outline: "2px solid var(--accent)",
                    outlineOffset: 2,
                  },
                }}
              >
                {row.label}
              </Box>
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
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.25}
            sx={{ mb: 1.5 }}
          >
            {inputs.map((input) => (
              <ShareInput
                key={input.key}
                label={input.label}
                value={input.value}
                onChange={input.onChange}
                color={input.color}
              />
            ))}
          </Stack>

          {/* Total — l'enregistrement vit dans le header de la page. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="cn-text-body1 text-[0.78rem] text-muted-foreground font-medium">
              Total
            </p>
            <Chip
              label={`${total}%`}
              size="small"
              sx={buildStatusChipSx(isValidTotal ? "var(--ok)" : "var(--err)")}
            />
            {!isValidTotal && (
              <p className="cn-text-body1 text-[0.72rem] text-[var(--err)] font-medium">
                {t("settings.split.totalError")}
              </p>
            )}
          </div>

          {notice}

          {/* Detail par canal — toujours visible : c'est ce tableau qui relie
              la commission du canal au reversement reel, l'information que les
              deux sections separees masquaient. */}
          <div className="mt-2.5 border-t border-[divider] pt-2">
            <p className="cn-text-body1 text-[0.75rem] font-semibold text-muted-foreground">
              {t("settings.split.detailTitle", "Détail par canal")}
            </p>
            <p className="cn-text-body1 text-[0.72rem] text-muted-foreground mt-0.5 mb-0.5 leading-[1.5]">
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
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        mt: 1.25,
        pt: 1.25,
        borderTop: "1px dashed",
        borderColor: "divider",
        flexWrap: "wrap",
      }}
    >
      <p className="cn-text-body1 text-[0.75rem] text-muted-foreground font-medium">
        {t("settings.commissions.bookingEngineRate", "Taux du booking engine")}
      </p>
      <TextField
        type="number"
        size="small"
        value={value}
        onChange={(e) => setRate(e.target.value)}
        inputProps={{
          min: 0,
          max: 100,
          step: 0.5,
          "aria-label": t(
            "settings.commissions.bookingEngineRate",
            "Taux du booking engine"
          ),
          style: {
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          },
        }}
        InputProps={{
          endAdornment: <InputAdornment position="end">%</InputAdornment>,
          sx: { fontSize: "0.8125rem" },
        }}
        sx={{ width: 110 }}
      />
      {saved ? (
        <Chip
          label={t("common.saved", "Sauvegardé")}
          size="small"
          sx={buildStatusChipSx("var(--ok)")}
        />
      ) : (
        <Tooltip title={t("common.save", "Enregistrer")}>
          <IconButton
            size="small"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            aria-label={t("common.save", "Enregistrer")}
            sx={{
              width: 28,
              height: 28,
              borderRadius: "7px",
              color: "text.secondary",
              border: "1px solid",
              borderColor: "divider",
              transition:
                "border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)",
              "&:hover": {
                color: "var(--accent)",
                borderColor:
                  "color-mix(in srgb, var(--accent) 40%, transparent)",
                backgroundColor: "var(--accent-soft)",
              },
              "&:focus-visible": {
                outline: "2px solid var(--accent)",
                outlineOffset: 2,
              },
            }}
          >
            <Save size={13} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
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
