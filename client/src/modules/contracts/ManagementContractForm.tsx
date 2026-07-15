import React from 'react';
import {
  Box, Typography, TextField, MenuItem, FormControlLabel, Switch,
  InputAdornment, Tooltip,
} from '@mui/material';
import { Check, Home, Handshake } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type {
  CreateManagementContractRequest,
  ContractType,
  PaymentModel,
  CommissionBase,
} from '../../services/api/managementContractsApi';
import type { SplitRatios } from '../../types/payment';

// ─── Domain labels (partagés page /contracts + modals) ──────────────────────

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  FULL_MANAGEMENT:  'Gestion complète',
  BOOKING_ONLY:     'Réservations uniquement',
  MAINTENANCE_ONLY: 'Maintenance uniquement',
  CUSTOM:           'Personnalisé',
};

// ─── Taxonomie OTA : qui encaisse le paiement guest ─────────────────────────

export const PAYMENT_MODEL_LABELS: Record<PaymentModel, string> = {
  DIRECT:             'Direct — Clenzy encaisse (Stripe)',
  OWNER_COLLECTS:     'OTA — Le propriétaire encaisse',
  CONCIERGE_COLLECTS: 'OTA — La conciergerie encaisse',
  OTA_COHOST_SPLIT:   'OTA — Co-hosting (split à la source)',
};

export const PAYMENT_MODEL_HELP: Record<PaymentModel, string> = {
  DIRECT:             'Le guest paie via Clenzy (Stripe). La répartition est appliquée automatiquement à l\'encaissement.',
  OWNER_COLLECTS:     'L\'OTA verse au propriétaire. La conciergerie facture sa commission au propriétaire (créance).',
  CONCIERGE_COLLECTS: 'L\'OTA verse à la conciergerie. Elle reverse la part nette au propriétaire (reversement).',
  OTA_COHOST_SPLIT:   'L\'OTA répartit directement entre les co-hosts. Clenzy réconcilie, sans flux d\'argent.',
};

export const COMMISSION_BASE_LABELS: Record<CommissionBase, string> = {
  GROSS:          'Montant brut (loyer encaissé)',
  NET_OF_OTA_FEE: 'Net des frais OTA (après commission plateforme)',
};

/**
 * Préconfigurations : selon l'accord conciergerie ↔ hôte, on préremplit un jeu de
 * valeurs cohérent. L'utilisateur ajuste ensuite les détails avant transmission.
 */
export interface ContractPreset {
  id: string;
  label: string;
  description: string;
  values: Partial<CreateManagementContractRequest>;
}

export const CONTRACT_PRESETS: ContractPreset[] = [
  {
    id: 'full-concierge',
    label: 'Gestion complète — Conciergerie encaisse',
    description: 'La conciergerie gère tout et encaisse les OTA, puis reverse au propriétaire.',
    values: {
      contractType: 'FULL_MANAGEMENT', paymentModel: 'CONCIERGE_COLLECTS',
      commissionRate: 0.20, commissionBase: 'GROSS',
      cleaningFeeIncluded: true, maintenanceIncluded: true,
    },
  },
  {
    id: 'full-owner',
    label: 'Gestion complète — Propriétaire encaisse',
    description: 'Le propriétaire reçoit les versements OTA ; la conciergerie facture sa commission.',
    values: {
      contractType: 'FULL_MANAGEMENT', paymentModel: 'OWNER_COLLECTS',
      commissionRate: 0.20, commissionBase: 'GROSS',
      cleaningFeeIncluded: true, maintenanceIncluded: true,
    },
  },
  {
    id: 'cohost',
    label: 'Co-hosting Airbnb (split à la source)',
    description: 'Airbnb répartit directement entre co-hosts. Aucun flux ne transite par Clenzy.',
    values: {
      contractType: 'BOOKING_ONLY', paymentModel: 'OTA_COHOST_SPLIT',
      commissionRate: 0.15, commissionBase: 'GROSS',
    },
  },
  {
    id: 'direct',
    label: 'Paiement direct (Clenzy encaisse)',
    description: 'Le guest paie via Stripe. La répartition est automatique à l\'encaissement.',
    values: {
      contractType: 'FULL_MANAGEMENT', paymentModel: 'DIRECT',
      commissionRate: 0.20, commissionBase: 'GROSS',
    },
  },
  {
    id: 'booking-light',
    label: 'Conciergerie légère — Réservations seules',
    description: 'Apport de réservations uniquement, commission réduite sur le net OTA.',
    values: {
      contractType: 'BOOKING_ONLY', paymentModel: 'OWNER_COLLECTS',
      commissionRate: 0.12, commissionBase: 'NET_OF_OTA_FEE',
    },
  },
];

export interface PropertyOption { id: number; name: string; ownerId: number; ownerName?: string }

