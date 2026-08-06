import React from 'react';
import { cn } from '../../utils/cn';
import {
  Checkbox,
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  NativeSelect,
  NativeSelectOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Textarea,
} from '../../components/ui';
import {
  Person,
  Schedule,
  CleaningServices,
  Window,
  Checklist,
  Language,
} from '../../icons';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyFormValues } from '../../schemas';

// ─── Stable class constants ─────────────────────────────────────────────────

/** Titre de section — echelle « overline » de Baitly UI. */
const SECTION_TITLE_CLASS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-[9px]';

/** Variante avec icone en tete de titre (gap 0.5 de l'ancien spacing MUI = 3 px). */
const SECTION_TITLE_ICON_CLASS = `${SECTION_TITLE_CLASS} flex items-center gap-[3px]`;

/**
 * Encart d'interrupteur (fond + filet teintes quand l'option est active).
 * Teinte vive pour le filet et l'icone, `-soft` pour le fond — cf. contrat §2.4.
 */
const TOGGLE_PANEL_CLASS = 'items-center gap-[9px] py-1.5 px-[9px] rounded-lg border transition-[background-color,border-color] duration-150 ease-out';

/** Libelle plein largeur de ces encarts : titre + aide, tout cliquable. */
const TOGGLE_LABEL_CLASS = 'flex-1 w-auto flex-col items-start gap-0 cursor-pointer';

