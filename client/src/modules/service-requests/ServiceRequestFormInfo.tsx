import React, { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Chip,
  FormHelperText,
  Checkbox,
  IconButton,
} from '@mui/material';
import {
  AutoAwesome,
  Build,
  MoreHoriz,
  Description,
  Checklist,
  Add,
  Close,
  LocalLaundryService,
  Deck,
  Window,
  DoorSliding,
  Iron,
  Kitchen,
  Sanitizer,
} from '../../icons';
import { Controller, Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { INTERVENTION_TYPE_OPTIONS, InterventionTypeOption } from '../../types/interventionTypes';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequestFormValues } from '../../schemas';

/** Catégories principales */
type ServiceCategory = 'cleaning' | 'maintenance' | 'other';

interface CategoryDef {
  key: ServiceCategory;
  label: string;
  icon: React.ReactElement;
  /** Tokens sémantiques (texte couleur + fond -soft). */
  fg: string;
  bg: string;
  /** Catégories interventionTypes.ts correspondantes */
  mappedCategories: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    key: 'cleaning',
    label: 'Nettoyage',
    icon: <AutoAwesome size={16} strokeWidth={1.75} />,
    fg: 'var(--ok)',
    bg: 'var(--ok-soft)',
    mappedCategories: ['cleaning'],
  },
  {
    key: 'maintenance',
    label: 'Maintenance / Travaux',
    icon: <Build size={16} strokeWidth={1.75} />,
    fg: 'var(--warn)',
    bg: 'var(--warn-soft)',
    mappedCategories: ['maintenance'],
  },
  {
    key: 'other',
    label: 'Autre',
    icon: <MoreHoriz size={16} strokeWidth={1.75} />,
    fg: 'var(--muted)',
    bg: 'var(--hover)',
    mappedCategories: ['specialized', 'other'],
  },
];

