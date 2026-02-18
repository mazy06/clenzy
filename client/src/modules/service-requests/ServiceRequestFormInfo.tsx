import React, { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Chip,
  FormHelperText,
  Checkbox,
  IconButton,
  alpha,
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
} from '@mui/icons-material';
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
  color: string;
  /** Catégories interventionTypes.ts correspondantes */
  mappedCategories: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    key: 'cleaning',
    label: 'Nettoyage',
    icon: <AutoAwesome sx={{ fontSize: 16 }} />,
    color: '#4caf50',
    mappedCategories: ['cleaning'],
  },
  {
    key: 'maintenance',
    label: 'Maintenance / Travaux',
    icon: <Build sx={{ fontSize: 16 }} />,
    color: '#ff9800',
    mappedCategories: ['maintenance'],
  },
  {
    key: 'other',
    label: 'Autre',
    icon: <MoreHoriz sx={{ fontSize: 16 }} />,
    color: '#9e9e9e',
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
  { key: 'laundry', label: 'Linge', icon: <LocalLaundryService sx={{ fontSize: 14 }} />, extraMins: 10, type: 'boolean', propertyField: 'hasLaundry' },
  { key: 'exterior', label: 'Extérieur', icon: <Deck sx={{ fontSize: 14 }} />, extraMins: 25, type: 'boolean', propertyField: 'hasExterior' },
  { key: 'ironing', label: 'Repassage', icon: <Iron sx={{ fontSize: 14 }} />, extraMins: 20, type: 'boolean', propertyField: 'hasIroning' },
  { key: 'deepKitchen', label: 'Cuisine profonde', icon: <Kitchen sx={{ fontSize: 14 }} />, extraMins: 30, type: 'boolean', propertyField: 'hasDeepKitchen' },
  { key: 'disinfection', label: 'Désinfection', icon: <Sanitizer sx={{ fontSize: 14 }} />, extraMins: 40, type: 'boolean', propertyField: 'hasDisinfection' },
  { key: 'windows', label: 'Fenêtres', icon: <Window sx={{ fontSize: 14 }} />, extraMins: 5, type: 'count', propertyField: 'windowCount' },
  { key: 'frenchDoors', label: 'Portes-fenêtres', icon: <DoorSliding sx={{ fontSize: 14 }} />, extraMins: 8, type: 'count', propertyField: 'frenchDoorCount' },
  { key: 'slidingDoors', label: 'Baies vitrées', icon: <DoorSliding sx={{ fontSize: 14 }} />, extraMins: 12, type: 'count', propertyField: 'slidingDoorCount' },
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
  ({ control, errors, setValue, watchedServiceType, disabled = false, propertyDescription, cleaningNotes, selectedProperty, includedPrestations, extraPrestations }) => {
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
    React.useEffect(() => {
      const desc = propertyDescription || localDescription || '';
      const checklistText = checklistItems
        .map(item => `${item.checked ? '[x]' : '[ ]'} ${item.text}`)
        .join('\n');
      const fullDescription = [desc, checklistText].filter(Boolean).join('\n\n---\n');
      setValue('description', fullDescription);
    }, [propertyDescription, localDescription, checklistItems, setValue]);

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
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1.5 }}>
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
            borderRadius: 1.5,
            bgcolor: 'grey.50',
            border: '1px solid',
            borderColor: 'grey.200',
            minHeight: 80,
          }}>
            <Description sx={{ fontSize: 16, color: 'text.disabled', mt: 0.125, flexShrink: 0 }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.disabled', mb: 0.5 }}>
                Description du logement
              </Typography>
              {propertyDescription ? (
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
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
                    '& .MuiInputBase-root': { fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4, p: 0 },
                    '& .MuiInputBase-input::placeholder': { fontSize: '0.75rem', color: 'text.disabled' },
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Consignes de ménage — checklist */}
          <Box sx={{
            flex: 1,
            display: 'flex',
            gap: 1,
            py: 1.25,
            px: 1.5,
            borderRadius: 1.5,
            bgcolor: 'primary.50',
            border: '1px solid',
            borderColor: 'primary.100',
            minHeight: 80,
          }}>
            <Checklist sx={{ fontSize: 16, color: 'primary.main', mt: 0.125, flexShrink: 0 }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'primary.main', mb: 0.5 }}>
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
                        sx={{ p: 0.25, mt: -0.125, color: 'primary.300', '&.Mui-checked': { color: 'primary.main' } }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.7rem',
                          color: item.checked ? 'text.disabled' : 'text.secondary',
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
                          sx={{ p: 0.25, opacity: 0, transition: 'opacity 0.15s', color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                        >
                          <Close sx={{ fontSize: 12 }} />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              {/* Add new item */}
              {!disabled && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <Add sx={{ fontSize: 14, color: 'primary.main', flexShrink: 0 }} />
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
                      '& .MuiInputBase-root': { fontSize: '0.7rem', color: 'text.secondary', p: 0 },
                      '& .MuiInputBase-input::placeholder': { fontSize: '0.7rem', color: 'text.disabled' },
                    }}
                  />
                </Box>
              )}

              {/* Empty state */}
              {checklistItems.length === 0 && disabled && (
                <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', fontStyle: 'italic' }}>
                  Aucune consigne
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        {/* Type de service — Catégories principales */}
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1 }}>
          {t('serviceRequests.fields.serviceType')} *
        </Typography>

        <Controller
          name="serviceType"
          control={control}
          render={({ fieldState }) => (
            <Box>
              {/* 3 catégories */}
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
                      variant={isActive ? 'filled' : 'outlined'}
                      sx={{
                        height: 30,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderWidth: 1.5,
                        borderColor: isActive ? cat.color : 'divider',
                        bgcolor: isActive ? alpha(cat.color, 0.1) : 'transparent',
                        color: isActive ? cat.color : 'text.secondary',
                        '& .MuiChip-icon': {
                          fontSize: 16,
                          color: isActive ? cat.color : 'text.secondary',
                        },
                        '&:hover': disabled ? {} : {
                          bgcolor: alpha(cat.color, 0.08),
                          borderColor: cat.color,
                        },
                        cursor: disabled ? 'default' : 'pointer',
                        opacity: disabled ? 0.5 : 1,
                        transition: 'all 0.15s ease',
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
                  const catColor = activeCat?.color || '#6B8A9A';
                  const IconComponent = option.icon;

                  return (
                    <Chip
                      key={option.value}
                      icon={<IconComponent sx={{ fontSize: 14 }} />}
                      label={option.label}
                      onClick={disabled ? undefined : () => handleSubTypeClick(option)}
                      disabled={disabled}
                      variant={isSelected ? 'filled' : 'outlined'}
                      size="small"
                      sx={{
                        height: 30,
                        fontSize: '0.75rem',
                        fontWeight: isSelected ? 600 : 500,
                        borderWidth: 1.5,
                        borderColor: isSelected ? catColor : 'grey.200',
                        bgcolor: isSelected ? alpha(catColor, 0.12) : 'transparent',
                        color: isSelected ? catColor : 'text.secondary',
                        '& .MuiChip-icon': {
                          fontSize: 14,
                          ml: 0.5,
                          color: isSelected ? catColor : 'primary.main',
                        },
                        '& .MuiChip-label': { px: 0.75 },
                        '&:hover': disabled ? {} : {
                          bgcolor: alpha(catColor, 0.06),
                          borderColor: catColor,
                        },
                        cursor: disabled ? 'default' : 'pointer',
                        opacity: disabled ? 0.5 : 1,
                        transition: 'all 0.15s ease',
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
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1 }}>
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
                          <Typography component="span" sx={{ fontSize: '0.5rem', color: 'success.main', fontWeight: 700, bgcolor: alpha('#4caf50', 0.12), px: 0.5, py: 0.1, borderRadius: 0.5 }}>
                            Inclus
                          </Typography>
                        ) : (
                          <Typography component="span" sx={{ fontSize: '0.5625rem', color: isActive ? 'primary.main' : 'text.disabled', fontWeight: 500 }}>
                            {extraLabel}
                          </Typography>
                        )}
                      </Box>
                    }
                    onClick={disabled ? undefined : () => handleTogglePrestation(p.key)}
                    disabled={disabled}
                    variant={isActive ? 'filled' : 'outlined'}
                    size="small"
                    sx={{
                      height: 30,
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 600 : 500,
                      borderWidth: 1.5,
                      borderColor: isActive ? 'primary.main' : 'grey.200',
                      bgcolor: isActive ? alpha('#6B8A9A', 0.1) : 'transparent',
                      color: isActive ? 'primary.main' : 'text.secondary',
                      '& .MuiChip-icon': {
                        fontSize: 14,
                        ml: 0.5,
                        color: isActive ? 'primary.main' : 'grey.400',
                      },
                      '& .MuiChip-label': { px: 0.75 },
                      '&:hover': disabled ? {} : {
                        bgcolor: alpha('#6B8A9A', 0.06),
                        borderColor: 'primary.light',
                      },
                      cursor: disabled ? 'default' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                      transition: 'all 0.15s ease',
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
