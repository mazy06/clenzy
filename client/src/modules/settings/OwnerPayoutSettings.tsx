import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import StatusChip from '../../components/StatusChip';
import { Button, Spinner } from '../../components/ui';
import { Field, FieldLabel, FieldDescription, FieldError, Input } from '../../components/ui';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import {
  AccountBalance,
  Save,
  VerifiedUser,
  Warning,
  Edit as EditIcon,
  CheckCircle,
  Settings as SettingsIcon,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAllOwnerPayoutConfigs,
  useUpdateSepaDetails,
  useVerifyOwnerConfig,
  ownerPayoutConfigKeys,
} from '../../hooks/useOwnerPayoutConfig';
import type { OwnerPayoutConfig, PayoutMethod } from '../../services/api/accountingApi';
import SettingsSection from './components/SettingsSection';
import PayoutMethodEditDialog from './components/PayoutMethodEditDialog';
import PagePagination from '../../components/PagePagination';

// ─── Constants ──────────────────────────────────────────────────────────────

const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  MANUAL: 'Manuel',
  STRIPE_CONNECT: 'Stripe Connect',
  SEPA_TRANSFER: 'Virement SEPA',
  WISE: 'Wise Business',
  OPEN_BANKING: 'Open Banking',
};

// Palette Baitly tintée pour les chips de méthode
const PAYOUT_METHOD_COLORS: Record<PayoutMethod, string> = {
  MANUAL: 'var(--muted)',
  STRIPE_CONNECT: '#635BFF', // brand Stripe (preserved for recognizability)
  SEPA_TRANSFER: 'var(--info)',
  WISE: '#00B9FF',           // brand Wise teal — préservé pour reconnaissance
  OPEN_BANKING: 'var(--accent)', // accent Baitly (Open Banking = approche maison)
};

// Ecarts assumes vs le gabarit du kit (12.5px / 8px pour le corps, 10.5px
// --faint .05em pour l'en-tete) : cet ecran etait deja regle plus dense.
const CELL_CLASS = 'text-[0.8125rem] py-[7.5px]';
const HEAD_CELL_CLASS = 'text-[0.7rem] tracking-[0.06em] text-[var(--muted)]';

/** Bouton d'action de ligne : 28px hairline, hover teinte accent (report du sx). */
const ROW_ACTION_CLASS =
  'rounded-[7px] text-[var(--muted)] transition-[color,border-color,background-color] duration-150 '
  + 'hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] '
  + 'hover:border-[color-mix(in_srgb,_var(--accent)_40%,_transparent)]';

const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

/** Estimated row height in px (py-[7.5px] * 2 + ~26px content) */
const ROW_HEIGHT = 41;
/** Table header + pagination footer overhead */
const TABLE_OVERHEAD = 100;
/** Minimum rows per page */
const MIN_ROWS = 3;

// ─── Component ──────────────────────────────────────────────────────────────

