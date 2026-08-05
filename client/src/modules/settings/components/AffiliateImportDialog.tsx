import React, { useRef, useState } from "react";
import { Spinner } from '../../../components/ui';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui';
import { cn } from "../../../utils/cn";
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="sm:max-w-[444px]">
      <DialogHeader className="pb-1">
        <DialogTitle className="text-base font-semibold tracking-tight">
          {t("settings.services.importTitle", "Importer un rapport")}
        </DialogTitle>
        <DialogDescription className="text-xs">
          {providerLabel}
        </DialogDescription>
      </DialogHeader>

      {/* Les filets haut/bas remplacent le `dividers` de la modale MUI. */}
      <div className="border-y border-solid border-border py-3">
        {result === null ? (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2.5">
              {t(
                "settings.services.importHint",
                "Exportez vos conversions depuis le tableau de bord du programme, puis déposez le fichier ici. Les colonnes de référence de réservation et de montant de commission suffisent ; le séparateur et le format des montants sont détectés automatiquement.",
              )}
            </p>

            {/* ::file-selector-button = variante `file:` ; me/px 1.25 = 7.5px, py 0.625 = 3.75px.
                Marge logique (`me`) et non physique : le PMS est RTL. */}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
              className="w-full text-[0.8125rem] text-muted-foreground file:[font:inherit] file:me-[7.5px] file:px-[7.5px] file:py-[3.75px] file:rounded-md file:border file:border-solid file:border-border file:bg-transparent file:text-foreground file:cursor-pointer"
            />

            {error && (
              <Alert variant="destructive" className="mt-[10.5px]">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </>
        ) : (
          <>
            {result.length === 0 ? (
              <Alert variant="warning">
                <AlertDescription>
                  {t(
                    "settings.services.importEmpty",
                    "Aucune commission exploitable dans ce fichier : les lignes sans référence ni montant sont ignorées.",
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert variant="success" className="mb-[10.5px]">
                  <AlertDescription>
                    {t("settings.services.importDone", "{{count}} commission(s) enregistrée(s).", {
                      count: result.length,
                    })}
                  </AlertDescription>
                </Alert>
                <div className="flex flex-col gap-[5.25px]">
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
                    <div className="flex justify-between gap-3" key={line.key}>
                      <p className="text-xs text-muted-foreground">
                        {line.label}
                      </p>
                      <p
                        className={cn(
                          "text-xs tabular-nums",
                          line.strong
                            ? "font-semibold text-foreground"
                            : "font-medium text-muted-foreground",
                        )}
                      >
                        {formatMoney(line.value)}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  {t(
                    "settings.services.importIdempotent",
                    "Les références déjà importées sont renvoyées sans être créditées une seconde fois.",
                  )}
                </p>
              </>
            )}
          </>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={handleClose}>
          {result === null
            ? t("common.cancel", "Annuler")
            : t("common.close", "Fermer")}
        </Button>
        {result === null && (
          <Button
            size="sm"
            onClick={handleImport}
            disabled={!file || busy}
          >
            {busy && <Spinner className="size-3.5" />}
            {t("settings.services.importAction", "Importer")}
          </Button>
        )}
      </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