export const EMPTY_FORM: CreateManagementContractRequest = {
  propertyId: 0,
  ownerId: 0,
  contractType: 'FULL_MANAGEMENT',
  startDate: new Date().toISOString().split('T')[0],
  endDate: null,
  commissionRate: 0,
  minimumStayNights: null,
  autoRenew: false,
  noticePeriodDays: 30,
  cleaningFeeIncluded: true,
  maintenanceIncluded: true,
  upsellCommissionRate: null,
  activityCommissionRate: null,
  paymentModel: 'DIRECT',
  commissionBase: 'GROSS',
  notes: '',
};

// ─── Section helper ──────────────────────────────────────────────────────────

interface FormSectionProps {
  /** Titre de la section (capitales discrètes). */
  label: string;
  /** Précision facultative affichée sous le titre. */
  hint?: string;
  children: React.ReactNode;
}

/**
 * Section du formulaire : titre en petites capitales + contenu, avec un rythme
 * vertical généreux pour une lecture aérée dans la modal.
 */
const FormSection: React.FC<FormSectionProps> = ({ label, hint, children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Box>
      <Typography
        sx={{
          fontSize: '10.5px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--faint)',
        }}
      >
        {label}
      </Typography>
      {hint && (
        <Typography sx={{ fontSize: '0.75rem', color: 'var(--muted)', mt: 0.25 }}>
          {hint}
        </Typography>
      )}
    </Box>
    {children}
  </Box>
);

// ─── Reusable contract form fields ───────────────────────────────────────────

export interface ManagementContractFormFieldsProps {
  form: CreateManagementContractRequest;
  setForm: React.Dispatch<React.SetStateAction<CreateManagementContractRequest>>;
  properties: PropertyOption[];
  splitRatios: SplitRatios | null;
  /** Verrouille le sélecteur de logement (modal liée à une propriété donnée). */
  lockProperty?: boolean;
}

/**
 * Champs du formulaire de contrat, organisés en sections aérées : modèle
 * d'accord (presets), logement, période, conditions financières, services et
 * notes. Partagés entre la modal de création/édition et la modal obligatoire
 * à la création de propriété.
 */
export const ManagementContractFormFields: React.FC<ManagementContractFormFieldsProps> = ({
  form, setForm, properties, splitRatios, lockProperty = false,
}) => {
  const { t } = useTranslation();

  const applyPreset = (preset: ContractPreset) => {
    setForm(prev => ({ ...prev, ...preset.values }));
  };
  const isPresetActive = (preset: ContractPreset) =>
    (Object.keys(preset.values) as (keyof CreateManagementContractRequest)[])
      .every(k => form[k] === preset.values[k]);
  const handlePropertyChange = (propertyId: number) => {
    const prop = properties.find(p => p.id === propertyId);
    setForm(prev => ({ ...prev, propertyId, ownerId: prop?.ownerId ?? prev.ownerId }));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
      {/* ── Modèle d'accord (presets) ── */}
      <FormSection
        label="Modèle d'accord"
        hint="Choisissez un modèle pour préremplir le contrat, puis ajustez les détails."
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1.25,
          }}
        >
          {CONTRACT_PRESETS.map(preset => {
            const active = isPresetActive(preset);
            return (
              <Box
                key={preset.id}
                role="radio"
                aria-checked={active}
                tabIndex={0}
                onClick={() => applyPreset(preset)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyPreset(preset); } }}
                sx={{
                  position: 'relative',
                  cursor: 'pointer',
                  px: 1.5, py: 1.25,
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: active ? 'var(--accent)' : 'var(--line)',
                  bgcolor: active ? 'var(--accent-soft)' : 'transparent',
                  transition: 'background-color 180ms cubic-bezier(0.16, 1, 0.3, 1), border-color 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                  '&:hover': { borderColor: 'var(--accent)', bgcolor: active ? 'var(--accent-soft)' : 'var(--hover)' },
                  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                }}
              >
                {active && (
                  <Box
                    component="span"
                    sx={{
                      position: 'absolute', top: 8, right: 8,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 16, height: 16, borderRadius: '50%',
                      bgcolor: 'var(--accent)', color: 'var(--on-accent)',
                    }}
                  >
                    <Check size={10} strokeWidth={2.5} />
                  </Box>
                )}
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.3, pr: active ? 2.5 : 0, color: 'var(--ink)' }}>
                  {preset.label}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.45, mt: 0.5 }}>
                  {preset.description}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </FormSection>

      {/* ── Logement ── */}
      <FormSection label="Logement">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr' }, gap: 2 }}>
          <TextField
            select label={t('contracts.property')} value={form.propertyId || ''}
            onChange={e => handlePropertyChange(Number(e.target.value))}
            size="small" fullWidth
            disabled={lockProperty}
            InputProps={{ startAdornment: <InputAdornment position="start"><Home size={15} strokeWidth={1.75} /></InputAdornment> }}
          >
            {properties.map(p => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}{p.ownerName ? ` (${p.ownerName})` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select label={t('contracts.type')} value={form.contractType}
            onChange={e => setForm(prev => ({ ...prev, contractType: e.target.value as ContractType }))}
            size="small" fullWidth
          >
            {(Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).map(([key, label]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </TextField>
        </Box>
      </FormSection>

      {/* ── Période ── */}
      <FormSection label="Période" hint="Sans date de fin, le contrat court jusqu'à résiliation.">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 0.7fr 0.7fr' }, gap: 2 }}>
          <TextField
            label={t('contracts.startDate')} type="date" value={form.startDate}
            onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
            size="small" fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={t('contracts.endDate')} type="date" value={form.endDate ?? ''}
            onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value || null }))}
            size="small" fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Nuits min." type="number"
            value={form.minimumStayNights ?? ''}
            onChange={e => setForm(prev => ({ ...prev, minimumStayNights: e.target.value ? Number(e.target.value) : null }))}
            size="small" fullWidth
            inputProps={{ min: 1, style: { fontVariantNumeric: 'tabular-nums' } }}
          />
          <TextField
            label="Préavis" type="number"
            value={form.noticePeriodDays ?? 30}
            onChange={e => setForm(prev => ({ ...prev, noticePeriodDays: Number(e.target.value) }))}
            size="small" fullWidth
            InputProps={{ endAdornment: <InputAdornment position="end">j</InputAdornment> }}
            inputProps={{ min: 0, style: { fontVariantNumeric: 'tabular-nums' } }}
          />
        </Box>
      </FormSection>

      {/* ── Encaissement & commission (taxonomie OTA) ── */}
      <FormSection label="Encaissement & commission">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr 0.6fr' }, gap: 2 }}>
            <TextField
              select label="Qui encaisse le paiement guest ?" value={form.paymentModel ?? 'DIRECT'}
              onChange={e => setForm(prev => ({ ...prev, paymentModel: e.target.value as PaymentModel }))}
              size="small" fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><Handshake size={15} strokeWidth={1.75} /></InputAdornment> }}
              helperText={PAYMENT_MODEL_HELP[form.paymentModel ?? 'DIRECT']}
            >
              {(Object.entries(PAYMENT_MODEL_LABELS) as [PaymentModel, string][]).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select label="Base de commission" value={form.commissionBase ?? 'GROSS'}
              onChange={e => setForm(prev => ({ ...prev, commissionBase: e.target.value as CommissionBase }))}
              size="small" fullWidth
            >
              {(Object.entries(COMMISSION_BASE_LABELS) as [CommissionBase, string][]).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Commission" type="number"
              value={form.commissionRate > 0 ? Math.round(form.commissionRate * 100) : ''}
              onChange={e => setForm(prev => ({ ...prev, commissionRate: e.target.value ? Number(e.target.value) / 100 : 0 }))}
              size="small" fullWidth
              placeholder="—"
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              inputProps={{ min: 1, max: 50, step: 1, style: { fontVariantNumeric: 'tabular-nums' } }}
            />
          </Box>
          <SplitPreviewBar commissionRate={form.commissionRate} splitRatios={splitRatios} />
        </Box>
      </FormSection>

      {/* ── Services & inclusions ── */}
      <FormSection
        label="Services & inclusions"
        hint="Part conciergerie sur les ventes annexes. Vide = répartition par défaut de l'organisation."
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Upsells" type="number"
              value={form.upsellCommissionRate != null ? Math.round(form.upsellCommissionRate * 100) : ''}
              onChange={e => setForm(prev => ({ ...prev, upsellCommissionRate: e.target.value ? Number(e.target.value) / 100 : null }))}
              size="small" fullWidth
              placeholder="Défaut org"
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              inputProps={{ min: 0, max: 100, step: 1, style: { fontVariantNumeric: 'tabular-nums' } }}
            />
            <TextField
              label="Marketplace" type="number"
              value={form.activityCommissionRate != null ? Math.round(form.activityCommissionRate * 100) : ''}
              onChange={e => setForm(prev => ({ ...prev, activityCommissionRate: e.target.value ? Number(e.target.value) / 100 : null }))}
              size="small" fullWidth
              placeholder="Défaut org"
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              inputProps={{ min: 0, max: 100, step: 1, style: { fontVariantNumeric: 'tabular-nums' } }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center', minHeight: 40 }}>
            <FormControlLabel
              control={<Switch size="small" checked={form.autoRenew ?? false} onChange={e => setForm(prev => ({ ...prev, autoRenew: e.target.checked }))} />}
              label="Renouvellement auto"
              sx={{ mr: 1.5, '& .MuiFormControlLabel-label': { fontSize: '0.8125rem' } }}
            />
            <FormControlLabel
              control={<Switch size="small" checked={form.cleaningFeeIncluded ?? true} onChange={e => setForm(prev => ({ ...prev, cleaningFeeIncluded: e.target.checked }))} />}
              label="Ménage inclus"
              sx={{ mr: 1.5, '& .MuiFormControlLabel-label': { fontSize: '0.8125rem' } }}
            />
            <FormControlLabel
              control={<Switch size="small" checked={form.maintenanceIncluded ?? true} onChange={e => setForm(prev => ({ ...prev, maintenanceIncluded: e.target.checked }))} />}
              label="Maintenance incluse"
              sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.8125rem' } }}
            />
          </Box>
        </Box>
      </FormSection>

      {/* ── Notes ── */}
      <FormSection label="Notes">
        <TextField
          value={form.notes ?? ''}
          onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
          size="small"
          fullWidth
          multiline
          minRows={2}
          placeholder="Détails complémentaires, conditions particulières… (optionnel)"
        />
      </FormSection>
    </Box>
  );
};

// ─── Split preview bar ───────────────────────────────────────────────────────

interface SplitPreviewBarProps {
  commissionRate: number;
  splitRatios: SplitRatios | null;
}

/**
 * Barre visuelle qui montre la répartition réelle d'un paiement :
 *  propriétaire (gris bleuté) · plateforme (or) · conciergerie (vert).
 *
 * Si aucune commission n'est encore définie (rate <= 0), affiche un placeholder
 * neutre au lieu de pourcentages calculés sur des valeurs non saisies.
 * La barre est entièrement réactive à `commissionRate` (mise à jour instantanée
 * dès que l'utilisateur tape).
 */
const SplitPreviewBar: React.FC<SplitPreviewBarProps> = ({ commissionRate, splitRatios }) => {
  const commissionPct = (commissionRate ?? 0) * 100;
  const hasCommission = commissionPct > 0;

  // État vide : aucune commission saisie → pas de calcul, juste un repère visuel.
  if (!hasCommission) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box
          sx={{
            height: 8,
            borderRadius: 0.75,
            border: '1px dashed',
            borderColor: 'var(--line-2)',
            bgcolor: 'transparent',
          }}
          aria-label="Aucune commission définie"
        />
        <Typography sx={{ fontSize: '0.6875rem', color: 'var(--faint)', fontStyle: 'italic' }}>
          Saisissez un taux de commission pour voir la répartition appliquée à ce contrat.
        </Typography>
      </Box>
    );
  }

  const ownerPct = 100 - commissionPct;
  const platformBase = splitRatios?.platformShare ?? 0.05;
  const conciergeBase = splitRatios?.conciergeShare ?? 0.15;
  const commissionTotal = platformBase + conciergeBase;
  const platformRatio = commissionTotal > 0 ? platformBase / commissionTotal : 0.25;
  const conciergeRatio = commissionTotal > 0 ? conciergeBase / commissionTotal : 0.75;
  const platformPct = commissionPct * platformRatio;
  const conciergePct = commissionPct * conciergeRatio;

  const OWNER_COLOR = 'var(--accent)';
  const PLATFORM_COLOR = 'var(--warn)';
  const CONCIERGE_COLOR = 'var(--ok)';

  const segments = [
    { label: 'Propriétaire', pct: ownerPct, color: OWNER_COLOR },
    { label: 'Plateforme',   pct: platformPct, color: PLATFORM_COLOR },
    { label: 'Conciergerie', pct: conciergePct, color: CONCIERGE_COLOR },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {/* Barre segmentée */}
      <Box
        sx={{
          display: 'flex',
          height: 8,
          borderRadius: 0.75,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'var(--line)',
          bgcolor: 'var(--field)',
        }}
        role="img"
        aria-label={`Répartition : propriétaire ${ownerPct.toFixed(0)}%, plateforme ${platformPct.toFixed(1)}%, conciergerie ${conciergePct.toFixed(1)}%`}
      >
        {segments.map((seg) => (
          <Tooltip key={seg.label} title={`${seg.label} : ${seg.pct.toFixed(1)} %`} arrow>
            <Box
              sx={{
                width: `${seg.pct}%`,
                bgcolor: seg.color,
                transition: 'width 200ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </Tooltip>
        ))}
      </Box>
      {/* Légende */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {segments.map((seg) => (
          <Box key={seg.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 6, height: 6, borderRadius: '50%',
                bgcolor: seg.color,
              }}
            />
            <Typography sx={{ fontSize: '0.6875rem', color: 'var(--muted)', fontWeight: 500 }}>
              {seg.label}
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {seg.pct.toFixed(seg.pct >= 10 ? 0 : 1)} %
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
