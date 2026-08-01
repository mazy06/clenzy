import React, { useEffect, useMemo, useRef, useState } from 'react';
import TagChip from '../../components/TagChip';
import { Alert, AlertDescription } from '../../components/ui';
import { Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputAdornment, InputLabel, MenuItem, Select, Stack, Switch, TextField, Autocomplete, FormHelperText } from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';
import { usePropertiesList } from '../../hooks/usePropertiesList';
import {
  useCreateBookingVoucher,
  useUpdateBookingVoucher,
} from '../../hooks/useBookingVouchers';
import type {
  BookingVoucher,
  BookingVoucherCreateRequest,
  VoucherChannelScope,
  VoucherDiscountType,
  VoucherStatus,
  VoucherType,
} from '../../services/api/bookingVouchersApi';

interface Props {
  voucher: BookingVoucher | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** State du form (chaines pour les inputs, conversion au submit). */
interface FormState {
  name: string;
  description: string;
  code: string;
  type: VoucherType;
  discountType: VoucherDiscountType;
  discountValue: string;
  validFrom: string;
  validUntil: string;
  minStayNights: string;
  minTotalAmount: string;
  maxStayNights: string;
  maxUsesTotal: string;
  maxUsesPerGuest: string;
  channelScope: VoucherChannelScope;
  status: VoucherStatus;
  propertyIds: number[];
  applyToAllProperties: boolean;
}

function initFromVoucher(v: BookingVoucher | null): FormState {
  return {
    name: v?.name ?? '',
    description: v?.description ?? '',
    code: v?.code ?? '',
    type: v?.type ?? 'MANUAL_CODE',
    discountType: v?.discountType ?? 'PERCENTAGE',
    discountValue: v?.discountValue ?? '10',
    validFrom: v?.validFrom ? v.validFrom.slice(0, 16) : '',
    validUntil: v?.validUntil ? v.validUntil.slice(0, 16) : '',
    minStayNights: v?.minStayNights?.toString() ?? '',
    minTotalAmount: v?.minTotalAmount ?? '',
    maxStayNights: v?.maxStayNights?.toString() ?? '',
    maxUsesTotal: v?.maxUsesTotal?.toString() ?? '',
    maxUsesPerGuest: v?.maxUsesPerGuest?.toString() ?? '1',
    channelScope: v?.channelScope ?? 'ALL',
    status: v?.status ?? 'DRAFT',
    propertyIds: v?.propertyIds ?? [],
    applyToAllProperties: !v || v.propertyIds.length === 0,
  };
}

/**
 * Dialog create/edit d'un {@link BookingVoucher}.
 *
 * <p>Distinction MANUAL_CODE vs AUTO_CAMPAIGN faite via radio en haut du form.
 * Si AUTO_CAMPAIGN, le champ `code` est masque (il sera applique automatiquement
 * pour toutes les reservations eligibles).</p>
 *
 * <p>`applyToAllProperties` est un toggle UX qui se mappe sur le scope :
 * true → propertyIds vide (= toutes les properties de l'org), false →
 * Autocomplete multi-select obligatoire.</p>
 */
export default function VoucherEditorDialog({ voucher, open, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const isEdit = voucher !== null;
  const [form, setForm] = useState<FormState>(() => initFromVoucher(voucher));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Guard synchrone contre le double-submit (clic rapide avant que React
  // ne propage `isPending`). isPending est async, useRef est sync.
  const submittingRef = useRef(false);

  // Re-hydrate le form quand le voucher change (clic sur un autre voucher
  // sans demonter le dialog). Sans ce reset, l'utilisateur garderait les
  // valeurs du voucher precedent.
  useEffect(() => {
    if (open) {
      setForm(initFromVoucher(voucher));
      setErrorMsg(null);
      submittingRef.current = false;
    }
  }, [voucher, open]);

  const { properties = [] } = usePropertiesList();
  const createMutation = useCreateBookingVoucher();
  const updateMutation = useUpdateBookingVoucher();
  const saving = createMutation.isPending || updateMutation.isPending;

  const isAuto = form.type === 'AUTO_CAMPAIGN';
  const discountUnit = useMemo(() => {
    if (form.discountType === 'PERCENTAGE') return '%';
    if (form.discountType === 'FIXED_AMOUNT') return '€';
    return t('vouchers.editor.nights');
  }, [form.discountType, t]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    // Guard sync contre les double-clicks (avant que isPending ne se propage).
    if (submittingRef.current) return;
    setErrorMsg(null);
    // Validation client legere : Bean Validation backend fait l'autorite.
    if (!form.name.trim()) {
      setErrorMsg(t('vouchers.editor.errors.nameRequired'));
      return;
    }
    if (form.type === 'MANUAL_CODE' && !form.code.trim()) {
      setErrorMsg(t('vouchers.editor.errors.codeRequiredForManual'));
      return;
    }
    const discountNumber = Number(form.discountValue);
    if (!discountNumber || discountNumber <= 0) {
      setErrorMsg(t('vouchers.editor.errors.discountValueInvalid'));
      return;
    }
    if (form.discountType === 'PERCENTAGE' && discountNumber > 100) {
      setErrorMsg(t('vouchers.editor.errors.percentTooBig'));
      return;
    }
    submittingRef.current = true;

    const payload: BookingVoucherCreateRequest = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      code: isAuto ? null : form.code.trim().toUpperCase(),
      type: form.type,
      discountType: form.discountType,
      discountValue: discountNumber,
      validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
      validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
      minStayNights: form.minStayNights ? Number(form.minStayNights) : null,
      minTotalAmount: form.minTotalAmount ? Number(form.minTotalAmount) : null,
      maxStayNights: form.maxStayNights ? Number(form.maxStayNights) : null,
      maxUsesTotal: form.maxUsesTotal ? Number(form.maxUsesTotal) : null,
      maxUsesPerGuest: form.maxUsesPerGuest ? Number(form.maxUsesPerGuest) : null,
      channelScope: form.channelScope,
      status: form.status,
      propertyIds: form.applyToAllProperties ? [] : form.propertyIds,
    };

    try {
      if (isEdit && voucher) {
        await updateMutation.mutateAsync({ id: voucher.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSaved();
    } catch (e: any) {
      setErrorMsg(e?.message ?? t('vouchers.editor.errors.saveFailed'));
    } finally {
      submittingRef.current = false;
    }
  };

  const selectedPropertyIdSet = new Set(form.propertyIds);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEdit ? t('vouchers.editor.editTitle') : t('vouchers.editor.createTitle')}
      </DialogTitle>

      <DialogContent dividers>
        {errorMsg && <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>}

        <div className="grid grid-cols-12 gap-3">
          {/* Identite */}
          <div className="col-span-12 min-[900px]:col-span-8">
            <TextField
              fullWidth
              label={t('vouchers.editor.name')}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
              helperText={t('vouchers.editor.nameHelper')}
            />
          </div>
          <div className="col-span-12 min-[900px]:col-span-4">
            <FormControl fullWidth>
              <InputLabel>{t('vouchers.editor.status')}</InputLabel>
              <Select
                value={form.status}
                label={t('vouchers.editor.status')}
                onChange={(e) => update('status', e.target.value as VoucherStatus)}
              >
                <MenuItem value="DRAFT">{t('vouchers.status.DRAFT')}</MenuItem>
                <MenuItem value="ACTIVE">{t('vouchers.status.ACTIVE')}</MenuItem>
                <MenuItem value="PAUSED">{t('vouchers.status.PAUSED')}</MenuItem>
              </Select>
            </FormControl>
          </div>

          <div className="col-span-12">
            <TextField
              fullWidth
              label={t('vouchers.editor.description')}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              multiline
              rows={2}
            />
          </div>

          {/* Type + Code */}
          <div className="col-span-12 min-[900px]:col-span-6">
            <FormControl fullWidth>
              <InputLabel>{t('vouchers.editor.type')}</InputLabel>
              <Select
                value={form.type}
                label={t('vouchers.editor.type')}
                onChange={(e) => update('type', e.target.value as VoucherType)}
                disabled={isEdit}
              >
                <MenuItem value="MANUAL_CODE">{t('vouchers.typeManual')}</MenuItem>
                <MenuItem value="AUTO_CAMPAIGN">{t('vouchers.typeAuto')}</MenuItem>
              </Select>
              <FormHelperText>
                {isAuto ? t('vouchers.editor.typeAutoHelper') : t('vouchers.editor.typeManualHelper')}
              </FormHelperText>
            </FormControl>
          </div>
          <div className="col-span-12 min-[900px]:col-span-6">
            {!isAuto && (
              <TextField
                fullWidth
                label={t('vouchers.editor.code')}
                value={form.code}
                onChange={(e) => update('code', e.target.value.toUpperCase())}
                required
                placeholder="WELCOME20"
                inputProps={{ style: { fontFamily: 'monospace', letterSpacing: 1 } }}
                helperText={t('vouchers.editor.codeHelper')}
              />
            )}
          </div>

          {/* Discount */}
          <div className="col-span-12 min-[900px]:col-span-4">
            <FormControl fullWidth>
              <InputLabel>{t('vouchers.editor.discountType')}</InputLabel>
              <Select
                value={form.discountType}
                label={t('vouchers.editor.discountType')}
                onChange={(e) => update('discountType', e.target.value as VoucherDiscountType)}
              >
                <MenuItem value="PERCENTAGE">{t('vouchers.editor.discountPercentage')}</MenuItem>
                <MenuItem value="FIXED_AMOUNT">{t('vouchers.editor.discountFixed')}</MenuItem>
                <MenuItem value="FREE_NIGHTS" disabled>
                  {t('vouchers.editor.discountFreeNights')} ({t('vouchers.editor.comingSoon')})
                </MenuItem>
              </Select>
            </FormControl>
          </div>
          <div className="col-span-12 min-[900px]:col-span-4">
            <TextField
              fullWidth
              label={t('vouchers.editor.discountValue')}
              type="number"
              value={form.discountValue}
              onChange={(e) => update('discountValue', e.target.value)}
              InputProps={{
                endAdornment: <InputAdornment position="end">{discountUnit}</InputAdornment>,
              }}
              required
            />
          </div>
          <div className="col-span-12 min-[900px]:col-span-4">
            <FormControl fullWidth>
              <InputLabel>{t('vouchers.editor.channelScope')}</InputLabel>
              <Select
                value={form.channelScope}
                label={t('vouchers.editor.channelScope')}
                onChange={(e) => update('channelScope', e.target.value as VoucherChannelScope)}
              >
                <MenuItem value="ALL">{t('vouchers.editor.channelAll')}</MenuItem>
                <MenuItem value="BOOKING_ENGINE">{t('vouchers.editor.channelBookingEngine')}</MenuItem>
                <MenuItem value="DIRECT_LINK">{t('vouchers.editor.channelDirectLink')}</MenuItem>
                <MenuItem value="WHATSAPP">WhatsApp</MenuItem>
                <MenuItem value="EMAIL">Email</MenuItem>
              </Select>
            </FormControl>
          </div>

          {/* Validite */}
          <div className="col-span-12 min-[900px]:col-span-6">
            <TextField
              fullWidth
              label={t('vouchers.editor.validFrom')}
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => update('validFrom', e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText={t('vouchers.editor.validFromHelper')}
            />
          </div>
          <div className="col-span-12 min-[900px]:col-span-6">
            <TextField
              fullWidth
              label={t('vouchers.editor.validUntil')}
              type="datetime-local"
              value={form.validUntil}
              onChange={(e) => update('validUntil', e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText={t('vouchers.editor.validUntilHelper')}
            />
          </div>

          {/* Limites usage */}
          <div className="col-span-12 min-[900px]:col-span-6">
            <TextField
              fullWidth
              label={t('vouchers.editor.maxUsesTotal')}
              type="number"
              value={form.maxUsesTotal}
              onChange={(e) => update('maxUsesTotal', e.target.value)}
              helperText={t('vouchers.editor.maxUsesTotalHelper')}
            />
          </div>
          <div className="col-span-12 min-[900px]:col-span-6">
            <TextField
              fullWidth
              label={t('vouchers.editor.maxUsesPerGuest')}
              type="number"
              value={form.maxUsesPerGuest}
              onChange={(e) => update('maxUsesPerGuest', e.target.value)}
              helperText={t('vouchers.editor.maxUsesPerGuestHelper')}
            />
          </div>

          {/* Contraintes sejour */}
          <div className="col-span-12 min-[900px]:col-span-4">
            <TextField
              fullWidth
              label={t('vouchers.editor.minStayNights')}
              type="number"
              value={form.minStayNights}
              onChange={(e) => update('minStayNights', e.target.value)}
            />
          </div>
          <div className="col-span-12 min-[900px]:col-span-4">
            <TextField
              fullWidth
              label={t('vouchers.editor.maxStayNights')}
              type="number"
              value={form.maxStayNights}
              onChange={(e) => update('maxStayNights', e.target.value)}
            />
          </div>
          <div className="col-span-12 min-[900px]:col-span-4">
            <TextField
              fullWidth
              label={t('vouchers.editor.minTotalAmount')}
              type="number"
              value={form.minTotalAmount}
              onChange={(e) => update('minTotalAmount', e.target.value)}
              InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
            />
          </div>

          {/* Scope properties */}
          <div className="col-span-12">
            <Stack direction="row" spacing={1} alignItems="center">
              <Switch
                checked={form.applyToAllProperties}
                onChange={(e) => update('applyToAllProperties', e.target.checked)}
              />
              <p className="cn-text-body2">
                {t('vouchers.editor.applyToAll')}
              </p>
            </Stack>
            {!form.applyToAllProperties && (
              <Autocomplete
                multiple
                options={properties}
                getOptionLabel={(p) => p.name ?? `Property #${p.id}`}
                value={properties.filter((p) => selectedPropertyIdSet.has(Number(p.id)))}
                onChange={(_, sel) => update('propertyIds', sel.map((p) => Number(p.id)))}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <TagChip key={key} label={option.name} {...tagProps} />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('vouchers.editor.targetProperties')}
                    placeholder={t('vouchers.editor.targetPropertiesPlaceholder')}
                  />
                )}
                sx={{ mt: 1 }}
              />
            )}
          </div>
        </div>
      </DialogContent>

      <DialogActions>
        <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button variant="default" onClick={handleSubmit} disabled={saving}>
          {saving ? t('common.saving') : isEdit ? t('common.save') : t('common.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
