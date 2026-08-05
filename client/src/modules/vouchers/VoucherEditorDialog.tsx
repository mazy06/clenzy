import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { Button } from '../../components/ui';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  NativeSelect,
  NativeSelectOption,
  Switch,
  Textarea,
  useComboboxAnchor,
} from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { usePropertiesList, type PropertyListItem } from '../../hooks/usePropertiesList';
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

/** Libelle affiche d'un logement dans le multi-select (repli sur l'id si sans nom). */
const propertyLabel = (p: PropertyListItem) => p.name ?? `Property #${p.id}`;

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
 * multi-select de logements obligatoire.</p>
 */
export default function VoucherEditorDialog({ voucher, open, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const isEdit = voucher !== null;
  // Appele inconditionnellement : le multi-select n'est rendu que si le toggle
  // « toutes les proprietes » est off, mais un hook ne peut pas etre conditionnel.
  const propertiesAnchor = useComboboxAnchor();
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
  const selectedProperties = properties.filter((p) => selectedPropertyIdSet.has(Number(p.id)));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* `maxWidth="md"` MUI = 900 px (breakpoints non configures). */}
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('vouchers.editor.editTitle') : t('vouchers.editor.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {/* Le defilement porte sur le corps du formulaire, pas sur DialogContent :
            titre et pied restent visibles, comme le `dividers` du Dialog MUI. */}
        <div className="max-h-[65vh] overflow-y-auto border-y border-solid border-border py-3">
        {errorMsg && <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>}

        <div className="grid grid-cols-12 gap-3">
          {/* Identite */}
          <div className="col-span-12 min-[900px]:col-span-8">
            <Field>
              <FieldLabel htmlFor="voucher-name">{t('vouchers.editor.name')}</FieldLabel>
              <Input
                id="voucher-name"
                className="w-full"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
              />
              <FieldDescription>{t('vouchers.editor.nameHelper')}</FieldDescription>
            </Field>
          </div>
          <div className="col-span-12 min-[900px]:col-span-4">
            <Field>
              <FieldLabel htmlFor="voucher-status">{t('vouchers.editor.status')}</FieldLabel>
              <NativeSelect
                id="voucher-status"
                className="w-full"
                value={form.status}
                onChange={(e) => update('status', e.target.value as VoucherStatus)}
              >
                <NativeSelectOption value="DRAFT">{t('vouchers.status.DRAFT')}</NativeSelectOption>
                <NativeSelectOption value="ACTIVE">{t('vouchers.status.ACTIVE')}</NativeSelectOption>
                <NativeSelectOption value="PAUSED">{t('vouchers.status.PAUSED')}</NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>

          <div className="col-span-12">
            <Field>
              <FieldLabel htmlFor="voucher-description">{t('vouchers.editor.description')}</FieldLabel>
              <Textarea
                id="voucher-description"
                className="w-full"
                rows={2}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
              />
            </Field>
          </div>

          {/* Type + Code */}
          <div className="col-span-12 min-[900px]:col-span-6">
            <Field>
              <FieldLabel htmlFor="voucher-type">{t('vouchers.editor.type')}</FieldLabel>
              <NativeSelect
                id="voucher-type"
                className="w-full"
                value={form.type}
                onChange={(e) => update('type', e.target.value as VoucherType)}
                disabled={isEdit}
              >
                <NativeSelectOption value="MANUAL_CODE">{t('vouchers.typeManual')}</NativeSelectOption>
                <NativeSelectOption value="AUTO_CAMPAIGN">{t('vouchers.typeAuto')}</NativeSelectOption>
              </NativeSelect>
              <FieldDescription>
                {isAuto ? t('vouchers.editor.typeAutoHelper') : t('vouchers.editor.typeManualHelper')}
              </FieldDescription>
            </Field>
          </div>
          <div className="col-span-12 min-[900px]:col-span-6">
            {!isAuto && (
              <Field>
                <FieldLabel htmlFor="voucher-code">{t('vouchers.editor.code')}</FieldLabel>
                <Input
                  id="voucher-code"
                  className="w-full font-mono tracking-[1px]"
                  value={form.code}
                  onChange={(e) => update('code', e.target.value.toUpperCase())}
                  required
                  placeholder="WELCOME20"
                />
                <FieldDescription>{t('vouchers.editor.codeHelper')}</FieldDescription>
              </Field>
            )}
          </div>

          {/* Discount */}
          <div className="col-span-12 min-[900px]:col-span-4">
            <Field>
              <FieldLabel htmlFor="voucher-discount-type">{t('vouchers.editor.discountType')}</FieldLabel>
              <NativeSelect
                id="voucher-discount-type"
                className="w-full"
                value={form.discountType}
                onChange={(e) => update('discountType', e.target.value as VoucherDiscountType)}
              >
                <NativeSelectOption value="PERCENTAGE">{t('vouchers.editor.discountPercentage')}</NativeSelectOption>
                <NativeSelectOption value="FIXED_AMOUNT">{t('vouchers.editor.discountFixed')}</NativeSelectOption>
                <NativeSelectOption value="FREE_NIGHTS" disabled>
                  {t('vouchers.editor.discountFreeNights')} ({t('vouchers.editor.comingSoon')})
                </NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>
          <div className="col-span-12 min-[900px]:col-span-4">
            <Field>
              <FieldLabel htmlFor="voucher-discount-value">{t('vouchers.editor.discountValue')}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="voucher-discount-value"
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => update('discountValue', e.target.value)}
                  required
                />
                <InputGroupAddon align="inline-end">{discountUnit}</InputGroupAddon>
              </InputGroup>
            </Field>
          </div>
          <div className="col-span-12 min-[900px]:col-span-4">
            <Field>
              <FieldLabel htmlFor="voucher-channel-scope">{t('vouchers.editor.channelScope')}</FieldLabel>
              <NativeSelect
                id="voucher-channel-scope"
                className="w-full"
                value={form.channelScope}
                onChange={(e) => update('channelScope', e.target.value as VoucherChannelScope)}
              >
                <NativeSelectOption value="ALL">{t('vouchers.editor.channelAll')}</NativeSelectOption>
                <NativeSelectOption value="BOOKING_ENGINE">{t('vouchers.editor.channelBookingEngine')}</NativeSelectOption>
                <NativeSelectOption value="DIRECT_LINK">{t('vouchers.editor.channelDirectLink')}</NativeSelectOption>
                <NativeSelectOption value="WHATSAPP">WhatsApp</NativeSelectOption>
                <NativeSelectOption value="EMAIL">Email</NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>

          {/* Validite */}
          <div className="col-span-12 min-[900px]:col-span-6">
            <Field>
              <FieldLabel htmlFor="voucher-valid-from">{t('vouchers.editor.validFrom')}</FieldLabel>
              <Input
                id="voucher-valid-from"
                className="w-full"
                type="datetime-local"
                value={form.validFrom}
                onChange={(e) => update('validFrom', e.target.value)}
              />
              <FieldDescription>{t('vouchers.editor.validFromHelper')}</FieldDescription>
            </Field>
          </div>
          <div className="col-span-12 min-[900px]:col-span-6">
            <Field>
              <FieldLabel htmlFor="voucher-valid-until">{t('vouchers.editor.validUntil')}</FieldLabel>
              <Input
                id="voucher-valid-until"
                className="w-full"
                type="datetime-local"
                value={form.validUntil}
                onChange={(e) => update('validUntil', e.target.value)}
              />
              <FieldDescription>{t('vouchers.editor.validUntilHelper')}</FieldDescription>
            </Field>
          </div>

          {/* Limites usage */}
          <div className="col-span-12 min-[900px]:col-span-6">
            <Field>
              <FieldLabel htmlFor="voucher-max-uses-total">{t('vouchers.editor.maxUsesTotal')}</FieldLabel>
              <Input
                id="voucher-max-uses-total"
                className="w-full"
                type="number"
                value={form.maxUsesTotal}
                onChange={(e) => update('maxUsesTotal', e.target.value)}
              />
              <FieldDescription>{t('vouchers.editor.maxUsesTotalHelper')}</FieldDescription>
            </Field>
          </div>
          <div className="col-span-12 min-[900px]:col-span-6">
            <Field>
              <FieldLabel htmlFor="voucher-max-uses-per-guest">{t('vouchers.editor.maxUsesPerGuest')}</FieldLabel>
              <Input
                id="voucher-max-uses-per-guest"
                className="w-full"
                type="number"
                value={form.maxUsesPerGuest}
                onChange={(e) => update('maxUsesPerGuest', e.target.value)}
              />
              <FieldDescription>{t('vouchers.editor.maxUsesPerGuestHelper')}</FieldDescription>
            </Field>
          </div>

          {/* Contraintes sejour */}
          <div className="col-span-12 min-[900px]:col-span-4">
            <Field>
              <FieldLabel htmlFor="voucher-min-stay-nights">{t('vouchers.editor.minStayNights')}</FieldLabel>
              <Input
                id="voucher-min-stay-nights"
                className="w-full"
                type="number"
                value={form.minStayNights}
                onChange={(e) => update('minStayNights', e.target.value)}
              />
            </Field>
          </div>
          <div className="col-span-12 min-[900px]:col-span-4">
            <Field>
              <FieldLabel htmlFor="voucher-max-stay-nights">{t('vouchers.editor.maxStayNights')}</FieldLabel>
              <Input
                id="voucher-max-stay-nights"
                className="w-full"
                type="number"
                value={form.maxStayNights}
                onChange={(e) => update('maxStayNights', e.target.value)}
              />
            </Field>
          </div>
          <div className="col-span-12 min-[900px]:col-span-4">
            <Field>
              <FieldLabel htmlFor="voucher-min-total-amount">{t('vouchers.editor.minTotalAmount')}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="voucher-min-total-amount"
                  type="number"
                  value={form.minTotalAmount}
                  onChange={(e) => update('minTotalAmount', e.target.value)}
                />
                <InputGroupAddon align="inline-end">€</InputGroupAddon>
              </InputGroup>
            </Field>
          </div>

          {/* Scope properties */}
          <div className="col-span-12">
            <div className="flex flex-row items-center gap-1.5">
              <Switch
                id="voucher-apply-to-all"
                checked={form.applyToAllProperties}
                onCheckedChange={(checked) => update('applyToAllProperties', checked)}
              />
              <FieldLabel htmlFor="voucher-apply-to-all" className="text-xs font-normal">
                {t('vouchers.editor.applyToAll')}
              </FieldLabel>
            </div>
            {!form.applyToAllProperties && (
              <Field className="mt-1.5">
                <FieldLabel htmlFor="voucher-target-properties">
                  {t('vouchers.editor.targetProperties')}
                </FieldLabel>
                <Combobox
                  multiple
                  items={properties}
                  itemToStringLabel={propertyLabel}
                  itemToStringValue={propertyLabel}
                  isItemEqualToValue={(a: PropertyListItem, b: PropertyListItem) => a.id === b.id}
                  value={selectedProperties}
                  onValueChange={(sel: PropertyListItem[]) =>
                    update('propertyIds', sel.map((p) => Number(p.id)))
                  }
                >
                  <ComboboxChips ref={propertiesAnchor} className="w-full">
                    <ComboboxValue>
                      {(values: PropertyListItem[]) => (
                        <React.Fragment>
                          {values.map((p) => (
                            <ComboboxChip key={p.id}>{propertyLabel(p)}</ComboboxChip>
                          ))}
                          <ComboboxChipsInput
                            id="voucher-target-properties"
                            placeholder={t('vouchers.editor.targetPropertiesPlaceholder')}
                          />
                        </React.Fragment>
                      )}
                    </ComboboxValue>
                  </ComboboxChips>
                  {/* Le popup est porte hors du DialogContent, ou Radix coupe les
                      pointer-events du reste du document : sans `pointer-events-auto`
                      les options ne seraient pas cliquables. */}
                  <ComboboxContent anchor={propertiesAnchor} className="pointer-events-auto">
                    <ComboboxEmpty>{t('vouchers.editor.targetPropertiesPlaceholder')}</ComboboxEmpty>
                    <ComboboxList>
                      {(p: PropertyListItem) => (
                        <ComboboxItem key={p.id} value={p}>
                          {propertyLabel(p)}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>
            )}
          </div>
        </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="default" onClick={handleSubmit} disabled={saving}>
            {saving ? t('common.saving') : isEdit ? t('common.save') : t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