/** Retrouver la catégorie d'un service type */
function getCategoryForType(type: string): ServiceCategory {
  const option = INTERVENTION_TYPE_OPTIONS.find(o => o.value === type);
  if (!option) return 'other';
  for (const cat of CATEGORIES) {
    if (cat.mappedCategories.includes(option.category)) return cat.key;
  }
  return 'other';
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

/** Property data needed for prestations */
interface PropertyAddOns {
  hasLaundry?: boolean;
  hasExterior?: boolean;
  hasIroning?: boolean;
  hasDeepKitchen?: boolean;
  hasDisinfection?: boolean;
  windowCount?: number;
  frenchDoorCount?: number;
  slidingDoorCount?: number;
}

export interface ServiceRequestFormInfoProps {
  control: Control<ServiceRequestFormValues>;
  errors: FieldErrors<ServiceRequestFormValues>;
  setValue: UseFormSetValue<ServiceRequestFormValues>;
  watchedServiceType: string;
  disabled?: boolean;
  propertyDescription?: string;
  cleaningNotes?: string;
  /** Property add-ons for prestations à la carte */
  selectedProperty?: PropertyAddOns | null;
  /** Prestations included in the selected forfait */
  includedPrestations?: string[];
  /** Prestations billed as extras in the selected forfait */
  extraPrestations?: string[];
  /** When editing an existing SR, skip the description auto-fill so we don't overwrite the saved value with the (often >1000 chars) property description. */
  isEditMode?: boolean;
}

// ─── Prestations à la carte config ─────────────────────────────────────────

interface PrestationDef {
  key: string;
  label: string;
  icon: React.ReactElement;
  /** Extra duration in minutes */
  extraMins: number;
  /** 'boolean' prestations are on/off, 'count' have a quantity */
  type: 'boolean' | 'count';
  /** Property field key */
  propertyField: keyof PropertyAddOns;
}

const PRESTATIONS: PrestationDef[] = [
  { key: 'laundry', label: 'Linge', icon: <LocalLaundryService size={14} strokeWidth={1.75} />, extraMins: 10, type: 'boolean', propertyField: 'hasLaundry' },
  { key: 'exterior', label: 'Extérieur', icon: <Deck size={14} strokeWidth={1.75} />, extraMins: 25, type: 'boolean', propertyField: 'hasExterior' },
  { key: 'ironing', label: 'Repassage', icon: <Iron size={14} strokeWidth={1.75} />, extraMins: 20, type: 'boolean', propertyField: 'hasIroning' },
  { key: 'deepKitchen', label: 'Cuisine profonde', icon: <Kitchen size={14} strokeWidth={1.75} />, extraMins: 30, type: 'boolean', propertyField: 'hasDeepKitchen' },
  { key: 'disinfection', label: 'Désinfection', icon: <Sanitizer size={14} strokeWidth={1.75} />, extraMins: 40, type: 'boolean', propertyField: 'hasDisinfection' },
  { key: 'windows', label: 'Fenêtres', icon: <Window size={14} strokeWidth={1.75} />, extraMins: 5, type: 'count', propertyField: 'windowCount' },
  { key: 'frenchDoors', label: 'Portes-fenêtres', icon: <DoorSliding size={14} strokeWidth={1.75} />, extraMins: 8, type: 'count', propertyField: 'frenchDoorCount' },
  { key: 'slidingDoors', label: 'Baies vitrées', icon: <DoorSliding size={14} strokeWidth={1.75} />, extraMins: 12, type: 'count', propertyField: 'slidingDoorCount' },
];

/** Parse cleaning notes text into checklist items */
function parseCleaningNotesToChecklist(notes: string): ChecklistItem[] {
  return notes
    .split('\n')
    .map(line => line.replace(/^\s*\*\s*/, '').trim())
    .filter(line => line.length > 0 && !line.startsWith('**'))
    .map((text, i) => ({
      id: `note-${i}`,
      text,
      checked: false,
    }));
}

const ServiceRequestFormInfo: React.FC<ServiceRequestFormInfoProps> = React.memo(
  ({ control, errors, setValue, watchedServiceType, disabled = false, propertyDescription, cleaningNotes, selectedProperty, includedPrestations, extraPrestations, isEditMode = false }) => {
    const { t } = useTranslation();

    // ─── Description du logement (editable si pas de data propriété) ───
    const [localDescription, setLocalDescription] = useState('');

    // ─── Prestations à la carte (toggles) ───
    const [activePrestations, setActivePrestations] = useState<Set<string>>(new Set());

    // Sync prestations when property changes — pre-select those enabled on the property
    React.useEffect(() => {
      if (!selectedProperty) {
        setActivePrestations(new Set());
        return;
      }
      const active = new Set<string>();
      for (const p of PRESTATIONS) {
        const val = selectedProperty[p.propertyField];
        if (p.type === 'boolean' && val === true) active.add(p.key);
        if (p.type === 'count' && typeof val === 'number' && val > 0) active.add(p.key);
      }
      setActivePrestations(active);
    }, [selectedProperty]);

    const handleTogglePrestation = useCallback((key: string) => {
      setActivePrestations(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }, []);

    // Available prestations: only those the property actually has
    const availablePrestations = useMemo(() => {
      if (!selectedProperty) return [];
      return PRESTATIONS.filter(p => {
        const val = selectedProperty[p.propertyField];
        if (p.type === 'boolean') return val === true;
        if (p.type === 'count') return typeof val === 'number' && val > 0;
        return false;
      });
    }, [selectedProperty]);

    // ─── Checklist consignes de ménage ───
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(() =>
      cleaningNotes ? parseCleaningNotesToChecklist(cleaningNotes) : []
    );
    const [newItemText, setNewItemText] = useState('');

    // Sync checklist when cleaningNotes change (property selection)
    React.useEffect(() => {
      if (cleaningNotes) {
        setChecklistItems(parseCleaningNotesToChecklist(cleaningNotes));
      } else {
        setChecklistItems([]);
      }
    }, [cleaningNotes]);

    // Sync description when property changes
    React.useEffect(() => {
      setLocalDescription('');
    }, [propertyDescription]);

    // Sync description to form field
    // In edit mode, skip auto-fill: the SR's saved description was already loaded
    // by the parent (reset(...)) and overwriting it with the property description
    // can blow past the @Size(max=1000) backend validation when the property has a
    // long marketing copy.
    React.useEffect(() => {
      if (isEditMode) return;
      const desc = propertyDescription || localDescription || '';
      const checklistText = checklistItems
        .map(item => `${item.checked ? '[x]' : '[ ]'} ${item.text}`)
        .join('\n');
      const fullDescription = [desc, checklistText].filter(Boolean).join('\n\n---\n');
      setValue('description', fullDescription);
    }, [propertyDescription, localDescription, checklistItems, setValue, isEditMode]);

    const handleToggleItem = useCallback((id: string) => {
      setChecklistItems(prev =>
        prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item)
      );
    }, []);

    const handleRemoveItem = useCallback((id: string) => {
      setChecklistItems(prev => prev.filter(item => item.id !== id));
    }, []);

    const handleAddItem = useCallback(() => {
      const text = newItemText.trim();
      if (!text) return;
      setChecklistItems(prev => [
        ...prev,
        { id: `custom-${Date.now()}`, text, checked: false },
      ]);
      setNewItemText('');
    }, [newItemText]);

    const handleAddItemKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddItem();
      }
    }, [handleAddItem]);

    // Catégorie active (déduite du serviceType sélectionné)
    const activeCategory = useMemo(() => getCategoryForType(watchedServiceType), [watchedServiceType]);

    // Sous-types filtrés pour la catégorie active
    const subTypes = useMemo(() => {
      const cat = CATEGORIES.find(c => c.key === activeCategory);
      if (!cat) return [];
      return INTERVENTION_TYPE_OPTIONS.filter(o => cat.mappedCategories.includes(o.category));
    }, [activeCategory]);

    // Gestion du clic sur catégorie : sélectionner le premier sous-type
    const handleCategoryClick = (cat: CategoryDef) => {
      const firstOption = INTERVENTION_TYPE_OPTIONS.find(o => cat.mappedCategories.includes(o.category));
      if (firstOption) {
        setValue('serviceType', firstOption.value, { shouldValidate: true });
      }
    };

    // Gestion du clic sur sous-type
    const handleSubTypeClick = (option: InterventionTypeOption) => {
      setValue('serviceType', option.value, { shouldValidate: true });
    };

    return (
      <>
        {/* Informations de base */}
        <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', mb: 1.5 }}>
          {t('serviceRequests.sections.basicInfo')}
        </Typography>

        {/* Description du logement & Consignes de ménage — toujours visibles */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          {/* Description du logement */}
          <Box sx={{
            flex: 1,
            display: 'flex',
            gap: 1,
            py: 1.25,
            px: 1.5,
            borderRadius: '9px',
            bgcolor: 'var(--field)',
            border: '1px solid var(--field-line)',
            minHeight: 80,
          }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)', mt: 0.125, flexShrink: 0 }}><Description size={16} strokeWidth={1.75} /></Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', mb: 0.5 }}>
                Description du logement
              </Typography>
              {propertyDescription ? (
                <Typography sx={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                  {propertyDescription}
                </Typography>
              ) : (
                <TextField
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={5}
                  placeholder="Décrivez le logement..."
                  disabled={disabled}
                  size="small"
                  variant="standard"
                  InputProps={{ disableUnderline: true }}
                  sx={{
                    '& .MuiInputBase-root': { fontSize: '12px', color: 'var(--muted)', lineHeight: 1.4, p: 0 },
                    '& .MuiInputBase-input::placeholder': { fontSize: '12px', color: 'var(--faint)' },
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Consignes de ménage — checklist (bloc accent-soft) */}
          <Box sx={{
            flex: 1,
            display: 'flex',
            gap: 1,
            py: 1.25,
            px: 1.5,
            borderRadius: '9px',
            bgcolor: 'var(--accent-soft)',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
            minHeight: 80,
          }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mt: 0.125, flexShrink: 0 }}><Checklist size={16} strokeWidth={1.75} /></Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--accent)', mb: 0.5 }}>
                Consignes de ménage
              </Typography>

              {/* Checklist items */}
              {checklistItems.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {checklistItems.map((item) => (
                    <Box
                      key={item.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 0.25,
                        py: 0.125,
                        '&:hover .remove-btn': { opacity: 1 },
                      }}
                    >
                      <Checkbox
                        checked={item.checked}
                        onChange={() => handleToggleItem(item.id)}
                        disabled={disabled}
                        size="small"
                        sx={{ p: 0.25, mt: -0.125 }}
                      />
                      <Typography
                        sx={{
                          fontSize: '11.5px',
                          color: item.checked ? 'var(--faint)' : 'var(--body)',
                          lineHeight: 1.4,
                          textDecoration: item.checked ? 'line-through' : 'none',
                          flex: 1,
                          pt: 0.25,
                        }}
                      >
                        {item.text}
                      </Typography>
                      {!disabled && (
                        <IconButton
                          className="remove-btn"
                          size="small"
                          onClick={() => handleRemoveItem(item.id)}
                          sx={{ p: 0.25, opacity: 0, transition: 'opacity 0.15s', color: 'var(--faint)', '&:hover': { color: 'var(--err)' } }}
                        >
                          <Close size={12} strokeWidth={1.75} />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              {/* Add new item */}
              {!disabled && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', flexShrink: 0 }}><Add size={14} strokeWidth={1.75} /></Box>
                  <TextField
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={handleAddItemKeyDown}
                    placeholder="Ajouter une consigne..."
                    fullWidth
                    size="small"
                    variant="standard"
                    InputProps={{ disableUnderline: true }}
                    sx={{
                      '& .MuiInputBase-root': { fontSize: '11.5px', color: 'var(--body)', p: 0 },
                      '& .MuiInputBase-input::placeholder': { fontSize: '11.5px', color: 'var(--faint)' },
                    }}
                  />
                </Box>
              )}

              {/* Empty state */}
              {checklistItems.length === 0 && disabled && (
                <Typography sx={{ fontSize: '11.5px', color: 'var(--faint)', fontStyle: 'italic' }}>
                  Aucune consigne
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        {/* Type de service — Catégories principales */}
        <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', mb: 1 }}>
          {t('serviceRequests.fields.serviceType')} *
        </Typography>

        <Controller
          name="serviceType"
          control={control}
          render={({ fieldState }) => (
            <Box>
              {/* 3 catégories — chips sélecteurs : actif = texte couleur + fond -soft */}
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.key;
                  return (
                    <Chip
                      key={cat.key}
                      icon={cat.icon}
                      label={cat.label}
                      onClick={disabled ? undefined : () => handleCategoryClick(cat)}
                      disabled={disabled}
                      aria-pressed={isActive}
                      sx={{
                        height: 30,
                        fontSize: '11.5px',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor: isActive ? cat.fg : 'var(--line-2)',
                        bgcolor: isActive ? cat.bg : 'var(--card)',
                        color: isActive ? cat.fg : 'var(--body)',
                        '& .MuiChip-icon': {
                          fontSize: 16,
                          color: isActive ? cat.fg : 'var(--muted)',
                        },
                        '&:hover': disabled ? {} : {
                          bgcolor: isActive ? cat.bg : 'var(--hover)',
                          borderColor: cat.fg,
                        },
                        cursor: disabled ? 'default' : 'pointer',
                        opacity: disabled ? 0.45 : 1,
                        transition: 'background-color .15s, border-color .15s, color .15s',
                      }}
                    />
                  );
                })}
              </Box>

              {/* Sous-types (checkboxes visuelles) */}
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {subTypes.map((option) => {
                  const isSelected = watchedServiceType === option.value;
                  const activeCat = CATEGORIES.find(c => c.key === activeCategory);
                  const catFg = activeCat?.fg || 'var(--accent)';
                  const catBg = activeCat?.bg || 'var(--accent-soft)';
                  const IconComponent = option.icon;

                  return (
                    <Chip
                      key={option.value}
                      icon={<IconComponent size={14} strokeWidth={1.75} />}
                      label={option.label}
                      onClick={disabled ? undefined : () => handleSubTypeClick(option)}
                      disabled={disabled}
                      size="small"
                      aria-pressed={isSelected}
                      sx={{
                        height: 30,
                        fontSize: '11.5px',
                        fontWeight: isSelected ? 600 : 500,
                        border: '1px solid',
                        borderColor: isSelected ? catFg : 'var(--line-2)',
                        bgcolor: isSelected ? catBg : 'var(--card)',
                        color: isSelected ? catFg : 'var(--body)',
                        '& .MuiChip-icon': {
                          fontSize: 14,
                          ml: 0.5,
                          color: isSelected ? catFg : 'var(--muted)',
                        },
                        '& .MuiChip-label': { px: 0.75 },
                        '&:hover': disabled ? {} : {
                          bgcolor: isSelected ? catBg : 'var(--hover)',
                          borderColor: catFg,
                        },
                        cursor: disabled ? 'default' : 'pointer',
                        opacity: disabled ? 0.45 : 1,
                        transition: 'background-color .15s, border-color .15s, color .15s',
                      }}
                    />
                  );
                })}
              </Box>

              {/* Erreur de validation */}
              {fieldState.error && (
                <FormHelperText error sx={{ mt: 0.5 }}>
                  {fieldState.error.message}
                </FormHelperText>
              )}
            </Box>
          )}
        />

        {/* ─── Prestations à la carte ─── */}
        {availablePrestations.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', mb: 1 }}>
              Prestations à la carte
            </Typography>

            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {availablePrestations.map((p) => {
                const isActive = activePrestations.has(p.key);
                const isIncluded = (includedPrestations || []).includes(p.key);
                const isExtra = (extraPrestations || []).includes(p.key);
                const count = p.type === 'count' && selectedProperty
                  ? (selectedProperty[p.propertyField] as number)
                  : undefined;
                const chipLabel = count != null && count > 0
                  ? `${p.label} (${count})`
                  : p.label;
                const extraLabel = p.type === 'count' && count
                  ? `+${p.extraMins * count} min`
                  : `+${p.extraMins} min`;

                return (
                  <Chip
                    key={p.key}
                    icon={p.icon}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>{chipLabel}</span>
                        {isIncluded ? (
                          <Typography component="span" sx={{ fontSize: '9.5px', color: 'var(--ok)', fontWeight: 700, bgcolor: 'var(--ok-soft)', px: 0.5, py: 0.1, borderRadius: '4px' }}>
                            Inclus
                          </Typography>
                        ) : (
                          <Typography component="span" sx={{ fontSize: '10px', color: isActive ? 'var(--accent)' : 'var(--faint)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                            {extraLabel}
                          </Typography>
                        )}
                      </Box>
                    }
                    onClick={disabled ? undefined : () => handleTogglePrestation(p.key)}
                    disabled={disabled}
                    size="small"
                    aria-pressed={isActive}
                    sx={{
                      height: 30,
                      fontSize: '11.5px',
                      fontWeight: isActive ? 600 : 500,
                      border: '1px solid',
                      borderColor: isActive ? 'var(--accent)' : 'var(--line-2)',
                      bgcolor: isActive ? 'var(--accent-soft)' : 'var(--card)',
                      color: isActive ? 'var(--accent)' : 'var(--body)',
                      '& .MuiChip-icon': {
                        fontSize: 14,
                        ml: 0.5,
                        color: isActive ? 'var(--accent)' : 'var(--muted)',
                      },
                      '& .MuiChip-label': { px: 0.75 },
                      '&:hover': disabled ? {} : {
                        bgcolor: isActive ? 'var(--accent-soft)' : 'var(--hover)',
                        borderColor: 'var(--accent)',
                      },
                      cursor: disabled ? 'default' : 'pointer',
                      opacity: disabled ? 0.45 : 1,
                      transition: 'background-color .15s, border-color .15s, color .15s',
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        )}
      </>
    );
  }
);

ServiceRequestFormInfo.displayName = 'ServiceRequestFormInfo';

export default ServiceRequestFormInfo;
