import React from 'react';
import { Field, FieldLabel, Input, NativeSelect, NativeSelectOption } from '../../components/ui';
import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxValue, useComboboxAnchor } from '../../components/ui/combobox';
import { useTranslation } from '../../hooks/useTranslation';
import { usePropertiesList, type PropertyListItem } from '../../hooks/usePropertiesList';
import {
  parseConditions,
  stringifyConditions,
  type AutomationConditions,
  type GuestLanguage,
} from '../../services/api/automationRulesApi';

const LANGUAGE_OPTIONS: { value: GuestLanguage; key: string; fallback: string }[] = [
  { value: 'fr', key: 'automation.form.langFr', fallback: 'Français' },
  { value: 'en', key: 'automation.form.langEn', fallback: 'Anglais' },
  { value: 'ar', key: 'automation.form.langAr', fallback: 'Arabe' },
];

/** Libellé d'un logement dans les puces et la liste déroulante. */
const propertyLabel = (p: PropertyListItem) => p.name || `#${p.id}`;

interface ConditionsEditorProps {
  /** Valeur JSON brute (champ `conditions` de la règle). */
  value: string | undefined;
  /** Reçoit le JSON recompacté (ou `undefined` si aucune condition). */
  onChange: (value: string | undefined) => void;
}

/**
 * Éditeur structuré des conditions d'une règle d'automatisation. Construit/parse
 * le JSON `{ propertyIds, minNights, maxNights, guestLanguage }` lu par le backend
 * (AutomationConditionEvaluator). Conditions vides = la règle s'applique toujours.
 */
const ConditionsEditor: React.FC<ConditionsEditorProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const { properties } = usePropertiesList();
  const conditions = parseConditions(value);
  // Les puces servent d'ancre au popup : sans elle il se positionnerait sur le
  // champ de saisie interne, qui se déplace à chaque puce ajoutée.
  const propertiesAnchor = useComboboxAnchor();

  const update = (patch: Partial<AutomationConditions>) => {
    const next = stringifyConditions({ ...conditions, ...patch });
    onChange(next || undefined);
  };

  const propertyIdSet = new Set(conditions.propertyIds ?? []);
  const selectedProperties = properties.filter((p) =>
    propertyIdSet.has(Number(p.id)),
  );

  return (
    <div className="pb-5">
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="automation-cond-properties">
            {t('automation.form.properties', 'Logements concernés')}
          </FieldLabel>
          <Combobox
            multiple
            items={properties}
            itemToStringLabel={propertyLabel}
            itemToStringValue={propertyLabel}
            isItemEqualToValue={(a: PropertyListItem, b: PropertyListItem) => a.id === b.id}
            value={selectedProperties}
            onValueChange={(sel: PropertyListItem[]) =>
              update({ propertyIds: sel.map((p) => Number(p.id)) })
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
                      id="automation-cond-properties"
                      className="bg-transparent placeholder:text-muted-foreground"
                      placeholder={t(
                        'automation.form.propertiesPlaceholder',
                        'Tous les logements si vide',
                      )}
                    />
                  </React.Fragment>
                )}
              </ComboboxValue>
            </ComboboxChips>
            {/* Le popup est porté hors du panneau d'édition (Radix y coupe les
                pointer-events du reste du document) : sans `pointer-events-auto`
                les options ne seraient pas cliquables. */}
            <ComboboxContent anchor={propertiesAnchor} className="pointer-events-auto">
              <ComboboxEmpty>
                {t('automation.form.propertiesEmpty', 'Aucun logement')}
              </ComboboxEmpty>
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

        <div className="automation-field-pair">
          <Field>
            <FieldLabel htmlFor="automation-cond-min-nights">
              {t('automation.form.minNights', 'Nuits min.')}
            </FieldLabel>
            <Input
              id="automation-cond-min-nights"
              type="number"
              min={1}
              value={conditions.minNights ?? ''}
              onChange={(e) =>
                update({ minNights: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="automation-cond-max-nights">
              {t('automation.form.maxNights', 'Nuits max.')}
            </FieldLabel>
            <Input
              id="automation-cond-max-nights"
              type="number"
              min={1}
              value={conditions.maxNights ?? ''}
              onChange={(e) =>
                update({ maxNights: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="automation-cond-language">
            {t('automation.form.guestLanguage', 'Langue du voyageur')}
          </FieldLabel>
          <NativeSelect
            id="automation-cond-language"
            className="w-full"
            value={conditions.guestLanguage ?? ''}
            onChange={(e) =>
              update({ guestLanguage: (e.target.value || undefined) as GuestLanguage | undefined })
            }
          >
            <NativeSelectOption value="">
              {t('automation.form.guestLanguageAny', 'Toutes les langues')}
            </NativeSelectOption>
            {LANGUAGE_OPTIONS.map((opt) => (
              <NativeSelectOption key={opt.value} value={opt.value}>
                {t(opt.key, opt.fallback)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </div>
  );
};

export default ConditionsEditor;
