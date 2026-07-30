import React, { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { activitiesApi } from "../../../services/api/activitiesApi";
import type {
  ActivityProvider,
  ImportedAffiliateEarning,
} from "../../../services/api/activitiesApi";
import type { ApiError } from "../../../services/apiClient";
import { useTranslation } from "../../../hooks/useTranslation";

const PROVIDER_LABELS: Record<string, string> = {
  VIATOR: "Viator",
  GETYOURGUIDE: "GetYourGuide",
  KLOOK: "Klook",
};

export interface AffiliateImportDialogProps {
  open: boolean;
  provider: ActivityProvider | null;
  onClose: () => void;
  /** Notifie le parent qu'au moins une commission a ete enregistree. */
  onImported?: () => void;
}

const formatMoney = (value: number) => value.toFixed(2).replace(".", ",");

/**
 * Import d'un export de conversions d'affiliation.
 *
 * <p>Les trois programmes ne publient leurs conversions que par export : cet
 * ecran est donc la voie normale d'alimentation, pas un outil de secours.</p>
 *
 * <p>Le recapitulatif affiche apres coup n'est pas decoratif : l'import etant
 * idempotent, reimporter un fichier qui chevauche le precedent renvoie les
 * memes lignes sans rien crediter a nouveau. Sans les totaux, rien ne
 * distinguerait ce cas d'un import qui vient de payer les hotes.</p>
 */
export default function AffiliateImportDialog({
  open,
  provider,
  onClose,
  onImported,
}: AffiliateImportDialogProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportedAffiliateEarning[] | null>(null);

  const reset = () => {
    setFile(null);
    setBusy(false);
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleImport = async () => {
    if (!provider || !file) return;
    setBusy(true);
    setError(null);
    try {
      const rows = await activitiesApi.importEarningsCsv(provider, file);
      setResult(rows);
      if (rows.length > 0) onImported?.();
    } catch (err) {
      // apiClient rejette un objet ApiError nu : le message du serveur porte la
      // raison utile (colonnes introuvables, fichier vide), il faut le montrer.
      const message = (err as Partial<ApiError> | null)?.message;
      setError(
        message ||
          t("settings.services.importFailed", "L’import a échoué."),
      );
    } finally {
      setBusy(false);
    }
  };

  const totals = (result ?? []).reduce(
    (acc, row) => ({
      gross: acc.gross + (row.grossCommission ?? 0),
      platform: acc.platform + (row.platformShare ?? 0),
      host: acc.host + (row.hostShare ?? 0),
    }),
    { gross: 0, platform: 0, host: 0 },
  );

  const providerLabel = provider ? PROVIDER_LABELS[provider] ?? provider : "";

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, lineHeight: 1.25 }}>
          {t("settings.services.importTitle", "Importer un rapport")}
        </Typography>
        <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", lineHeight: 1.4 }}>
          {providerLabel}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {result === null ? (
          <>
            <Typography
              sx={{ fontSize: "0.78rem", color: "text.secondary", lineHeight: 1.55, mb: 1.75 }}
            >
              {t(
                "settings.services.importHint",
                "Exportez vos conversions depuis le tableau de bord du programme, puis déposez le fichier ici. Les colonnes de référence de réservation et de montant de commission suffisent ; le séparateur et le format des montants sont détectés automatiquement.",
              )}
            </Typography>

            <Box
              component="input"
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
              sx={{
                width: "100%",
                fontSize: "0.8125rem",
                color: "text.secondary",
                "&::file-selector-button": {
                  font: "inherit",
                  mr: 1.25,
                  px: 1.25,
                  py: 0.625,
                  borderRadius: "7px",
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "transparent",
                  color: "text.primary",
                  cursor: "pointer",
                },
              }}
            />

            {error && (
              <Alert severity="error" sx={{ mt: 1.75, borderRadius: "8px" }}>
                {error}
              </Alert>
            )}
          </>
        ) : (
          <>
            {result.length === 0 ? (
              <Alert severity="warning" sx={{ borderRadius: "8px" }}>
                {t(
                  "settings.services.importEmpty",
                  "Aucune commission exploitable dans ce fichier : les lignes sans référence ni montant sont ignorées.",
                )}
              </Alert>
            ) : (
              <>
                <Alert severity="success" sx={{ borderRadius: "8px", mb: 1.75 }}>
                  {t("settings.services.importDone", "{{count}} commission(s) enregistrée(s).", {
                    count: result.length,
                  })}
                </Alert>
                <Stack spacing={0.875}>
                  {[
                    {
                      key: "gross",
                      label: t("settings.services.importGross", "Commission perçue"),
                      value: totals.gross,
                      strong: false,
                    },
                    {
                      key: "platform",
                      label: t("settings.split.platformShare"),
                      value: totals.platform,
                      strong: false,
                    },
                    {
                      key: "host",
                      label: t("settings.split.ownerShare"),
                      value: totals.host,
                      strong: true,
                    },
                  ].map((line) => (
                    <Box
                      key={line.key}
                      sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}
                    >
                      <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>
                        {line.label}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.78rem",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: line.strong ? 700 : 500,
                          color: line.strong ? "text.primary" : "text.secondary",
                        }}
                      >
                        {formatMoney(line.value)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
                <Typography
                  sx={{
                    fontSize: "0.72rem",
                    color: "text.secondary",
                    mt: 1.5,
                    lineHeight: 1.5,
                  }}
                >
                  {t(
                    "settings.services.importIdempotent",
                    "Les références déjà importées sont renvoyées sans être créditées une seconde fois.",
                  )}
                </Typography>
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} size="small">
          {result === null
            ? t("common.cancel", "Annuler")
            : t("common.close", "Fermer")}
        </Button>
        {result === null && (
          <Button
            variant="contained"
            disableElevation
            size="small"
            onClick={handleImport}
            disabled={!file || busy}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {t("settings.services.importAction", "Importer")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
