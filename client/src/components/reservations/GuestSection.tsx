import React from 'react';
import { Spinner } from '../ui';
import { TextField, Autocomplete } from '@mui/material';
import {
  Field,
  FieldLabel,
  Input,
  Textarea,
  NativeSelect,
  NativeSelectOption,
} from '../ui';
import StatusChip from '../StatusChip';
import { Person, PersonOutline, Search as SearchIcon, Group as GroupIcon, Remove as RemoveIcon, Add as AddIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import type { UseReservationFormResult } from './useReservationForm';
// COMPACT_FIELD_SX ne sert plus qu'a l'Autocomplete de recherche, seul TextField restant.
import { COMPACT_FIELD_SX, AdornIcon } from './reservationDialogStyles';

// Transposition en classes de SEC_SX (.rm-sec) — meme motif que STEP_BTN_CLS :
// la constante sx reste exportee dans reservationDialogStyles.
const SEC_CLS = 'cn-text-body1 text-[10.5px] font-bold tracking-[0.08em] uppercase text-[var(--faint)]';

// Transposition en classes de STEP_BTN_SX (.rm-count) — la constante reste
// exportee dans reservationDialogStyles pour les consommateurs sx eventuels.
const STEP_BTN_CLS =
  'w-[30px] h-[30px] rounded-[8px] border-0 bg-[var(--card)] text-[var(--body)] cursor-pointer ' +
  'flex items-center justify-center p-0 transition-[color] duration-[140ms] ' +
  'enabled:hover:text-[var(--accent)] disabled:opacity-40 disabled:cursor-default ' +
  'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[1px]';

interface Props {
  form: UseReservationFormResult;
}

// Pays courants (ISO 3166-1 alpha-2) pour la nationalité — liste courte et éditable.
const COUNTRY_OPTIONS = ['FR', 'GB', 'US', 'DE', 'ES', 'IT', 'MA', 'BE', 'CH', 'NL', 'PT', 'CA'];
// Langues supportées pour la communication voyageur.
const LANGUAGE_OPTIONS = ['fr', 'en', 'ar', 'es', 'de', 'it'];

// Stepper -/valeur/+ cohérent (voyageurs et enfants).
const renderStepper = (
  value: number,
  onDec: () => void,
  onInc: () => void,
  decDisabled: boolean,
  incDisabled: boolean,
  ariaLabel: string,
) => (
  <div className="flex items-center gap-[4px] bg-[var(--field)] border border-solid border-[var(--field-line)] rounded-[10px] p-[3px] shrink-0">
    <button type="button" aria-label={`${ariaLabel} −`} onClick={onDec} disabled={decDisabled} className={STEP_BTN_CLS}>
      <RemoveIcon size={15} strokeWidth={1.75} />
    </button>
    <div className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--ink)] min-w-[28px] text-center select-none tabular-nums">
      {value}
    </div>
    <button type="button" aria-label={`${ariaLabel} +`} onClick={onInc} disabled={incDisabled} className={STEP_BTN_CLS}>
      <AddIcon size={15} strokeWidth={1.75} />
    </button>
  </div>
);

// Champ en lecture seule (infos d'un voyageur — édition de réservation uniquement).
// L'id est passe par l'appelant : le libellé du kit ne designe le champ que via htmlFor/id.
const roField = (id: string, label: string, value?: string | null, multiline = false) => (
  <Field>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    {multiline ? (
      <Textarea id={id} className="w-full" rows={2} value={value || '—'} disabled readOnly />
    ) : (
      <Input id={id} className="w-full" value={value || '—'} disabled readOnly />
    )}
  </Field>
);

/**
 * Voyageur.
 * - Création : recherche d'un voyageur existant (préremplit) + champs TOUJOURS éditables.
 *   Aucun bouton « Créer la fiche » : la persistance (upsert create/update) se fait au submit.
 * - Édition d'une réservation : comportement inchangé — infos du voyageur en lecture seule.
 */
