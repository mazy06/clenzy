import React, { useEffect, useState } from "react";
import { Spinner } from '../../../components/ui';
import StatusChip from '../../../components/StatusChip';
import {
  Alert,
  Box,
  Stack,
  CircularProgress,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Save, Upload } from "../../../icons";
import SplitBarEditor from "./SplitBarEditor";
import AffiliateImportDialog from "./AffiliateImportDialog";
import type { SplitBarSegment } from "./SplitBarEditor";
import { activitiesApi } from "../../../services/api/activitiesApi";
import type {
  ActivityConfig,
  ActivityProvider,
} from "../../../services/api/activitiesApi";
import { useTranslation } from "../../../hooks/useTranslation";

const SHARE_OWNER = "var(--ok)";
const SHARE_PLATFORM = "var(--accent)";
const SHARE_CONCIERGE = "var(--warn)";

/**
 * Sources listees en dur, et non deduites des configs : une marketplace absente
 * de la reponse est une marketplace <b>non connectee</b>, pas une marketplace
 * inexistante. Ne montrer que les configurees cachait justement celles qu'il
 * reste a brancher.
 */
const PROVIDERS = ["VIATOR", "GETYOURGUIDE", "KLOOK"] as const;

const PROVIDER_LABELS: Record<string, string> = {
  VIATOR: "Viator",
  GETYOURGUIDE: "GetYourGuide",
  KLOOK: "Klook",
};

type ProviderStatus = "ACTIVE" | "INACTIVE" | "UNCONFIGURED";

const STATUS_META: Record<
  ProviderStatus,
  { key: string; fallback: string; color: string; soft: string }
> = {
  ACTIVE: {
    key: "settings.services.active",
    fallback: "Actif",
    color: "var(--ok)",
    soft: "var(--ok-soft)",
  },
  INACTIVE: {
    key: "settings.services.inactive",
    fallback: "Inactif",
    color: "var(--warn)",
    soft: "var(--warn-soft)",
  },
  UNCONFIGURED: {
    key: "settings.services.unconfigured",
    fallback: "Non configuré",
    color: "var(--muted)",
    soft: "color-mix(in srgb, var(--muted) 8%, transparent)",
  },
};

const headCellSx = {
  fontWeight: 700,
  fontSize: "0.62rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "text.secondary",
  whiteSpace: "nowrap" as const,
};

export interface ServicesActivitiesPanelProps {
  /** Part plateforme sur les upsells, en % du montant paye par le voyageur. */
  platformPct: string;
  onPlatformPctChange: (v: string) => void;
  /** Part conciergerie, en % du RESTE apres la part plateforme. */
  orgPct: string;
  onOrgPctChange: (v: string) => void;
  renderInput: (input: {
    key: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    color: string;
  }) => React.ReactNode;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

const formatMoney = (value: number) => value.toFixed(2).replace(".", ",");

/**
 * Onglet « Services & activites ».
 *
 * <p>Deux blocs de nature differente, et c'est le fond du sujet : les upsells
 * font transiter de l'argent par Baitly (Stripe puis ledger), les activites
 * non. Les presenter tous deux comme une repartition laisserait croire a un
 * partage qui n'existe pas cote activites.</p>
 */
export default function ServicesActivitiesPanel({
  platformPct,
  onPlatformPctChange,
  orgPct,
  onOrgPctChange,
  renderInput,
}: ServicesActivitiesPanelProps) {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<ActivityConfig[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [importProvider, setImportProvider] = useState<ActivityProvider | null>(null);

  useEffect(() => {
    let active = true;
    activitiesApi
      .listConfigs()
      .then((rows) => {
        if (!active) return;
        setConfigs(rows);
        setRates(
          Object.fromEntries(
            rows.map((r) => [r.provider, String(r.platformCommissionPct ?? "")]),
          ),
        );
      })
      .catch(() => {
        // Echec de lecture : les sources restent listees en « non configure »,
        // ce qui reste vrai du point de vue de l'utilisateur.
      });
    return () => {
      active = false;
    };
  }, []);

  const byProvider = new Map(configs.map((c) => [c.provider, c]));

  /**
   * Enregistre la part Baitly d'un programme. Les autres champs sont renvoyes
   * tels quels : l'upsert ecrase la ligne entiere, et une cle vide y conserve
   * la cle existante (cf. ActivityService.upsertConfig).
   */
  /** Taux saisi pour ce programme, 0 si vide — la projection reste juste. */
  const platformRate = (provider: string) => {
    const parsed = parseFloat(rates[provider] ?? "");
    return isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), 100);
  };

