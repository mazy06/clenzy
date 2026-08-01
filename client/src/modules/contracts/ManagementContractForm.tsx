import React from 'react';
import {
  Typography, TextField, MenuItem, FormControlLabel, Switch,
  InputAdornment, Tooltip,
} from '@mui/material';
import { cn } from '../../utils/cn';
import { Check, Home, Handshake } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type {
  CreateManagementContractRequest,
  ContractType,
  PaymentModel,
  CommissionBase,
  OtaFeeBearer,
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

export const OTA_FEE_BEARER_LABELS: Record<OtaFeeBearer, string> = {
  AGENCY: 'La conciergerie (déduits de sa commission)',
  OWNER:  'Le propriétaire (déduits de son reversement)',
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
  paymentModel: 'DIRECT',
  commissionBase: 'GROSS',
  otaFeeBorneBy: 'AGENCY',
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
  <div className="flex flex-col gap-2">
    <div>
      <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--faint)]">
        {label}
      </p>
      {hint && (
        <p className="cn-text-body1 text-[0.75rem] text-[var(--muted)] mt-0.5">
          {hint}
        </p>
      )}
    </div>
    {children}
  </div>
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
    <div className="flex flex-col gap-5">
      {/* ── Modèle d'accord (presets) ── */}
      <FormSection
        label="Modèle d'accord"
        hint="Choisissez un modèle pour préremplir le contrat, puis ajustez les détails."
      >
        <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[repeat(2,_1fr)] min-[900px]:grid-cols-[repeat(3,_1fr)] gap-[7.5px]">
          {CONTRACT_PRESETS.map(preset => {
            const active = isPresetActive(preset);
            return (
              <div
                key={preset.id}
                role="radio"
                aria-checked={active}
                tabIndex={0}
                onClick={() => applyPreset(preset)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyPreset(preset); } }}
                className={cn(
                  'relative cursor-pointer px-[9px] py-[7.5px] rounded-[12px] border border-solid',
                  'transition-[background-color,border-color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
                  'hover:border-[var(--accent)]',
                  'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] bg-transparent hover:bg-[var(--hover)]',
                )}
              >
                {active && (
                  <span className="absolute top-[8px] end-[8px] inline-flex items-center justify-center w-[16px] h-[16px] rounded-[50%] bg-[var(--accent)] text-[var(--on-accent)]">
                    <Check size={10} strokeWidth={2.5} />
                  </span>
                )}
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.3, pr: active ? 2.5 : 0, color: 'var(--ink)' }}>
                  {preset.label}
                </Typography>
                <p className="cn-text-body1 text-[0.75rem] text-[var(--muted)] leading-[1.45] mt-0.5">
                  {preset.description}
                </p>
              </div>
            );
          })}
        </div>
      </FormSection>

      {/* ── Logement ── */}
      <FormSection label="Logement">
        <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1.4fr_1fr] gap-3">
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
        </div>
      </FormSection>

      {/* ── Période ── */}
      <FormSection label="Période" hint="Sans date de fin, le contrat court jusqu'à résiliation.">
        <div className="grid grid-cols-[1fr_1fr] min-[900px]:grid-cols-[1fr_1fr_0.7fr_0.7fr] gap-3">
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
        </div>
      </FormSection>

      {/* ── Encaissement & commission (taxonomie OTA) ── */}
      <FormSection label="Encaissement & commission">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1.4fr_1fr_0.6fr] gap-3">
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
              select label="Frais OTA à la charge de" value={form.otaFeeBorneBy ?? 'AGENCY'}
              onChange={e => setForm(prev => ({ ...prev, otaFeeBorneBy: e.target.value as OtaFeeBearer }))}
              size="small" fullWidth
              helperText="Sur un séjour OTA, la plateforme retient sa commission avant de verser."
            >
              {(Object.entries(OTA_FEE_BEARER_LABELS) as [OtaFeeBearer, string][]).map(([key, label]) => (
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
          </div>
          <SplitPreviewBar commissionRate={form.commissionRate} splitRatios={splitRatios} />
        </div>
      </FormSection>

      {/* ── Services & inclusions ── */}
      <FormSection
        label="Services & inclusions"
        hint="Part conciergerie sur les ventes annexes. Vide = répartition par défaut de l'organisation."
      >
        <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-3 items-start">
          <div className="flex gap-3">
            <TextField
              label="Upsells" type="number"
              value={form.upsellCommissionRate != null ? Math.round(form.upsellCommissionRate * 100) : ''}
              onChange={e => setForm(prev => ({ ...prev, upsellCommissionRate: e.target.value ? Number(e.target.value) / 100 : null }))}
              size="small" fullWidth
              placeholder="Défaut org"
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              inputProps={{ min: 0, max: 100, step: 1, style: { fontVariantNumeric: 'tabular-nums' } }}
            />
          </div>
          <div className="flex gap-0.5 flex-wrap items-center min-h-[40px]">
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
          </div>
        </div>
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
    </div>
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
      <div className="flex flex-col gap-0.5">
        <div className="h-[8px] rounded-[6px] border border-dashed border-[var(--line-2)] bg-[transparent]" aria-label="Aucune commission définie" />
        <p className="cn-text-body1 text-[0.6875rem] text-[var(--faint)] italic">
          Saisissez un taux de commission pour voir la répartition appliquée à ce contrat.
        </p>
      </div>
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
    <div className="flex flex-col gap-1">
      {/* Barre segmentée */}
      <div className="flex h-[8px] rounded-[0.75px] overflow-hidden border border-[var(--line)] bg-[var(--field)]" role="img" aria-label={`Répartition : propriétaire ${ownerPct.toFixed(0)}%, plateforme ${platformPct.toFixed(1)}%, conciergerie ${conciergePct.toFixed(1)}%`}>
        {segments.map((seg) => (
          <Tooltip key={seg.label} title={`${seg.label} : ${seg.pct.toFixed(1)} %`} arrow>
            <div style={{ width: `${seg.pct}%`, backgroundColor: seg.color, transition: 'width 200ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
          </Tooltip>
        ))}
      </div>
      {/* Légende */}
      <div className="flex gap-2 flex-wrap">
        {segments.map((seg) => (
          <div className="flex items-center gap-0.5" key={seg.label}>
            <div className="w-[6px] h-[6px] rounded-[50%]" style={{ backgroundColor: seg.color }} />
            <p className="cn-text-body1 text-[0.6875rem] text-[var(--muted)] font-medium">
              {seg.label}
            </p>
            <p className="cn-text-body1 text-[0.6875rem] text-[var(--ink)] font-semibold tabular-nums">
              {seg.pct.toFixed(seg.pct >= 10 ? 0 : 1)} %
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
