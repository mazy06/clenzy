import React from 'react';
import TagChip from '../../components/TagChip';
import { Autocomplete, MenuItem, Stack, TextField } from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';
import { usePropertiesList } from '../../hooks/usePropertiesList';
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

  const update = (patch: Partial<AutomationConditions>) => {
    const next = stringifyConditions({ ...conditions, ...patch });
    onChange(next || undefined);
  };

  const propertyIdSet = new Set(conditions.propertyIds ?? []);
  const selectedProperties = properties.filter((p) =>
    propertyIdSet.has(Number(p.id)),
  );

  return (
    <div className="border border-[var(--line)] rounded-[12px] p-2">
      {/* Section overline (pattern .rm-sec des modales) */}
      <span className="cn-text-caption text-[var(--faint)] font-bold text-[10.5px] uppercase tracking-[0.06em] block mb-2">
        {t('automation.form.conditionsSection', 'Conditions (optionnel)')}
      </span>

      <Stack spacing={1.5}>
        <Autocomplete
          multiple
          size="small"
          options={properties}
          getOptionLabel={(p) => p.name || `#${p.id}`}
          value={selectedProperties}
          onChange={(_, sel) => update({ propertyIds: sel.map((p) => Number(p.id)) })}
          renderTags={(val, getTagProps) =>
            val.map((option, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <TagChip key={key} label={option.name} {...tagProps} />
              );
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('automation.form.properties', 'Logements concernés')}
              placeholder={t('automation.form.propertiesPlaceholder', 'Tous les logements si vide')}
            />
          )}
        />

        <Stack direction="row" spacing={1.5}>
          <TextField
            label={t('automation.form.minNights', 'Nuits min.')}
            type="number"
            size="small"
            fullWidth
            value={conditions.minNights ?? ''}
            onChange={(e) =>
              update({ minNights: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            inputProps={{ min: 1 }}
          />
          <TextField
            label={t('automation.form.maxNights', 'Nuits max.')}
            type="number"
            size="small"
            fullWidth
            value={conditions.maxNights ?? ''}
            onChange={(e) =>
              update({ maxNights: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            inputProps={{ min: 1 }}
          />
        </Stack>

        <TextField
          select
          label={t('automation.form.guestLanguage', 'Langue du voyageur')}
          size="small"
          fullWidth
          value={conditions.guestLanguage ?? ''}
          onChange={(e) =>
            update({ guestLanguage: (e.target.value || undefined) as GuestLanguage | undefined })
          }
        >
          <MenuItem value="">
            {t('automation.form.guestLanguageAny', 'Toutes les langues')}
          </MenuItem>
          {LANGUAGE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {t(opt.key, opt.fallback)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
    </div>
  );
};

export default ConditionsEditor;
