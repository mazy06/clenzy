import React, { useState, useEffect, useMemo } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Alert, AlertDescription } from '../../../components/ui';
import { Info, CircleCheck, TriangleAlert } from 'lucide-react';
import { Spinner, Button } from '../../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, IconButton, Stack } from '@mui/material';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  Input,
  NativeSelect,
  NativeSelectOption,
} from '../../../components/ui';
import { Close as CloseIcon, Save } from '../../../icons';
import { cn } from '../../../utils/cn';
import { accountingApi } from '../../../services/api/accountingApi';
import type {
  OwnerPayoutConfig,
  PayoutMethod,
  OpenBankingInitRequest,
  OpenBankingInstitution,
  UpdateSepaRequest,
} from '../../../services/api/accountingApi';

/**
 * Modale unifiée d'édition de la méthode de payout d'un propriétaire.
 *
 * <h2>5 méthodes supportées</h2>
 * <ul>
 *   <li><strong>STRIPE_CONNECT</strong> — onboarding self-service (link affiché
 *       si {@code mode="self"}, message d'attente sinon)</li>
 *   <li><strong>SEPA_TRANSFER</strong> — saisie IBAN + BIC + titulaire</li>
 *   <li><strong>WISE</strong> — réutilise les champs IBAN (Wise crée son
 *       recipient depuis ces données)</li>
 *   <li><strong>OPEN_BANKING</strong> — flow SCA via GoCardless avec sélection
 *       de la banque, redirect vers la banque</li>
 *   <li><strong>MANUAL</strong> — pas de configuration, juste un toggle</li>
 * </ul>
 *
 * <h2>Modes admin vs self</h2>
 * <p>{@code mode="self"} = utilisateur édite sa propre config (endpoints
 * {@code /me/*}). {@code mode="admin"} = SUPER_ADMIN édite la config d'un
 * propriétaire (endpoints {@code /{ownerId}/*}).</p>
 */

const ACCENT = 'var(--ok)';
const PRIMARY = 'var(--accent)';
const NEUTRAL = 'var(--muted)';
const WARM = 'var(--warn)';

const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

const extractErrorMessage = (e: unknown): string => {
  if (e instanceof Error && e.message) return e.message;
  // ApiClient peut wrapper l'erreur backend dans { message, status, body }
  if (typeof e === 'object' && e !== null) {
    const err = e as { message?: string; body?: { error?: string; message?: string } };
    if (err.body?.error) return err.body.error;
    if (err.body?.message) return err.body.message;
    if (err.message) return err.message;
  }
  return 'Erreur inconnue lors de la sauvegarde.';
};

const METHOD_OPTIONS: Array<{
  value: PayoutMethod;
  label: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}> = [
  {
    value: 'STRIPE_CONNECT',
    label: 'Stripe Connect',
    description: 'Virement automatique vers compte Stripe Express. EU, US, UK et 40+ pays.',
    badge: 'AUTO',
    badgeColor: ACCENT,
  },
  {
    value: 'WISE',
    label: 'Wise Business',
    description: 'Virement international auto, 80+ pays dont Maroc et Arabie Saoudite. Frais ~0.5%.',
    badge: 'AUTO',
    badgeColor: ACCENT,
  },
  {
    value: 'OPEN_BANKING',
    label: 'Open Banking PIS',
    description: 'Virement SEPA auto via PSD2. Validation SCA bancaire tous les 90 jours.',
    badge: 'AUTO',
    badgeColor: ACCENT,
  },
  {
    value: 'SEPA_TRANSFER',
    label: 'Virement SEPA',
    description: 'Génération XML pain.001 + upload manuel sur le portail bancaire Baitly.',
    badge: 'SEMI-AUTO',
    badgeColor: WARM,
  },
  {
    value: 'MANUAL',
    label: 'Manuel',
    description: 'Paiement hors-Baitly (espèces, chèque, virement perso). Aucune automatisation.',
    badge: 'MANUEL',
    badgeColor: NEUTRAL,
  },
];

interface PayoutMethodEditDialogProps {
  open: boolean;
  /** Config actuelle. null = vierge (premier setup). */
  currentConfig: OwnerPayoutConfig | null;
  /** "self" = self-service propriétaire, "admin" = SUPER_ADMIN édite un host. */
  mode: 'self' | 'admin';
  /** Requis en mode "admin" pour cibler le bon owner. Ignoré en mode "self". */
  ownerId?: number;
  /** Nom de l'owner pour affichage (mode admin uniquement). */
  ownerName?: string;
  onClose: () => void;
  /** Appelé après une sauvegarde réussie pour rafraîchir la liste parent. */
  onSaved: () => void;
}