  const saveRate = async (provider: string) => {
    const raw = rates[provider] ?? "";
    const parsed = raw.trim() === "" ? null : parseFloat(raw);
    if (parsed !== null && (isNaN(parsed) || parsed < 0 || parsed > 100)) return;
    const existing = byProvider.get(provider);
    setSavingProvider(provider);
    try {
      const saved = await activitiesApi.upsertConfig(provider as ActivityProvider, {
        affiliateId: existing?.affiliateId ?? null,
        enabled: existing?.enabled ?? false,
        platformCommissionPct: parsed,
      });
      setConfigs((prev) => {
        const others = prev.filter((c) => c.provider !== provider);
        return [...others, saved];
      });
    } finally {
      setSavingProvider(null);
    }
  };

  // Conversion vers des parts du TOTAL : la part conciergerie est stockee en
  // pourcentage du reste apres plateforme (cf. UpsellService), l'afficher telle
  // quelle dans une barre a 100 % la surevaluerait.
  const platform = round1(parseFloat(platformPct) || 0);
  const orgOfRemainder = round1(parseFloat(orgPct) || 0);
  const remainder = 100 - platform;
  const concierge = round1((remainder * orgOfRemainder) / 100);
  const owner = round1(remainder - concierge);

  const segments: SplitBarSegment[] = [
    {
      key: "platform",
      label: t("settings.split.platformShare"),
      value: platform,
      color: SHARE_PLATFORM,
    },
    {
      key: "concierge",
      label: t("settings.split.conciergeShare"),
      value: concierge,
      color: SHARE_CONCIERGE,
    },
    {
      key: "owner",
      label: t("settings.split.ownerShare"),
      value: owner,
      color: SHARE_OWNER,
    },
  ];

  const handleSegmentsChange = (next: SplitBarSegment[]) => {
    const nextPlatform = next.find((s) => s.key === "platform")?.value ?? platform;
    const nextConcierge = next.find((s) => s.key === "concierge")?.value ?? concierge;
    const nextRemainder = 100 - nextPlatform;
    onPlatformPctChange(String(round1(nextPlatform)));
    // Retour vers un pourcentage du reste, l'unite reellement persistee.
    onOrgPctChange(
      String(nextRemainder > 0 ? round1((nextConcierge * 100) / nextRemainder) : 0),
    );
  };