export default function OwnerPayoutSettings() {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const queryClient = useQueryClient();
  const { data: configs = [], isLoading } = useAllOwnerPayoutConfigs();
  const updateSepaMutation = useUpdateSepaDetails();
  const verifyMutation = useVerifyOwnerConfig();

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const containerRef = useRef<HTMLDivElement>(null);

  const computeRowsPerPage = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const availableHeight = window.innerHeight - rect.top;
    const rows = Math.max(MIN_ROWS, Math.floor((availableHeight - TABLE_OVERHEAD) / ROW_HEIGHT));
    setRowsPerPage(rows);
  }, []);

  useEffect(() => {
    computeRowsPerPage();
    window.addEventListener('resize', computeRowsPerPage);
    return () => window.removeEventListener('resize', computeRowsPerPage);
  }, [computeRowsPerPage]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(configs.length / rowsPerPage) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [configs.length, rowsPerPage, page]);

  const paginatedConfigs = useMemo(
    () => configs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [configs, page, rowsPerPage],
  );

  // SEPA edit dialog (legacy — kept for backward compat with existing button)
  const [sepaOpen, setSepaOpen] = useState(false);
  const [sepaTarget, setSepaTarget] = useState<OwnerPayoutConfig | null>(null);
  const [sepaIban, setSepaIban] = useState('');
  const [sepaBic, setSepaBic] = useState('');
  const [sepaHolder, setSepaHolder] = useState('');
  const [ibanError, setIbanError] = useState('');

  // Nouvelle modale unifiée méthode (Wise, Open Banking, etc.)
  const [methodDialogOpen, setMethodDialogOpen] = useState(false);
  const [methodDialogTarget, setMethodDialogTarget] = useState<OwnerPayoutConfig | null>(null);
  const openMethodDialog = (config: OwnerPayoutConfig) => {
    setMethodDialogTarget(config);
    setMethodDialogOpen(true);
  };

  const openSepaDialog = (config: OwnerPayoutConfig) => {
    setSepaTarget(config);
    // Pré-remplit avec le mask serveur (ex: FR76 **** **** **** **** *** 0189).
    // Au save, ibanUnchanged détecte si l'utilisateur n'a rien modifié et on
    // skip la validation regex pour préserver l'IBAN existant.
    setSepaIban(config.maskedIban ?? '');
    setSepaBic(config.bic ?? '');
    setSepaHolder(config.bankAccountHolder ?? '');
    setIbanError('');
    setSepaOpen(true);
  };

  /** True si le champ IBAN contient encore le mask (= non modifié). */
  const isSepaIbanUnchanged = (() => {
    const trimmed = sepaIban.trim();
    if (!trimmed || !sepaTarget?.maskedIban) return false;
    if (trimmed === sepaTarget.maskedIban) return true;
    return trimmed.includes('*');
  })();

  const handleSaveSepa = async () => {
    if (!sepaTarget) return;

    // Si l'IBAN n'a pas été modifié (mask encore présent), on n'envoie pas
    // l'IBAN au backend — il garde l'existant. Le backend a été ajusté pour
    // accepter ce mode de mise à jour partielle (BIC et/ou titulaire seuls).
    let cleanIban: string | undefined;
    if (!isSepaIbanUnchanged) {
      cleanIban = sepaIban.replace(/\s+/g, '').toUpperCase();
      if (!IBAN_REGEX.test(cleanIban)) {
        setIbanError(t('settings.ownerPayout.ibanInvalid', 'Format IBAN invalide'));
        return;
      }
    }

    try {
      await updateSepaMutation.mutateAsync({
        ownerId: sepaTarget.ownerId,
        data: { iban: cleanIban, bic: sepaBic.trim(), bankAccountHolder: sepaHolder.trim() },
      });
      setSepaOpen(false);
      notify.success(t('settings.ownerPayout.sepaSaved', 'Coordonnées SEPA enregistrées'));
    } catch {
      notify.error(t('settings.ownerPayout.sepaError', "Erreur lors de l'enregistrement"));
    }
  };

  const handleVerify = async (ownerId: number) => {
    try {
      await verifyMutation.mutateAsync(ownerId);
      notify.success(t('settings.ownerPayout.verified', 'Configuration vérifiée'));
    } catch {
      notify.error(t('settings.ownerPayout.verifyError', 'Erreur lors de la vérification'));
    }
  };

  if (isLoading) {
    return (
      <SettingsSection
        title={t('settings.ownerPayout.title', 'Configuration des reversements propriétaires')}
        icon={AccountBalance}
        accent="accent"
      >
        <div className="flex justify-center py-3">
          <Spinner className="size-6" />
        </div>
      </SettingsSection>
    );
  }

  return (
    <div ref={containerRef}>
      <SettingsSection
        title={t('settings.ownerPayout.title', 'Configuration des reversements propriétaires')}
        icon={AccountBalance}
        accent="accent"
        description={t(
          'settings.ownerPayout.subtitle',
          'Configurez la méthode de paiement pour chaque propriétaire (Stripe Connect, virement SEPA ou manuel).',
        )}
      >
        {/* ── Bannière agrégée Open Banking : alerte si des consents sont expirés/expirant ── */}
        {(() => {
          const obConfigs = configs.filter((c) => c.payoutMethod === 'OPEN_BANKING');
          if (obConfigs.length === 0) return null;
          const now = Date.now();
          const expired = obConfigs.filter((c) => {
            if (!c.openBankingConsentExpiresAt) return true; // jamais configuré
            return new Date(c.openBankingConsentExpiresAt).getTime() < now;
          });
          const expiringSoon = obConfigs.filter((c) => {
            if (!c.openBankingConsentExpiresAt) return false;
            const days = (new Date(c.openBankingConsentExpiresAt).getTime() - now) / (1000 * 60 * 60 * 24);
            return days > 0 && days <= 7;
          });

          if (expired.length === 0 && expiringSoon.length === 0) return null;

          const isCritical = expired.length > 0;
          return (
            <Alert variant={isCritical ? 'destructive' : 'warning'} className="mb-3 text-[0.85rem]">
              <Warning size={16} strokeWidth={1.75} />
              <AlertTitle className="text-[0.85rem] font-semibold">
                Open Banking — {expired.length} consent{expired.length > 1 ? 's' : ''} expiré{expired.length > 1 ? 's' : ''}
                {expired.length > 0 && expiringSoon.length > 0 ? ', ' : ''}
                {expiringSoon.length > 0 && `${expiringSoon.length} expirant dans 7 jours`}
              </AlertTitle>
              <AlertDescription className="text-[0.78rem]">
                Les propriétaires concernés doivent refaire l'authentification bancaire (SCA) depuis leur page
                <strong> Mes reversements </strong>
                pour réactiver les virements automatiques. Vous pouvez aussi initier le SCA pour eux via l'icône
                engrenage (Configurer la méthode).
              </AlertDescription>
            </Alert>
          );
        })()}

        {configs.length === 0 ? (
          <div className="p-6 rounded-[8px] border border-dashed border-[var(--line)] text-center flex flex-col items-center gap-1.5">
            <div className="w-[48px] h-[48px] rounded-[12px] inline-flex items-center justify-center bg-[var(--ok-soft)] text-[var(--ok)] border border-solid border-[color-mix(in_srgb,_var(--ok)_20%,_transparent)]">
              <AccountBalance size={22} strokeWidth={1.75} />
            </div>
            <p className="cn-text-body1 text-[0.85rem] text-muted-foreground max-w-[480px]">
              {t(
                'settings.ownerPayout.empty',
                'Aucune configuration trouvée. Les configurations sont créées automatiquement lors de la première génération de payout.',
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={HEAD_CELL_CLASS}>{t('settings.ownerPayout.col.owner', 'Propriétaire')}</TableHead>
                  <TableHead className={HEAD_CELL_CLASS}>{t('settings.ownerPayout.col.method', 'Méthode')}</TableHead>
                  <TableHead className={HEAD_CELL_CLASS}>{t('settings.ownerPayout.col.details', 'Détails')}</TableHead>
                  <TableHead className={`${HEAD_CELL_CLASS} text-center`}>{t('settings.ownerPayout.col.status', 'Statut')}</TableHead>
                  <TableHead className={`${HEAD_CELL_CLASS} text-end pe-[7.5px]`}>{t('common.actions', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedConfigs.map((config) => {
                  const methodColor = PAYOUT_METHOD_COLORS[config.payoutMethod];
                  return (
                    <TableRow key={config.id}>
                      <TableCell className={CELL_CLASS}>
                        <p className="cn-text-body1 text-[0.82rem] font-semibold text-foreground">
                          {t('settings.ownerPayout.ownerLabel', 'Propriétaire')} #{config.ownerId}
                        </p>
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        <StatusChip tokens={{ color: methodColor, bg: `color-mix(in srgb, ${methodColor} 8%, transparent)` }} label={PAYOUT_METHOD_LABELS[config.payoutMethod]} className="tracking-[0.01em]" />
                      </TableCell>
                      <TableCell className={CELL_CLASS}>
                        {config.payoutMethod === 'SEPA_TRANSFER' && config.maskedIban && (
                          <span className="font-mono text-[0.75rem] tabular-nums text-foreground">
                            {config.maskedIban}
                            {config.bic ? ` / ${config.bic}` : ''}
                          </span>
                        )}
                        {config.payoutMethod === 'STRIPE_CONNECT' && (
                          <p className="cn-text-body1 text-[0.75rem] text-muted-foreground">
                            {config.stripeOnboardingComplete
                              ? t('settings.ownerPayout.stripeConnected', 'Compte connecté')
                              : t('settings.ownerPayout.stripeNotConnected', 'Onboarding en cours...')}
                          </p>
                        )}
                        {config.payoutMethod === 'MANUAL' && (
                          <p className="cn-text-body1 text-[0.75rem] text-muted-foreground">
                            {t('settings.ownerPayout.manualNote', 'Virement manuel')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className={`${CELL_CLASS} text-center`}>
                        {config.verified ? (
                          <StatusChip tokens={{ color: 'var(--ok)', bg: 'var(--ok-soft)' }} label={t('settings.ownerPayout.verifiedLabel', 'Vérifié')} icon={<VerifiedUser size={11} strokeWidth={2} />} className="tracking-[0.01em] px-0.5" />
                        ) : (
                          <StatusChip tokens={{ color: 'var(--warn)', bg: 'var(--warn-soft)' }} label={t('settings.ownerPayout.pendingLabel', 'En attente')} icon={<Warning size={11} strokeWidth={2} />} className="tracking-[0.01em] px-0.5" />
                        )}
                      </TableCell>
                      <TableCell className={`${CELL_CLASS} text-end pe-[7.5px]`}>
                        <div className="inline-flex items-center gap-0.5 justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => openMethodDialog(config)}
                                  aria-label={t('settings.ownerPayout.changeMethod', 'Changer la méthode')}
                                  className={ROW_ACTION_CLASS}
                                >
                                  <SettingsIcon size={13} strokeWidth={1.75} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t('settings.ownerPayout.changeMethod', 'Changer la méthode de reversement')}
                            </TooltipContent>
                          </Tooltip>
                          {config.payoutMethod === 'SEPA_TRANSFER' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => openSepaDialog(config)}
                                    aria-label={t('settings.ownerPayout.editSepa', 'Modifier SEPA')}
                                    className={ROW_ACTION_CLASS}
                                  >
                                    <EditIcon size={13} strokeWidth={1.75} />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{t('settings.ownerPayout.editSepa', 'Modifier SEPA')}</TooltipContent>
                            </Tooltip>
                          )}
                          {!config.verified && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => handleVerify(config.ownerId)}
                                    disabled={verifyMutation.isPending}
                                    aria-label={t('settings.ownerPayout.verify', 'Vérifier')}
                                    className={ROW_ACTION_CLASS}
                                  >
                                    <CheckCircle size={13} strokeWidth={1.75} />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{t('settings.ownerPayout.verify', 'Vérifier')}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <PagePagination
              count={configs.length}
              page={page}
              onPageChange={(newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
            />
          </div>
        )}
      </SettingsSection>

      {/* ── SEPA Edit Dialog ── */}
      <Dialog open={sepaOpen} onOpenChange={(next) => { if (!next) setSepaOpen(false); }}>
        <DialogContent className="sm:max-w-[444px] rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="text-[0.95rem] font-bold tracking-[-0.005em]">
              {t('settings.ownerPayout.editSepaTitle', 'Coordonnées bancaires SEPA')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-[9px]">
          <Field>
            <FieldLabel htmlFor="sepa-iban">{t('settings.ownerPayout.iban', 'IBAN')}</FieldLabel>
            <Input
              id="sepa-iban"
              className="w-full font-mono text-[0.875rem] tabular-nums"
              value={sepaIban}
              onChange={(e) => {
                setSepaIban(e.target.value);
                setIbanError('');
              }}
              onFocus={(e) => {
                // Si le champ contient encore le mask, on selectionne tout :
                // l'utilisateur peut taper un nouvel IBAN directement, ou
                // cliquer ailleurs pour conserver l'existant.
                if (isSepaIbanUnchanged) {
                  e.target.select();
                }
              }}
              aria-invalid={!!ibanError}
            />
            {ibanError ? (
              <FieldError>{ibanError}</FieldError>
            ) : (
              <FieldDescription>
                {sepaTarget?.maskedIban
                  ? (isSepaIbanUnchanged
                    ? t('settings.ownerPayout.ibanPreserved', 'IBAN actuel conservé. Tapez un nouvel IBAN pour le remplacer.')
                    : t('settings.ownerPayout.ibanNewFormat', 'Nouvel IBAN. Format : FR76 1234 5678 9012 3456 7890 123'))
                  : t('settings.ownerPayout.ibanFormat', 'Format : FR76 1234 5678 9012 3456 7890 123')}
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="sepa-bic">{t('settings.ownerPayout.bic', 'BIC/SWIFT')}</FieldLabel>
            <Input
              id="sepa-bic"
              className="w-full tabular-nums tracking-[0.04em] uppercase"
              value={sepaBic}
              onChange={(e) => setSepaBic(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sepa-holder">{t('settings.ownerPayout.holder', 'Titulaire du compte')}</FieldLabel>
            <Input
              id="sepa-holder"
              className="w-full"
              value={sepaHolder}
              onChange={(e) => setSepaHolder(e.target.value)}
            />
          </Field>
          </div>
          <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSepaOpen(false)}
            className="text-[var(--muted)]"
          >
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveSepa}
            disabled={
              updateSepaMutation.isPending
              // Holder reste obligatoire (toujours présent : pré-rempli depuis config)
              || !sepaHolder.trim()
              // IBAN : actif si modifié (= pas le mask) OU si un IBAN existe déjà
              //   - cas 1 : nouvel IBAN saisi → on valide au save
              //   - cas 2 : mask intact + IBAN existe → on préserve (update partiel)
              //   - cas 3 : pas de mask + champ vide → bouton désactivé (premier setup)
              || (!sepaIban.trim() && !sepaTarget?.maskedIban)
            }
          >
            {updateSepaMutation.isPending ? (
              <Spinner className="size-3.5" />
            ) : (
              <Save size={14} strokeWidth={1.75} />
            )}
            {t('common.save', 'Enregistrer')}
          </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PayoutMethodEditDialog
        open={methodDialogOpen}
        currentConfig={methodDialogTarget}
        mode="admin"
        ownerId={methodDialogTarget?.ownerId}
        onClose={() => setMethodDialogOpen(false)}
        onSaved={() => {
          notify.success(t('settings.ownerPayout.methodSaved', 'Méthode de reversement mise à jour'));
          queryClient.invalidateQueries({ queryKey: ownerPayoutConfigKeys.all });
        }}
      />
    </div>
  );
}