const GuestSection: React.FC<Props> = ({ form }) => {
  const { t } = useTranslation();

  // Gabarit plus haut que la puce de statut : ici la puce porte une identite
  // (le voyageur choisi), pas un etat — d'ou l'encre `--ink` et l'accent reserve
  // aux deux affordances (icone, croix).
  const guestChip = (
    <StatusChip
      icon={<Person size={15} strokeWidth={1.75} />}
      label={form.selectedGuest?.fullName}
      onDelete={form.fieldsLocked ? undefined : form.clearGuest}
      tokens={{ color: 'var(--ink)', bg: 'var(--accent-soft)' }}
      className="h-8 rounded-[10px] text-[12.5px] [&>svg]:text-[var(--accent)] [&>button>svg]:text-[var(--accent)]"
    />
  );

  const searchField = (
    <Autocomplete
      freeSolo={false}
      options={form.searchResults}
      getOptionLabel={(option) => option.fullName}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <li key={key} {...optionProps}>
            <div>
              <p className="cn-text-body1 text-[13px] font-semibold text-[var(--ink)]">{option.fullName}</p>
              {option.email && <p className="cn-text-body1 text-[11.5px] text-[var(--muted)]">{option.email}</p>}
            </div>
          </li>
        );
      }}
      inputValue={form.guestSearchQuery}
      onInputChange={(_, val) => form.setGuestSearchQuery(val)}
      value={null}
      onChange={(_, val) => { if (val) form.setSelectedGuest(val); }}
      loading={form.isSearching}
      noOptionsText={form.debouncedSearch.length >= 2 ? t('reservations.dialog.noGuestFound') : t('reservations.dialog.typeToSearch')}
      slotProps={{
        paper: {
          sx: {
            borderRadius: '12px',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-pop)',
            backgroundColor: 'var(--card)',
            backgroundImage: 'none',
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={t('reservations.dialog.searchGuest')}
          sx={[
            COMPACT_FIELD_SX,
            {
              '& .MuiOutlinedInput-root': { padding: '0 39px 0 11px' },
              '& .MuiOutlinedInput-root .MuiAutocomplete-input': { padding: '0 0 0 8px', height: 36, fontWeight: 500 },
            },
          ]}
          InputProps={{
            ...params.InputProps,
            startAdornment: <AdornIcon><SearchIcon size={15} strokeWidth={1.75} /></AdornIcon>,
            endAdornment: (
              <>
                {form.isSearching ? <Spinner className="size-4 text-[var(--accent)]" /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );

  // Formulaire voyageur ÉDITABLE (création) — champs newGuest*, persistés au submit.
  const editableGuestForm = (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-[10px] mt-[2px]">
        <p className={cn(SEC_CLS, 'whitespace-nowrap')}>
          {form.selectedGuest ? t('reservations.dialog.editGuest') : t('reservations.dialog.newGuest')}
        </p>
        <div className="flex-1 h-[1px] bg-[var(--line)]" />
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-2.5">
        <Field>
          <FieldLabel htmlFor="guest-new-firstname">{t('reservations.dialog.firstName')}</FieldLabel>
          <Input
            id="guest-new-firstname"
            className="w-full"
            required
            value={form.newGuestFirstName}
            onChange={(e) => form.setNewGuestFirstName(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="guest-new-lastname">{t('reservations.dialog.lastName')}</FieldLabel>
          <Input
            id="guest-new-lastname"
            className="w-full"
            required
            value={form.newGuestLastName}
            onChange={(e) => form.setNewGuestLastName(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2.5">
        <Field>
          <FieldLabel htmlFor="guest-new-email">{t('reservations.fields.guestEmail')}</FieldLabel>
          <Input
            id="guest-new-email"
            className="w-full"
            type="email"
            value={form.newGuestEmail}
            onChange={(e) => form.setNewGuestEmail(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="guest-new-phone">{t('reservations.fields.guestPhone')}</FieldLabel>
          <Input
            id="guest-new-phone"
            className="w-full"
            value={form.newGuestPhone}
            onChange={(e) => form.setNewGuestPhone(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2.5">
        <Field>
          <FieldLabel htmlFor="guest-new-country">{t('reservations.dialog.nationality')}</FieldLabel>
          <NativeSelect
            id="guest-new-country"
            className="w-full"
            value={form.newGuestCountry}
            onChange={(e) => form.setNewGuestCountry(e.target.value)}
          >
            <NativeSelectOption value="">—</NativeSelectOption>
            {COUNTRY_OPTIONS.map((c) => (
              <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="guest-new-language">{t('reservations.dialog.language')}</FieldLabel>
          <NativeSelect
            id="guest-new-language"
            className="w-full"
            value={form.newGuestLanguage}
            onChange={(e) => form.setNewGuestLanguage(e.target.value)}
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <NativeSelectOption key={l} value={l}>{l.toUpperCase()}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="guest-new-notes">{t('reservations.dialog.guestNotes')}</FieldLabel>
        <Textarea
          id="guest-new-notes"
          className="w-full"
          rows={1}
          placeholder={t('reservations.dialog.notesPlaceholder')}
          value={form.newGuestNotes}
          onChange={(e) => form.setNewGuestNotes(e.target.value)}
        />
      </Field>
    </div>
  );

  return (
    <>
      <p className={cn(SEC_CLS, 'mt-[4px]')}>{t('reservations.dialog.traveler')}</p>

      {form.isEdit ? (
        // ── ÉDITION : comportement inchangé — voyageur en lecture seule ──
        form.selectedGuest && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {guestChip}
              {form.selectedGuest.email && (
                <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] overflow-hidden text-ellipsis whitespace-nowrap">
                  {form.selectedGuest.email}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-[1fr_1fr] gap-3">
                {roField('guest-ro-firstname', t('reservations.dialog.firstName'), form.selectedGuest.firstName)}
                {roField('guest-ro-lastname', t('reservations.dialog.lastName'), form.selectedGuest.lastName)}
              </div>
              <div className="grid grid-cols-[1fr_1fr] gap-3">
                {roField('guest-ro-email', t('reservations.fields.guestEmail'), form.selectedGuest.email)}
                {roField('guest-ro-phone', t('reservations.fields.guestPhone'), form.selectedGuest.phone)}
              </div>
              <div className="grid grid-cols-[1fr_1fr] gap-3">
                {roField('guest-ro-country', t('reservations.dialog.nationality'), form.selectedGuest.countryCode)}
                {roField('guest-ro-language', t('reservations.dialog.language'), form.selectedGuest.language)}
              </div>
              {form.selectedGuest.notes &&
                roField('guest-ro-notes', t('reservations.dialog.guestNotes'), form.selectedGuest.notes, true)}
            </div>
          </div>
        )
      ) : (
        // ── CRÉATION : recherche/chip + champs toujours éditables ──
        <>
          {form.selectedGuest ? (
            <div className="flex items-center gap-2.5 min-w-0">{guestChip}</div>
          ) : (
            searchField
          )}
          {editableGuestForm}
        </>
      )}

      {/* Occupation — voyageurs + dont enfants, regroupés (steppers cohérents). */}
      <div className="border border-[var(--line)] rounded-[12px] overflow-hidden bg-[var(--card)]">
        {/* Voyageurs */}
        <div className="flex items-center gap-3 px-[14px] py-[11px]">
          <span className="inline-flex text-[var(--accent)] shrink-0">
            <GroupIcon size={18} strokeWidth={1.75} />
          </span>
          <p className="cn-text-body1 flex-1 min-w-0 text-[13.5px] font-semibold text-[var(--ink)]">
            {t('reservations.dialog.travelers')}
          </p>
          {renderStepper(
            form.guestCount,
            () => form.setGuestCount((c) => Math.max(1, c - 1)),
            () => form.setGuestCount((c) => Math.min(20, c + 1)),
            form.guestCount <= 1 || form.fieldsLocked,
            form.guestCount >= 20 || form.fieldsLocked,
            t('reservations.dialog.travelers'),
          )}
        </div>

        <div className="h-[1px] bg-[var(--line)]" />

        {/* dont enfants (mineurs) — exonérés de la taxe de séjour */}
        <div className="flex items-center gap-3 px-[14px] py-[11px]">
          <span className="inline-flex text-[var(--accent)] shrink-0">
            <PersonOutline size={18} strokeWidth={1.75} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="cn-text-body1 text-[13.5px] font-semibold text-[var(--ink)] leading-[1.3]">
              {t('reservations.fields.childrenCount')}
            </p>
            <p className="cn-text-body1 text-[11px] text-[var(--muted)] leading-[1.3]">
              {t('reservations.fields.childrenCountHelp')}
            </p>
          </div>
          {renderStepper(
            form.childrenCount,
            () => form.setChildrenCount(Math.max(0, form.childrenCount - 1)),
            () => form.setChildrenCount(Math.min(form.guestCount, form.childrenCount + 1)),
            form.childrenCount <= 0 || form.fieldsLocked,
            form.childrenCount >= form.guestCount || form.fieldsLocked,
            t('reservations.fields.childrenCount'),
          )}
        </div>
      </div>
    </>
  );
};

export default GuestSection;