export default function PayoutMethodEditDialog({
  open,
  currentConfig,
  mode,
  ownerId,
  ownerName,
  onClose,
  onSaved,
}: PayoutMethodEditDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod>('MANUAL');

  // Champs IBAN (partagés SEPA + Wise)
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [holder, setHolder] = useState('');
  const [ibanError, setIbanError] = useState('');

  // Open Banking
  const [institutionId, setInstitutionId] = useState('SANDBOXFINANCE_SFIN0000');
  /**
   * Liste des banques GoCardless récupérée dynamiquement. Null = pas encore
   * chargé. Tableau vide = pas de banques disponibles (= fallback codé en dur).
   */
  const [institutions, setInstitutions] = useState<OpenBankingInstitution[] | null>(null);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Charge la liste de banques GoCardless quand on sélectionne Open Banking ─
  useEffect(() => {
    if (!open || selectedMethod !== 'OPEN_BANKING') return;
    if (institutions !== null) return; // déjà chargé
    setInstitutionsLoading(true);
    accountingApi.listOpenBankingInstitutions('FR')
      .then((list) => {
        setInstitutions(list);
        // Si la valeur courante n'est pas dans la liste, sélectionne la 1ère
        if (list.length > 0 && !list.some((i) => i.id === institutionId)) {
          setInstitutionId(list[0].id);
        }
      })
      .catch(() => {
        // Fallback silencieux : utilise la liste codée en dur
        setInstitutions([]);
      })
      .finally(() => setInstitutionsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedMethod]);

  // ─── Init from currentConfig à l'ouverture ──────────────────────────────
  useEffect(() => {
    if (!open) return;
    setSelectedMethod(currentConfig?.payoutMethod ?? 'MANUAL');
    // Pre-remplit avec le mask (****0189). L'API ne renvoie jamais l'IBAN en
    // clair, mais le mask est utile pour montrer qu'une valeur existe. Au save,
    // si l'utilisateur n'a pas modifie le champ (= il contient toujours le
    // mask), on traite comme "preserve" sans valider le format.
    setIban(currentConfig?.maskedIban ?? '');
    setBic(currentConfig?.bic ?? '');
    setHolder(currentConfig?.bankAccountHolder ?? '');
    setIbanError('');
    setInstitutionId('SANDBOXFINANCE_SFIN0000');
    setError(null);
  }, [open, currentConfig]);

  const requiresIban = useMemo(
    () => selectedMethod === 'SEPA_TRANSFER' || selectedMethod === 'WISE',
    [selectedMethod],
  );

  // ─── Save handlers ──────────────────────────────────────────────────────

  /** True si un IBAN est déjà enregistré côté serveur (masque exposé). */
  const hasExistingIban = !!currentConfig?.maskedIban;

  const switchMethodOnly = async (method: PayoutMethod) => {
    if (mode === 'self') {
      await accountingApi.updatePayoutMethod(currentConfig?.ownerId ?? 0, { payoutMethod: method });
    } else {
      if (!ownerId) throw new Error('ownerId requis en mode admin');
      await accountingApi.updatePayoutMethod(ownerId, { payoutMethod: method });
    }
  };

  /**
   * True si le champ IBAN contient encore la valeur masquée d'origine
   * (= l'utilisateur n'a pas tapé un nouveau IBAN, il veut préserver l'existant).
   * Les caractères '*' indiquent à coup sûr que c'est encore le mask.
   */
  const ibanUnchanged = useMemo(() => {
    const trimmed = iban.trim();
    if (!trimmed) return false; // vide = pas le mask
    if (!hasExistingIban) return false;
    if (trimmed === currentConfig?.maskedIban) return true;
    // Robustesse : si la chaine contient un '*' c'est encore le mask
    return trimmed.includes('*');
  }, [iban, hasExistingIban, currentConfig?.maskedIban]);

  /**
   * Sauvegarde SEPA/Wise. Retourne {@code true} en cas de succes, {@code false}
   * si une erreur de validation a ete posee (via {@code setIbanError}).
   *
   * IMPORTANT (stale closure) : le state {@code ibanError} pose ici n'est PAS
   * lisible dans le meme tick (valeur du render precedent). On signale donc le
   * succes par la valeur de retour — jamais en relisant {@code ibanError}.
   */
  const saveSepaOrWise = async (): Promise<boolean> => {
    const trimmed = iban.trim();

    // Cas 1 : champ contient encore le mask OU est vide
    //   → l'utilisateur veut préserver l'IBAN existant, on switch juste la méthode
    if (ibanUnchanged || !trimmed) {
      if (!hasExistingIban) {
        setIbanError("Veuillez saisir l'IBAN du compte destinataire.");
        return false;
      }
      await switchMethodOnly(selectedMethod);
      return true;
    }

    // Cas 2 : nouvel IBAN saisi → validation + update complet
    const cleanIban = trimmed.replace(/\s+/g, '').toUpperCase();
    if (!IBAN_REGEX.test(cleanIban)) {
      setIbanError('Format IBAN invalide (ex: FR76 1234 5678 9012 3456 7890 123).');
      return false;
    }
    if (!holder.trim()) {
      setIbanError('Titulaire du compte requis.');
      return false;
    }

    const data: UpdateSepaRequest = {
      iban: cleanIban,
      bic: bic.trim(),
      bankAccountHolder: holder.trim(),
    };

    if (mode === 'self') {
      await accountingApi.updateMySepa(data);
    } else {
      if (!ownerId) throw new Error('ownerId requis en mode admin');
      await accountingApi.updateSepaDetails(ownerId, data);
    }

    // Si la méthode choisie est Wise, on switch après updateSepa (qui force
    // payoutMethod=SEPA_TRANSFER côté backend par sécurité).
    if (selectedMethod === 'WISE') {
      await switchMethodOnly('WISE');
    }
    return true;
  };

  /**
   * Initialise le flow Open Banking. Retourne {@code true} si la redirection
   * SCA a ete declenchee (le navigateur quitte la page), {@code false} si une
   * erreur de validation a ete posee (via {@code setError}).
   */
  const initOpenBanking = async (): Promise<boolean> => {
    if (!institutionId.trim()) {
      setError('Banque requise');
      return false;
    }
    const initData: OpenBankingInitRequest = {
      institutionId: institutionId.trim(),
      provider: 'GOCARDLESS',
    };
    const response = mode === 'self'
      ? await accountingApi.initMyOpenBanking(initData)
      : await accountingApi.initOpenBankingForOwner(ownerId!, initData);
    // Redirige le browser vers le SCA bancaire
    window.location.href = response.redirectUrl;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setIbanError('');
    try {
      // Chaque branche signale son succes par sa VALEUR DE RETOUR — jamais en
      // relisant un state (ibanError/error) pose dans le meme tick (stale
      // closure : on lirait la valeur du render precedent, donc vide → faux
      // succes + fermeture de la modale). Cf. F1-SETTINGS-02.
      let success: boolean;
      switch (selectedMethod) {
        case 'SEPA_TRANSFER':
        case 'WISE':
          success = await saveSepaOrWise();
          break;
        case 'OPEN_BANKING':
          await initOpenBanking();
          return; // pas de close — on redirige vers le SCA (ou erreur affichee)
        case 'STRIPE_CONNECT':
        case 'MANUAL':
          await switchMethodOnly(selectedMethod);
          success = true;
          break;
      }
      // Validation echouee (ex. IBAN manquant) : on garde la modale ouverte avec
      // le message d'erreur deja pose, sans declencher onSaved()/onClose().
      if (!success) return;
      onSaved();
      onClose();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Bouton "Enregistrer" est actif si :
   * - SEPA/Wise :
   *     * IBAN existant + champ vide ou inchangé (= juste switch méthode), OU
   *     * Nouveau IBAN saisi + titulaire saisi
   * - Open Banking : une institution est sélectionnée
   * - Stripe/Manual : toujours actif (switch immédiat)
   */
  const isSaveDisabled = useMemo(() => {
    if (saving) return true;
    if (requiresIban) {
      const trimmed = iban.trim();
      // Cas 1 : champ vide ou contient encore le mask → preserve, OK si IBAN existant
      if (!trimmed || ibanUnchanged) {
        return !hasExistingIban;
      }
      // Cas 2 : nouvel IBAN saisi → exige aussi un titulaire
      return !holder.trim();
    }
    if (selectedMethod === 'OPEN_BANKING') {
      return !institutionId.trim();
    }
    return false;
  }, [saving, requiresIban, iban, holder, hasExistingIban, ibanUnchanged, selectedMethod, institutionId]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: '12px' } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.95rem',
          fontWeight: 700,
          letterSpacing: '-0.005em',
        }}
      >
        <div>
          Méthode de reversement
          {ownerName && (
            <span className="block text-[0.72rem] font-normal text-muted-foreground mt-0.5">
              Propriétaire : {ownerName}
            </span>
          )}
        </div>
        <IconButton onClick={onClose} disabled={saving} size="small">
          <CloseIcon size={16} strokeWidth={2} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* ─── Sélecteur de méthode ───────────────────────────── */}
        <FormControl>
          <FormLabel sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'text.primary', mb: 1 }}>
            Choisissez le rail de virement
          </FormLabel>
          <RadioGroup
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value as PayoutMethod)}
            sx={{ gap: 0.5 }}
          >
            {METHOD_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                className={cn(
                  'cursor-pointer rounded-[8px] border border-solid px-[9px] py-1.5',
                  '[transition:border-color_150ms,background-color_150ms]',
                  'hover:border-[color-mix(in_srgb,var(--accent)_53%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]',
                  selectedMethod === opt.value
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] bg-transparent',
                )}
                onClick={() => setSelectedMethod(opt.value)}
              >
                <FormControlLabel
                  value={opt.value}
                  control={<Radio size="small" sx={{ p: 0.5, mr: 1 }} />}
                  label={
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="cn-text-body1 text-[0.85rem] font-semibold">
                          {opt.label}
                        </p>
                        {opt.badge && (
                          <StatusChip size="sm" tokens={{ color: opt.badgeColor ?? 'var(--muted)', bg: `${opt.badgeColor ?? 'var(--muted)'}14` }} label={opt.badge} className="text-[0.6rem] tracking-[0.04em]" />
                        )}
                      </div>
                      <p className="cn-text-body1 text-[0.72rem] text-muted-foreground leading-[1.4] mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  }
                  sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
                />
              </div>
            ))}
          </RadioGroup>
        </FormControl>

        {/* ─── Section IBAN (SEPA + Wise) ─────────────────────────── */}
        {requiresIban && (
          <Stack spacing={1.5}>
            <Alert variant="info" className="text-[0.8rem]">
              <Info />
              <AlertDescription>{hasExistingIban
                ? 'Les coordonnées bancaires actuelles sont affichées et conservées par défaut. Cliquez dans le champ IBAN pour saisir un nouveau numéro — sinon, gardez les valeurs existantes.'
                : selectedMethod === 'WISE'
                ? 'Wise utilisera ces coordonnées pour créer le recipient. Le virement sera converti automatiquement dans la devise du compte destinataire.'
                : 'Coordonnées du compte destinataire utilisées pour le fichier SEPA pain.001 et le virement bancaire.'}</AlertDescription>
            </Alert>
            <Field>
              <FieldLabel htmlFor="payout-iban">IBAN</FieldLabel>
              <Input
                id="payout-iban"
                className="font-mono text-[0.875rem] tabular-nums"
                value={iban}
                onChange={(e) => {
                  setIban(e.target.value);
                  setIbanError('');
                }}
                onFocus={(e) => {
                  // Si le champ contient encore le mask (****0189), on selectionne
                  // tout le contenu pour qu'un nouveau collage/saisie le remplace
                  // d'un seul coup. UX standard pour les champs pre-remplis.
                  if (ibanUnchanged) {
                    e.target.select();
                  }
                }}
                aria-invalid={!!ibanError}
              />
              {ibanError ? (
                <FieldError>{ibanError}</FieldError>
              ) : (
                <FieldDescription>
                  {hasExistingIban
                    ? ibanUnchanged
                      ? 'IBAN actuel conservé. Tapez un nouvel IBAN pour le remplacer.'
                      : 'Nouvel IBAN. Format : FR76 1234 5678 9012 3456 7890 123'
                    : 'Format : FR76 1234 5678 9012 3456 7890 123'}
                </FieldDescription>
              )}
            </Field>
            <Stack direction="row" spacing={1.5}>
              <Field className="flex-1">
                <FieldLabel htmlFor="payout-bic">BIC / SWIFT</FieldLabel>
                <Input
                  id="payout-bic"
                  className="tabular-nums uppercase tracking-[0.04em]"
                  value={bic}
                  onChange={(e) => setBic(e.target.value)}
                />
              </Field>
              <Field className="flex-[2]">
                <FieldLabel htmlFor="payout-holder">Titulaire du compte</FieldLabel>
                <Input
                  id="payout-holder"
                  value={holder}
                  onChange={(e) => setHolder(e.target.value)}
                />
              </Field>
            </Stack>
          </Stack>
        )}

        {/* ─── Section Open Banking ───────────────────────────────── */}
        {selectedMethod === 'OPEN_BANKING' && (
          <Stack spacing={1.5}>
            <Alert variant="info" className="text-[0.8rem]">
              <Info />
              <AlertDescription>En cliquant sur "Connecter ma banque" ci-dessous, vous serez redirigé vers le portail
              de votre banque pour signer le SCA bancaire. Le consent est valable 90 jours et permet à Baitly
              d'initier des virements SEPA depuis votre compte sans repasser par 2FA.</AlertDescription>
            </Alert>
            <Field>
              <FieldLabel htmlFor="payout-institution">Banque</FieldLabel>
              <NativeSelect
                id="payout-institution"
                className="w-full"
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                disabled={institutionsLoading}
              >
                {institutions && institutions.length > 0 ? (
                  // Liste dynamique GoCardless
                  institutions.map((inst) => (
                    <NativeSelectOption key={inst.id} value={inst.id}>
                      {inst.name}
                    </NativeSelectOption>
                  ))
                ) : (
                  // Fallback : liste codée en dur si l'API GoCardless n'est pas joignable
                  <>
                    <NativeSelectOption value="SANDBOXFINANCE_SFIN0000">
                      Sandbox Finance (test uniquement)
                    </NativeSelectOption>
                    <NativeSelectOption value="BNP_PARIBAS_BNPAFRPP">BNP Paribas</NativeSelectOption>
                    <NativeSelectOption value="SOCIETE_GENERALE_SOGEFRPP">Société Générale</NativeSelectOption>
                    <NativeSelectOption value="LCL_CRLYFRPP">LCL</NativeSelectOption>
                    <NativeSelectOption value="CREDIT_AGRICOLE_AGRIFRPP">Crédit Agricole</NativeSelectOption>
                    <NativeSelectOption value="CIC_CMCIFRPP">CIC</NativeSelectOption>
                    <NativeSelectOption value="BANQUE_POSTALE_PSSTFRPP">La Banque Postale</NativeSelectOption>
                    <NativeSelectOption value="HSBC_FR_CCFRFRPP">HSBC</NativeSelectOption>
                  </>
                )}
              </NativeSelect>
              <FieldDescription>
                {institutionsLoading
                  ? 'Chargement de la liste des banques…'
                  : institutions && institutions.length > 0
                    ? `${institutions.length} banques disponibles via GoCardless.`
                    : 'Liste GoCardless indisponible — utilisez la liste de secours ci-dessous ou Sandbox pour les tests.'}
              </FieldDescription>
            </Field>
            {currentConfig?.openBankingConsentActive && (
              <Alert variant="success" className="text-[0.8rem]">
                <CircleCheck />
                <AlertDescription>Consent SCA déjà actif{currentConfig.openBankingConsentExpiresAt
                  ? ` jusqu'au ${new Date(currentConfig.openBankingConsentExpiresAt).toLocaleDateString('fr-FR')}`
                  : ''}.</AlertDescription>
              </Alert>
            )}
          </Stack>
        )}

        {/* ─── Section Stripe Connect ─────────────────────────────── */}
        {selectedMethod === 'STRIPE_CONNECT' && (
          <Alert variant="info" className="text-[0.8rem]">
            <Info />
            <AlertDescription>{mode === 'self'
              ? "L'onboarding Stripe Connect se fait depuis la section dédiée plus bas dans Mes reversements."
              : "Le propriétaire doit compléter lui-même l'onboarding Stripe Connect via sa page Mes reversements."}{currentConfig?.stripeOnboardingComplete && (
              <span className="block mt-[3px] font-semibold" style={{ color: ACCENT }}>
                ✓ Onboarding Stripe complété pour ce propriétaire.
              </span>
            )}</AlertDescription>
          </Alert>
        )}

        {/* ─── Section Manual ──────────────────────────────────────── */}
        {selectedMethod === 'MANUAL' && (
          <Alert variant="warning" className="text-[0.8rem]">
            <TriangleAlert />
            <AlertDescription>Le propriétaire reçoit ses paiements hors-Baitly (espèces, chèque, virement perso).
            Aucune exécution automatique possible : les payouts devront être marqués comme payés à la main.</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="text-[0.8rem]">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        {/* Sortie de modale volontairement effacee (le sx d'origine la teintait
            en --muted) : ghost plutot que outline. */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={saving}
        >
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaveDisabled}
        >
          {saving ? <Spinner className="size-3.5" /> : <Save size={14} strokeWidth={1.75} />}
          {selectedMethod === 'OPEN_BANKING'
            ? 'Connecter ma banque'
            : saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