// ─── Types ──────────────────────────────────────────────────────────────────

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface PropertyFormSettingsProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
  users: User[];
  propertyStatuses: { value: string; label: string }[];
  cleaningFrequencies: { value: string; label: string }[];
  isAdmin: () => boolean;
  isManager: () => boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyFormSettings: React.FC<PropertyFormSettingsProps> = React.memo(
  ({ control, errors, users, propertyStatuses, cleaningFrequencies, isAdmin, isManager }) => {
    const { t } = useTranslation();

    return (
      <div className="flex flex-col gap-4">
        {/* ── Configuration ────────────────────────────────────────────── */}
        <div>
          <p className={SECTION_TITLE_CLASS}>
            {t('properties.configuration')}
          </p>

          <div className="grid grid-cols-12 gap-[9px]">
            <div className="col-span-12">
              <Controller
                name="ownerId"
                control={control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="property-owner">{t('properties.owner')} *</FieldLabel>
                    {/* Select riche (et non NativeSelect) : chaque entree porte une
                        icone, qu'une <option> native ne saurait rendre. Radix ne
                        manipule que des chaines : la valeur est recastee en nombre. */}
                    <Select
                      value={field.value != null ? String(field.value) : ''}
                      onValueChange={(v) => field.onChange(v === '' ? undefined : Number(v))}
                      disabled={!isAdmin() && !isManager()}
                    >
                      <SelectTrigger
                        id="property-owner"
                        size="sm"
                        className="w-full"
                        aria-invalid={!!fieldState.error}
                      >
                        <SelectValue placeholder={t('properties.owner')} />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={String(user.id)}>
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-flex text-muted-foreground"><Person size={14} strokeWidth={1.75} /></span>
                              <span className="text-[0.8125rem]">
                                {user.firstName} {user.lastName} ({user.role})
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                  </Field>
                )}
              />
            </div>

            <div className="col-span-12">
              <Controller
                name="status"
                control={control}
                render={({ field: { ref: _ref, ...field }, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="property-status">{t('properties.status')}</FieldLabel>
                    <NativeSelect
                      {...field}
                      id="property-status"
                      className="w-full"
                      required
                      value={field.value ?? ''}
                      aria-invalid={!!fieldState.error}
                    >
                      {propertyStatuses.map(status => (
                        <NativeSelectOption key={status.value} value={status.value}>
                          {status.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                  </Field>
                )}
              />
            </div>

            {/* Booking Engine Visibility */}
            <div className="col-span-12">
              <Controller
                name="bookingEngineVisible"
                control={control}
                render={({ field }) => (
                  <Field
                    orientation="horizontal"
                    className={cn(
                      TOGGLE_PANEL_CLASS,
                      field.value ? 'bg-success-soft border-success/30' : 'bg-field border-field-line',
                    )}
                  >
                    <span className={cn('inline-flex', field.value ? 'text-success' : 'text-muted-foreground')}><Language size={18} strokeWidth={1.75} /></span>
                    {/* Le libelle englobe titre ET aide : toute la zone reste
                        cliquable, comme avant la refonte. */}
                    <FieldLabel htmlFor="property-booking-engine-visible" className={TOGGLE_LABEL_CLASS}>
                      <span className="block text-[0.8125rem] font-semibold">
                        {t('properties.bookingEngineVisible')}
                      </span>
                      <span className="block text-2xs font-normal text-muted-foreground">
                        {t('properties.bookingEngineVisibleHelper')}
                      </span>
                    </FieldLabel>
                    {/* color="success" de MUI : le kit n'a qu'une teinte d'encre par
                        defaut, la couleur « actif » se pose en classe data-checked. */}
                    <Switch
                      id="property-booking-engine-visible"
                      size="sm"
                      checked={field.value ?? false}
                      onCheckedChange={(checked) => field.onChange(checked)}
                      className="data-checked:bg-success"
                    />
                  </Field>
                )}
              />
            </div>

            {/* Org Voucher Consent — autorise la conciergerie a creer des
                vouchers sur ce logement (combine avec organization.has_voucher_contract
                cote backend). Default false : le host garde le controle. */}
            <div className="col-span-12">
              <Controller
                name="orgCanCreateVouchers"
                control={control}
                render={({ field }) => (
                  <Field
                    orientation="horizontal"
                    className={cn(
                      TOGGLE_PANEL_CLASS,
                      field.value ? 'bg-success-soft border-success/30' : 'bg-field border-field-line',
                    )}
                  >
                    <span className={cn('inline-flex', field.value ? 'text-success' : 'text-muted-foreground')}>
                      <Language size={18} strokeWidth={1.75} />
                    </span>
                    <FieldLabel htmlFor="property-org-can-create-vouchers" className={TOGGLE_LABEL_CLASS}>
                      <span className="block text-[0.8125rem] font-semibold">
                        {t('properties.orgCanCreateVouchers')}
                      </span>
                      <span className="block text-2xs font-normal text-muted-foreground">
                        {t('properties.orgCanCreateVouchersHelper')}
                      </span>
                    </FieldLabel>
                    <Switch
                      id="property-org-can-create-vouchers"
                      size="sm"
                      checked={field.value ?? false}
                      onCheckedChange={(checked) => field.onChange(checked)}
                      className="data-checked:bg-success"
                    />
                  </Field>
                )}
              />
            </div>

            <div className="col-span-6">
              <Controller
                name="defaultCheckInTime"
                control={control}
                // Le ref de react-hook-form est ecarte : les primitives du kit sont des
                // composants fonction sans forwardRef (React 18 refuserait le ref).
                render={({ field: { ref: _ref, ...field }, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="property-check-in-time">{t('properties.checkInTime')}</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <span className="inline-flex text-muted-foreground"><Schedule size={16} strokeWidth={1.75} /></span>
                      </InputGroupAddon>
                      <InputGroupInput
                        {...field}
                        id="property-check-in-time"
                        type="time"
                        step={900}
                        aria-invalid={!!fieldState.error}
                      />
                    </InputGroup>
                    {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                  </Field>
                )}
              />
            </div>

            <div className="col-span-6">
              <Controller
                name="defaultCheckOutTime"
                control={control}
                render={({ field: { ref: _ref, ...field }, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="property-check-out-time">{t('properties.checkOutTime')}</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <span className="inline-flex text-muted-foreground"><Schedule size={16} strokeWidth={1.75} /></span>
                      </InputGroupAddon>
                      <InputGroupInput
                        {...field}
                        id="property-check-out-time"
                        type="time"
                        step={900}
                        aria-invalid={!!fieldState.error}
                      />
                    </InputGroup>
                    {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                  </Field>
                )}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Tarification ménage ──────────────────────────────────────── */}
        <div>
          <p className={SECTION_TITLE_ICON_CLASS}>
            <CleaningServices size={14} strokeWidth={1.75} />
            {t('properties.cleaningPricing')}
          </p>

          <div className="grid grid-cols-12 gap-[9px]">
            <div className="col-span-12">
              <Controller
                name="cleaningFrequency"
                control={control}
                render={({ field: { ref: _ref, ...field }, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="property-cleaning-frequency">{t('properties.cleaningFrequency')}</FieldLabel>
                    <NativeSelect
                      {...field}
                      id="property-cleaning-frequency"
                      className="w-full"
                      required
                      value={field.value ?? ''}
                      aria-invalid={!!fieldState.error}
                    >
                      {cleaningFrequencies.map(freq => (
                        <NativeSelectOption key={freq.value} value={freq.value}>
                          {freq.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                  </Field>
                )}
              />
            </div>

            <div className="col-span-12">
              <Controller
                name="cleaningBasePrice"
                control={control}
                render={({ field: { ref: _ref, ...field }, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="property-cleaning-base-price">{t('properties.cleaningBasePrice')}</FieldLabel>
                    <Input
                      {...field}
                      id="property-cleaning-base-price"
                      value={field.value ?? ''}
                      className="w-full tabular-nums"
                      type="number"
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === '' ? undefined : Number(val));
                      }}
                      aria-invalid={!!fieldState.error}
                      step="0.01"
                      min="0"
                    />
                    {fieldState.error ? (
                      <FieldError>{fieldState.error.message}</FieldError>
                    ) : (
                      <FieldDescription>{t('properties.cleaningBasePriceHelper')}</FieldDescription>
                    )}
                  </Field>
                )}
              />
            </div>

            <div className="col-span-4">
              <Controller
                name="numberOfFloors"
                control={control}
                render={({ field: { ref: _ref, ...field }, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="property-number-of-floors">{t('properties.numberOfFloors')}</FieldLabel>
                    <Input
                      {...field}
                      id="property-number-of-floors"
                      value={field.value ?? ''}
                      className="w-full tabular-nums"
                      type="number"
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === '' ? undefined : Number(val));
                      }}
                      aria-invalid={!!fieldState.error}
                      min="0"
                    />
                    {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                  </Field>
                )}
              />
            </div>

            <div className="col-span-4">
              <Controller
                name="hasExterior"
                control={control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="gap-1.5">
                    <Checkbox
                      id="property-has-exterior"
                      checked={field.value ?? false}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <FieldLabel htmlFor="property-has-exterior" className="text-[0.8125rem] font-normal">
                      {t('properties.hasExterior')}
                    </FieldLabel>
                  </Field>
                )}
              />
            </div>

            <div className="col-span-4">
              <Controller
                name="hasLaundry"
                control={control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="gap-1.5">
                    <Checkbox
                      id="property-has-laundry"
                      checked={field.value ?? true}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <FieldLabel htmlFor="property-has-laundry" className="text-[0.8125rem] font-normal">
                      {t('properties.hasLaundry')}
                    </FieldLabel>
                  </Field>
                )}
              />
            </div>

            <div className="col-span-12">
              <Controller
                name="cleaningNotes"
                control={control}
                render={({ field: { ref: _ref, ...field }, fieldState }) => (
                  <div
                    className={cn(
                      'flex gap-1.5 py-[7.5px] px-[9px] rounded-lg bg-primary-soft border min-h-[80px] transition-[border-color] duration-150 ease-out',
                      fieldState.error ? 'border-destructive' : 'border-primary/30',
                    )}
                  >
                    <span className="inline-flex text-primary mt-0 shrink-0"><Checklist size={16} strokeWidth={1.75} /></span>
                    <Field className="flex-1">
                      <FieldLabel
                        htmlFor="property-cleaning-notes"
                        className="text-2xs font-semibold uppercase tracking-wide text-primary mb-0.5"
                      >
                        {t('properties.cleaningNotes')}
                      </FieldLabel>
                      {/* Ancien TextField variant="standard" + disableUnderline : le
                          champ est nu, seul le panneau teinte l'encadre. min-h/max-h
                          en `lh` remplacent minRows/maxRows, que field-sizing annule. */}
                      <Textarea
                        {...field}
                        id="property-cleaning-notes"
                        value={field.value ?? ''}
                        placeholder={t('properties.cleaningNotesPlaceholder')}
                        aria-invalid={!!fieldState.error}
                        className="w-full border-0 bg-transparent p-0 rounded-none min-h-[2lh] max-h-[6lh] overflow-y-auto text-xs leading-[1.4] text-muted-foreground placeholder:text-xs placeholder:text-faint focus-visible:ring-0"
                      />
                      {fieldState.error && (
                        <FieldError className="mt-0.5">{fieldState.error.message}</FieldError>
                      )}
                    </Field>
                  </div>
                )}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Prestations à la carte ─────────────────────────────────────── */}
        <div>
          <p className={SECTION_TITLE_ICON_CLASS}>
            <Window width={14} />
            {t('properties.addOnServices.title')}
          </p>

          <div className="grid grid-cols-12 gap-[9px]">
            {/* Vitres */}
            <div className="col-span-4">
              <Controller
                name="windowCount"
                control={control}
                render={({ field: { ref: _ref, ...field }, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="property-window-count">{t('properties.addOnServices.windowCount')}</FieldLabel>
                    <Input
                      {...field}
                      id="property-window-count"
                      value={field.value ?? 0}
                      className="w-full tabular-nums"
                      type="number"
                      onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                      aria-invalid={!!fieldState.error}
                      min="0"
                    />
                    <FieldDescription>{t('properties.addOnServices.windowCountHelper')}</FieldDescription>
                  </Field>
                )}
              />
            </div>

            <div className="col-span-4">
              <Controller
                name="frenchDoorCount"
                control={control}
                render={({ field: { ref: _ref, ...field }, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="property-french-door-count">{t('properties.addOnServices.frenchDoorCount')}</FieldLabel>
                    <Input
                      {...field}
                      id="property-french-door-count"
                      value={field.value ?? 0}
                      className="w-full tabular-nums"
                      type="number"
                      onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                      aria-invalid={!!fieldState.error}
                      min="0"
                    />
                    <FieldDescription>{t('properties.addOnServices.frenchDoorCountHelper')}</FieldDescription>
                  </Field>
                )}
              />
            </div>

            <div className="col-span-4">
              <Controller
                name="slidingDoorCount"
                control={control}
                render={({ field: { ref: _ref, ...field }, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="property-sliding-door-count">{t('properties.addOnServices.slidingDoorCount')}</FieldLabel>
                    <Input
                      {...field}
                      id="property-sliding-door-count"
                      value={field.value ?? 0}
                      className="w-full tabular-nums"
                      type="number"
                      onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                      aria-invalid={!!fieldState.error}
                      min="0"
                    />
                    <FieldDescription>{t('properties.addOnServices.slidingDoorCountHelper')}</FieldDescription>
                  </Field>
                )}
              />
            </div>

            {/* Checkboxes prestations */}
            <div className="col-span-4">
              <Controller
                name="hasIroning"
                control={control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="gap-1.5">
                    <Checkbox
                      id="property-has-ironing"
                      checked={field.value ?? false}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <FieldLabel htmlFor="property-has-ironing" className="text-[0.8125rem] font-normal">
                      {t('properties.addOnServices.hasIroning')}
                    </FieldLabel>
                  </Field>
                )}
              />
            </div>

            <div className="col-span-4">
              <Controller
                name="hasDeepKitchen"
                control={control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="gap-1.5">
                    <Checkbox
                      id="property-has-deep-kitchen"
                      checked={field.value ?? false}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <FieldLabel htmlFor="property-has-deep-kitchen" className="text-[0.8125rem] font-normal">
                      {t('properties.addOnServices.hasDeepKitchen')}
                    </FieldLabel>
                  </Field>
                )}
              />
            </div>

            <div className="col-span-4">
              <Controller
                name="hasDisinfection"
                control={control}
                render={({ field }) => (
                  <Field orientation="horizontal" className="gap-1.5">
                    <Checkbox
                      id="property-has-disinfection"
                      checked={field.value ?? false}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <FieldLabel htmlFor="property-has-disinfection" className="text-[0.8125rem] font-normal">
                      {t('properties.addOnServices.hasDisinfection')}
                    </FieldLabel>
                  </Field>
                )}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PropertyFormSettings.displayName = 'PropertyFormSettings';

export default PropertyFormSettings;
