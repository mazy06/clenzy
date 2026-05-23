import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  CircularProgress,
  IconButton,
  Stack,
  Chip,
  MenuItem,
} from '@mui/material';
import { Close as CloseIcon, Save } from '../../../icons';
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

const ACCENT = '#4A9B8E';
const PRIMARY = '#6B8A9A';
const NEUTRAL = '#8A8378';
const WARM = '#D4A574';

const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

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
    description: 'Génération XML pain.001 + upload manuel sur le portail bancaire Clenzy.',
    badge: 'SEMI-AUTO',
    badgeColor: WARM,
  },
  {
    value: 'MANUAL',
    label: 'Manuel',
    description: 'Paiement hors-Clenzy (espèces, chèque, virement perso). Aucune automatisation.',
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

  const saveSepaOrWise = async () => {
    const trimmed = iban.trim();

    // Cas 1 : champ contient encore le mask OU est vide
    //   → l'utilisateur veut préserver l'IBAN existant, on switch juste la méthode
    if (ibanUnchanged || !trimmed) {
      if (!hasExistingIban) {
        setIbanError("Veuillez saisir l'IBAN du compte destinataire.");
        return;
      }
      await switchMethodOnly(selectedMethod);
      return;
    }

    // Cas 2 : nouvel IBAN saisi → validation + update complet
    const cleanIban = trimmed.replace(/\s+/g, '').toUpperCase();
    if (!IBAN_REGEX.test(cleanIban)) {
      setIbanError('Format IBAN invalide (ex: FR76 1234 5678 9012 3456 7890 123).');
      return;
    }
    if (!holder.trim()) {
      setIbanError('Titulaire du compte requis.');
      return;
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
  };

  const initOpenBanking = async () => {
    if (!institutionId.trim()) {
      setError('Banque requise');
      return;
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
  };

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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setIbanError('');
    try {
      switch (selectedMethod) {
        case 'SEPA_TRANSFER':
        case 'WISE':
          await saveSepaOrWise();
          break;
        case 'OPEN_BANKING':
          await initOpenBanking();
          return; // pas de close — on redirige vers le SCA
        case 'STRIPE_CONNECT':
        case 'MANUAL':
          await switchMethodOnly(selectedMethod);
          break;
      }
      // Si on a setIbanError mais pas thrown, le save n'a pas eu lieu : on garde la modale ouverte
      if (ibanError) {
        setSaving(false);
        return;
      }
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
        <Box>
          Méthode de reversement
          {ownerName && (
            <Typography
              component="span"
              sx={{ display: 'block', fontSize: '0.72rem', fontWeight: 400, color: 'text.secondary', mt: 0.25 }}
            >
              Propriétaire : {ownerName}
            </Typography>
          )}
        </Box>
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
              <Box
                key={opt.value}
                sx={{
                  border: '1px solid',
                  borderColor: selectedMethod === opt.value ? ACCENT : 'divider',
                  backgroundColor: selectedMethod === opt.value ? `${ACCENT}08` : 'transparent',
                  borderRadius: '8px',
                  px: 1.5,
                  py: 1,
                  cursor: 'pointer',
                  transition: 'border-color 150ms, background-color 150ms',
                  '&:hover': { borderColor: `${ACCENT}88`, backgroundColor: `${ACCENT}05` },
                }}
                onClick={() => setSelectedMethod(opt.value)}
              >
                <FormControlLabel
                  value={opt.value}
                  control={<Radio size="small" sx={{ p: 0.5, mr: 1 }} />}
                  label={
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875 }}>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {opt.label}
                        </Typography>
                        {opt.badge && (
                          <Chip
                            label={opt.badge}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              bgcolor: `${opt.badgeColor}14`,
                              color: opt.badgeColor,
                              border: `1px solid ${opt.badgeColor}33`,
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        )}
                      </Box>
                      <Typography
                        sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.4, mt: 0.25 }}
                      >
                        {opt.description}
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
                />
              </Box>
            ))}
          </RadioGroup>
        </FormControl>

        {/* ─── Section IBAN (SEPA + Wise) ─────────────────────────── */}
        {requiresIban && (
          <Stack spacing={1.5}>
            <Alert severity="info" sx={{ borderRadius: '8px', fontSize: '0.8rem' }}>
              {hasExistingIban
                ? 'Les coordonnées bancaires actuelles sont affichées et conservées par défaut. Cliquez dans le champ IBAN pour saisir un nouveau numéro — sinon, gardez les valeurs existantes.'
                : selectedMethod === 'WISE'
                ? 'Wise utilisera ces coordonnées pour créer le recipient. Le virement sera converti automatiquement dans la devise du compte destinataire.'
                : 'Coordonnées du compte destinataire utilisées pour le fichier SEPA pain.001 et le virement bancaire.'}
            </Alert>
            <TextField
              label="IBAN"
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
              error={!!ibanError}
              helperText={
                ibanError ||
                (hasExistingIban
                  ? ibanUnchanged
                    ? 'IBAN actuel conservé. Tapez un nouvel IBAN pour le remplacer.'
                    : 'Nouvel IBAN. Format : FR76 1234 5678 9012 3456 7890 123'
                  : 'Format : FR76 1234 5678 9012 3456 7890 123')
              }
              size="small"
              fullWidth
              InputProps={{
                sx: { fontFamily: 'monospace', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' },
              }}
            />
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="BIC / SWIFT"
                value={bic}
                onChange={(e) => setBic(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                InputProps={{
                  sx: { fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em', textTransform: 'uppercase' },
                }}
              />
              <TextField
                label="Titulaire du compte"
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                size="small"
                sx={{ flex: 2 }}
              />
            </Stack>
          </Stack>
        )}

        {/* ─── Section Open Banking ───────────────────────────────── */}
        {selectedMethod === 'OPEN_BANKING' && (
          <Stack spacing={1.5}>
            <Alert severity="info" sx={{ borderRadius: '8px', fontSize: '0.8rem' }}>
              En cliquant sur "Connecter ma banque" ci-dessous, vous serez redirigé vers le portail
              de votre banque pour signer le SCA bancaire. Le consent est valable 90 jours et permet à Clenzy
              d'initier des virements SEPA depuis votre compte sans repasser par 2FA.
            </Alert>
            <TextField
              label="Banque"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              size="small"
              fullWidth
              select
              disabled={institutionsLoading}
              helperText={
                institutionsLoading
                  ? 'Chargement de la liste des banques…'
                  : institutions && institutions.length > 0
                    ? `${institutions.length} banques disponibles via GoCardless.`
                    : 'Liste GoCardless indisponible — utilisez la liste de secours ci-dessous ou Sandbox pour les tests.'
              }
            >
              {institutions && institutions.length > 0 ? (
                // Liste dynamique GoCardless
                institutions.map((inst) => (
                  <MenuItem key={inst.id} value={inst.id} sx={{ fontSize: '0.82rem' }}>
                    {inst.name}
                  </MenuItem>
                ))
              ) : (
                // Fallback : liste codée en dur si l'API GoCardless n'est pas joignable
                <>
                  <MenuItem value="SANDBOXFINANCE_SFIN0000" sx={{ fontSize: '0.82rem' }}>
                    Sandbox Finance (test uniquement)
                  </MenuItem>
                  <MenuItem value="BNP_PARIBAS_BNPAFRPP" sx={{ fontSize: '0.82rem' }}>BNP Paribas</MenuItem>
                  <MenuItem value="SOCIETE_GENERALE_SOGEFRPP" sx={{ fontSize: '0.82rem' }}>Société Générale</MenuItem>
                  <MenuItem value="LCL_CRLYFRPP" sx={{ fontSize: '0.82rem' }}>LCL</MenuItem>
                  <MenuItem value="CREDIT_AGRICOLE_AGRIFRPP" sx={{ fontSize: '0.82rem' }}>Crédit Agricole</MenuItem>
                  <MenuItem value="CIC_CMCIFRPP" sx={{ fontSize: '0.82rem' }}>CIC</MenuItem>
                  <MenuItem value="BANQUE_POSTALE_PSSTFRPP" sx={{ fontSize: '0.82rem' }}>La Banque Postale</MenuItem>
                  <MenuItem value="HSBC_FR_CCFRFRPP" sx={{ fontSize: '0.82rem' }}>HSBC</MenuItem>
                </>
              )}
            </TextField>
            {currentConfig?.openBankingConsentActive && (
              <Alert severity="success" sx={{ borderRadius: '8px', fontSize: '0.8rem' }}>
                Consent SCA déjà actif{currentConfig.openBankingConsentExpiresAt
                  ? ` jusqu'au ${new Date(currentConfig.openBankingConsentExpiresAt).toLocaleDateString('fr-FR')}`
                  : ''}.
              </Alert>
            )}
          </Stack>
        )}

        {/* ─── Section Stripe Connect ─────────────────────────────── */}
        {selectedMethod === 'STRIPE_CONNECT' && (
          <Alert severity="info" sx={{ borderRadius: '8px', fontSize: '0.8rem' }}>
            {mode === 'self'
              ? "L'onboarding Stripe Connect se fait depuis la section dédiée plus bas dans Mes reversements."
              : "Le propriétaire doit compléter lui-même l'onboarding Stripe Connect via sa page Mes reversements."}
            {currentConfig?.stripeOnboardingComplete && (
              <Box component="span" sx={{ display: 'block', mt: 0.5, color: ACCENT, fontWeight: 600 }}>
                ✓ Onboarding Stripe complété pour ce propriétaire.
              </Box>
            )}
          </Alert>
        )}

        {/* ─── Section Manual ──────────────────────────────────────── */}
        {selectedMethod === 'MANUAL' && (
          <Alert severity="warning" sx={{ borderRadius: '8px', fontSize: '0.8rem' }}>
            Le propriétaire reçoit ses paiements hors-Clenzy (espèces, chèque, virement perso).
            Aucune exécution automatique possible : les payouts devront être marqués comme payés à la main.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ borderRadius: '8px', fontSize: '0.8rem' }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={saving}
          size="small"
          sx={{
            textTransform: 'none',
            fontSize: '0.78rem',
            fontWeight: 600,
            borderRadius: '8px',
            color: NEUTRAL,
          }}
        >
          Annuler
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={isSaveDisabled}
          startIcon={
            saving ? <CircularProgress size={14} color="inherit" /> : <Save size={14} strokeWidth={1.75} />
          }
          sx={{
            textTransform: 'none',
            fontSize: '0.78rem',
            fontWeight: 600,
            borderRadius: '8px',
            bgcolor: ACCENT,
            color: '#fff',
            boxShadow: 'none',
            '&:hover': { bgcolor: ACCENT, filter: 'brightness(0.94)' },
          }}
        >
          {selectedMethod === 'OPEN_BANKING'
            ? 'Connecter ma banque'
            : saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