  return (
    <>
      <p className="cn-text-body1 text-[0.75rem] font-semibold text-muted-foreground mb-1.5">
        {t("settings.services.upsellTitle", "Upsells — services vendus au voyageur")}
      </p>

      <div className="mb-3">
        {/* Pas de verrous ici : trois parts pilotees par deux taux seulement,
            dont un relatif au net. Figer une part ne pourrait pas etre honore
            sans bloquer la conversion — le cadenas mentirait. */}
        <SplitBarEditor segments={segments} onChange={handleSegmentsChange} />
      </div>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mb: 1.5 }}>
        {renderInput({
          key: "upsellPlatform",
          label: t("settings.monetization.upsellFee", "Part plateforme (upsells)"),
          value: platformPct,
          onChange: onPlatformPctChange,
          color: SHARE_PLATFORM,
        })}
        {renderInput({
          key: "upsellOrg",
          label: t(
            "settings.services.conciergeOnNet",
            "Part conciergerie (sur le net)",
          ),
          value: orgPct,
          onChange: onOrgPctChange,
          color: SHARE_CONCIERGE,
        })}
      </Stack>

      <Alert severity="info" sx={{ borderRadius: "8px", mb: 2.5 }}>
        {t(
          "settings.services.contractOverride",
          "La part conciergerie peut être surchargée par le contrat de gestion d’un logement : c’est alors le taux du contrat qui s’applique, pas celui-ci.",
        )}
      </Alert>

      <div className="border-t border-[divider] pt-2">
        <p className="cn-text-body1 text-[0.75rem] font-semibold text-muted-foreground">
          {t("settings.services.activitiesTitle", "Activités — programmes d’affiliation")}
        </p>
        <p className="cn-text-body1 text-[0.72rem] text-muted-foreground mt-0.5 mb-2 leading-[1.5]">
          {t(
            "settings.services.affiliationHint",
            "Le voyageur réserve chez le prestataire via un lien affilié. La commission est versée sur le compte affilié Baitly, qui en retient sa part et vous reverse le solde.",
          )}
        </p>

        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 460 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={headCellSx}>
                  {t("settings.services.source", "Source")}
                </TableCell>
                <TableCell sx={headCellSx}>
                  {t("settings.services.status", "Statut")}
                </TableCell>
                <TableCell align="center" sx={headCellSx}>
                  {t("settings.services.baitlyRate", "Part Baitly")}
                </TableCell>
                <TableCell align="right" sx={headCellSx}>
                  {t("settings.split.ownerShare")}
                </TableCell>
                <TableCell align="right" sx={{ ...headCellSx, width: 60 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {PROVIDERS.map((provider) => {
                const config = byProvider.get(provider);
                const status: ProviderStatus = !config
                  ? "UNCONFIGURED"
                  : config.enabled
                    ? "ACTIVE"
                    : "INACTIVE";
                const meta = STATUS_META[status];
                return (
                  <TableRow key={provider} hover>
                    <TableCell>
                      <p className="cn-text-body1 text-[0.8125rem] font-semibold whitespace-nowrap">
                        {PROVIDER_LABELS[provider]}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        tokens={{ color: meta.color, bg: meta.soft }}
                        label={t(meta.key, meta.fallback)}
                        className="h-5 border border-solid text-[0.65rem]"
                        sx={{
                          borderColor: `color-mix(in srgb, ${meta.color} 20%, transparent)`,
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        type="number"
                        size="small"
                        placeholder="0"
                        value={rates[provider] ?? ""}
                        onChange={(e) =>
                          setRates((prev) => ({ ...prev, [provider]: e.target.value }))
                        }
                        inputProps={{
                          min: 0,
                          max: 100,
                          step: 0.5,
                          "aria-label": `${t("settings.services.baitlyRate", "Part Baitly")} — ${PROVIDER_LABELS[provider]}`,
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
                        sx={{ width: 108 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <p className="cn-text-body1 text-[0.78rem] font-bold tabular-nums text-foreground">
                        {formatMoney(100 - platformRate(provider))}
                      </p>
                    </TableCell>
                    <TableCell align="right">
                      <div className="inline-flex gap-0.5">
                      <Tooltip
                        title={t(
                          "settings.services.importTooltip",
                          "Importer un rapport de conversions",
                        )}
                      >
                        <IconButton
                          size="small"
                          onClick={() => setImportProvider(provider as ActivityProvider)}
                          aria-label={`${t("settings.services.importTitle", "Importer un rapport")} — ${PROVIDER_LABELS[provider]}`}
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: "7px",
                            color: "text.secondary",
                            border: "1px solid",
                            borderColor: "divider",
                            transition:
                              "border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)",
                            "&:hover": {
                              color: "var(--accent)",
                              borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)",
                            },
                            "&:focus-visible": {
                              outline: "2px solid var(--accent)",
                              outlineOffset: 2,
                            },
                          }}
                        >
                          <Upload size={13} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("common.save", "Enregistrer")}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => saveRate(provider)}
                            disabled={savingProvider === provider}
                            aria-label={t("common.save", "Enregistrer")}
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: "7px",
                              color: "text.secondary",
                              border: "1px solid",
                              borderColor: "divider",
                              transition:
                                "border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)",
                              "&:hover": {
                                color: "var(--accent)",
                                borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)",
                              },
                              "&:focus-visible": {
                                outline: "2px solid var(--accent)",
                                outlineOffset: 2,
                              },
                            }}
                          >
                            {savingProvider === provider ? (
                              <Spinner className="size-[13px]" />
                            ) : (
                              <Save size={13} strokeWidth={1.75} />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <p className="cn-text-body1 text-[0.72rem] text-muted-foreground mt-1.5 leading-[1.5]">
          {t(
            "settings.services.affiliationProjection",
            "Projection sur 100 € de commission d’affiliation perçue par Baitly, qui en retient sa part et vous reverse le solde. Un taux vide signifie qu’aucune part n’est retenue.",
          )}
        </p>
      </div>

      <AffiliateImportDialog
        open={importProvider !== null}
        provider={importProvider}
        onClose={() => setImportProvider(null)}
      />
    </>
  );
}
