import React, { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  InputBase,
  Chip,
  FormHelperText,
  IconButton,
} from '@mui/material';
import {
  AutoAwesome,
  Build,
  MoreHoriz,
  Add,
  EnterKey,
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
import { useCustomServiceTypes } from '../../hooks/useCustomServiceTypes';
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
  /** Contenu de chiffrage rendu CÔTE À CÔTE avec le bloc « Basic information »
   *  (devis/diagnostic ou estimation forfait). Optionnel : sans slot, le bloc
   *  d'infos occupe toute la largeur (formulaire pleine page). */
  pricingSlot?: React.ReactNode;
  /** Encadre le bloc dans une carte (modale). Indépendant de `pricingSlot`
   *  depuis que le chiffrage est une étape séparée. */
  framed?: boolean;
  /** Catalogue des prestations « travaux » (config tarifaire) affiché en chips
   *  pour la maintenance. Un clic (dé)sélectionne la prestation dans le devis. */
  workPrestations?: WorkPrestation[];
  /** Types de prestation déjà présents dans le devis (chips surlignés). */
  selectedWorkTypes?: string[];
  /** Bascule une prestation du catalogue dans/hors du devis (multi-sélection). */
  onToggleWorkPrestation?: (label: string, unitPrice: number, interventionType?: string) => void;
}

/** Prestation « travaux » issue de la config tarifaire. */
export interface WorkPrestation {
  interventionType: string;
  label: string;
  basePrice: number;
  /** Domaine de classement (ex: "Plomberie", "Électricité"). */
  domain?: string;
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

const ServiceRequestFormInfo: React.FC<ServiceRequestFormInfoProps> = React.memo(
  ({ control, errors, setValue, watchedServiceType, disabled = false, cleaningNotes, selectedProperty, includedPrestations, extraPrestations, isEditMode = false, pricingSlot, framed = false, workPrestations, selectedWorkTypes, onToggleWorkPrestation }) => {
    const { t } = useTranslation();

    // ─── Type de service personnalisé (« Autre » dans une catégorie) ───
    // customCategory != null → l'utilisateur a cliqué « Autre » dans Nettoyage ou
    // Maintenance : serviceType = OTHER, mais on garde la catégorie AFFICHÉE (chip
    // + rangée de sous-types) pour l'orientation. Le libellé saisi devient le titre.
    const [customCategory, setCustomCategory] = useState<ServiceCategory | null>(null);
    const [customLabel, setCustomLabel] = useState('');
    const [isAddingCustom, setIsAddingCustom] = useState(false);
    const [newCustomText, setNewCustomText] = useState('');

    // Catégorie RÉELLE (déduite du serviceType) → pilote le CONTENU (consignes vs
    // tâches, prestations). OTHER → 'other' → blocs génériques.
    const contentCategory = getCategoryForType(watchedServiceType);
    const isCleaning = contentCategory === 'cleaning';
    // Catégorie AFFICHÉE (chips + sous-types) : conserve Nettoyage/Maintenance même
    // en « Autre » personnalisé.
    const activeCategory = customCategory ?? contentCategory;
    const isCustom = watchedServiceType === 'OTHER';

    // Types personnalisés réutilisables (« Autre ») pour la catégorie affichée.
    const customTypeCategory =
      activeCategory === 'cleaning' || activeCategory === 'maintenance' ? activeCategory : null;
    const { types: customTypes, createType } = useCustomServiceTypes(customTypeCategory);

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

    const includedPrestationsSet = useMemo(() => new Set(includedPrestations || []), [includedPrestations]);
    const extraPrestationsSet = useMemo(() => new Set(extraPrestations || []), [extraPrestations]);

    // Un type concret (non OTHER) — y compris après reset du formulaire — sort du
    // mode « Autre » personnalisé.
    React.useEffect(() => {
      if (watchedServiceType !== 'OTHER') setCustomCategory(null);
    }, [watchedServiceType]);

    // Sous-types filtrés pour la catégorie active
    const subTypes = useMemo(() => {
      const cat = CATEGORIES.find(c => c.key === activeCategory);
      if (!cat) return [];
      return INTERVENTION_TYPE_OPTIONS.filter(o => cat.mappedCategories.includes(o.category));
    }, [activeCategory]);

    // Gestion du clic sur catégorie : sélectionner le premier sous-type
    const handleCategoryClick = (cat: CategoryDef) => {
      setCustomCategory(null);
      setIsAddingCustom(false);
      const firstOption = INTERVENTION_TYPE_OPTIONS.find(o => cat.mappedCategories.includes(o.category));
      if (firstOption) {
        setValue('serviceType', firstOption.value, { shouldValidate: true });
      }
    };

    // Gestion du clic sur sous-type
    const handleSubTypeClick = (option: InterventionTypeOption) => {
      setCustomCategory(null);
      setIsAddingCustom(false);
      setValue('serviceType', option.value, { shouldValidate: true });
    };

    // Sélection d'un type personnalisé (existant ou fraîchement créé) :
    // serviceType = OTHER, catégorie affichée conservée, libellé = titre BRUT.
    // Le préfixe de catégorie (« Maintenance … ») est ajouté au RENDU (i18n),
    // jamais figé dans la donnée — évite le français en dur et le double préfixe.
    const selectCustomType = (cat: ServiceCategory, label: string) => {
      setCustomCategory(cat);
      setCustomLabel(label);
      setIsAddingCustom(false);
      setValue('serviceType', 'OTHER', { shouldValidate: true });
      setValue('title', label);
    };

    const openAddCustom = () => {
      setIsAddingCustom(true);
      setNewCustomText('');
    };

    const cancelAddCustom = () => {
      setIsAddingCustom(false);
      setNewCustomText('');
    };

    // Confirme la saisie du chip : enregistre le type en base (réutilisable) puis
    // le sélectionne. En cas d'échec réseau, on garde le champ ouvert.
    const confirmAddCustom = async () => {
      const label = newCustomText.trim();
      if (!label) { cancelAddCustom(); return; }
      const cat: ServiceCategory =
        activeCategory === 'cleaning' || activeCategory === 'maintenance' ? activeCategory : 'maintenance';
      try {
        const created = await createType(label);
        selectCustomType(cat, created ? created.label : label);
      } catch {
        // Laisse le champ ouvert pour un nouvel essai.
      }
    };

    // En maintenance, les sous-types sont remplacés par le CATALOGUE chiffré
    // (config travaux). Un clic sur une prestation ajoute une ligne de devis.
    const useWorkCatalogue = activeCategory === 'maintenance' && (workPrestations?.length ?? 0) > 0;

    const handleWorkPrestationClick = (wp: WorkPrestation) => {
      setIsAddingCustom(false);
      // À la SÉLECTION (pas à la désélection), on fixe le type primaire de la demande.
      const isSelected = (selectedWorkTypes ?? []).includes(wp.interventionType);
      if (!isSelected) {
        const known = INTERVENTION_TYPE_OPTIONS.some(o => o.value === wp.interventionType);
        if (known) {
          setCustomCategory(null);
          setValue('serviceType', wp.interventionType, { shouldValidate: true });
        } else {
          setCustomCategory('maintenance');
          setCustomLabel(wp.label);
          setValue('serviceType', 'OTHER', { shouldValidate: true });
          setValue('title', wp.label);
        }
      }
      onToggleWorkPrestation?.(wp.label, wp.basePrice, wp.interventionType);
    };

    // Catalogue maintenance regroupé par domaine pour la lisibilité.
    // « Général » en tête, puis ordre alphabétique ; domaine absent → « Autres ».
    const workDomainGroups = (() => {
      if (!useWorkCatalogue) return [];
      const byDomain = new Map<string, WorkPrestation[]>();
      (workPrestations ?? []).forEach((wp) => {
        const key = wp.domain?.trim() || 'Autres';
        const bucket = byDomain.get(key) ?? [];
        bucket.push(wp);
        byDomain.set(key, bucket);
      });
      return Array.from(byDomain.entries()).sort(([a], [b]) => {
        if (a === 'Général') return -1;
        if (b === 'Général') return 1;
        if (a === 'Autres') return 1;
        if (b === 'Autres') return -1;
        return a.localeCompare(b, 'fr');
      });
    })();

    // Rendu d'un chip de prestation catalogue (réutilisé dans chaque groupe de domaine).
    const renderWorkChip = (wp: WorkPrestation) => {
      const isSelected = (selectedWorkTypes ?? []).includes(wp.interventionType);
      const activeCat = CATEGORIES.find(c => c.key === 'maintenance');
      const catFg = activeCat?.fg || 'var(--accent)';
      const catBg = activeCat?.bg || 'var(--accent-soft)';
      return (
        <Chip
          key={wp.interventionType}
          icon={<Build size={14} strokeWidth={1.75} />}
          label={
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <span>{wp.label}</span>
              {wp.basePrice > 0 && (
                <Box component="span" sx={{ fontSize: '10px', fontWeight: 600, color: isSelected ? catFg : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {wp.basePrice} €
                </Box>
              )}
            </Box>
          }
          onClick={disabled ? undefined : () => handleWorkPrestationClick(wp)}
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
            '& .MuiChip-icon': { fontSize: 14, ml: 0.5, color: isSelected ? catFg : 'var(--muted)' },
            '& .MuiChip-label': { px: 0.75 },
            '&:hover': disabled ? {} : { bgcolor: isSelected ? catBg : 'var(--hover)', borderColor: catFg },
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.45 : 1,
            transition: 'background-color .15s, border-color .15s, color .15s',
          }}
        />
      );
    };

    return (
      // Carte unifiée : Service type + Tâches + Chiffrage forment un seul bloc
      // relié (séparateur entre la sélection du type et le détail dessous). Le
      // cadre n'est posé qu'avec un slot chiffrage (modale) pour éviter le
      // « card-in-card » du formulaire pleine page (déjà dans un Paper).
      <Box sx={{ display: 'flex', flexDirection: 'column', ...((framed || pricingSlot) ? { border: '1px solid var(--line)', borderRadius: '14px', p: 2 } : {}) }}>
        {/* Chiffrage — positionné après « Service type » via l'ordre flex (order: 2). */}
        {pricingSlot && (
          <Box sx={{ order: 2, mt: 2 }}>
            {pricingSlot}
          </Box>
        )}

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

              {/* Catalogue maintenance chiffré, regroupé par domaine */}
              {useWorkCatalogue && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {workDomainGroups.map(([domain, items]) => (
                    <Box key={domain}>
                      <Typography
                        sx={{
                          fontSize: '10px', fontWeight: 700, color: 'var(--faint)',
                          textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.625,
                        }}
                      >
                        {domain}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        {items.map((wp) => renderWorkChip(wp))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Sous-types (sélecteur, non-maintenance) + types personnalisés */}
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {!useWorkCatalogue && subTypes.map((option) => {
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
                {/* Types personnalisés enregistrés + saisie d'un nouveau (Nettoyage & Maintenance) */}
                {(activeCategory === 'cleaning' || activeCategory === 'maintenance') && (() => {
                  const activeCat = CATEGORIES.find(c => c.key === activeCategory);
                  const catFg = activeCat?.fg || 'var(--accent)';
                  const catBg = activeCat?.bg || 'var(--accent-soft)';
                  return (
                    <>
                      {/* Chips des types déjà enregistrés (réutilisables) */}
                      {customTypes.map((ct) => {
                        const selected = isCustom && customLabel === ct.label;
                        return (
                          <Chip
                            key={ct.id}
                            icon={<MoreHoriz size={14} strokeWidth={1.75} />}
                            label={ct.label}
                            onClick={disabled ? undefined : () => selectCustomType(activeCategory, ct.label)}
                            disabled={disabled}
                            size="small"
                            aria-pressed={selected}
                            sx={{
                              height: 30,
                              fontSize: '11.5px',
                              fontWeight: selected ? 600 : 500,
                              border: '1px solid',
                              borderColor: selected ? catFg : 'var(--line-2)',
                              bgcolor: selected ? catBg : 'var(--card)',
                              color: selected ? catFg : 'var(--body)',
                              '& .MuiChip-icon': { fontSize: 14, ml: 0.5, color: selected ? catFg : 'var(--muted)' },
                              '& .MuiChip-label': { px: 0.75 },
                              '&:hover': disabled ? {} : { bgcolor: selected ? catBg : 'var(--hover)', borderColor: catFg },
                              cursor: disabled ? 'default' : 'pointer',
                              opacity: disabled ? 0.45 : 1,
                              transition: 'background-color .15s, border-color .15s, color .15s',
                            }}
                          />
                        );
                      })}
                      {/* « Autre » : la saisie se fait DANS le chip, validée par Entrée */}
                      {isAddingCustom ? (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.25,
                            height: 30,
                            pl: 1,
                            pr: 0.25,
                            borderRadius: '15px',
                            border: `1px solid ${catFg}`,
                            bgcolor: catBg,
                          }}
                        >
                          <Box component="span" sx={{ display: 'inline-flex', color: catFg, flexShrink: 0 }}><MoreHoriz size={14} strokeWidth={1.75} /></Box>
                          <InputBase
                            autoFocus
                            value={newCustomText}
                            onChange={(e) => setNewCustomText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); confirmAddCustom(); }
                              else if (e.key === 'Escape') { cancelAddCustom(); }
                            }}
                            onBlur={() => { if (!newCustomText.trim()) cancelAddCustom(); }}
                            placeholder="Nouveau type…"
                            sx={{ fontSize: '11.5px', color: catFg, width: 150, '& input': { p: 0 }, '& input::placeholder': { color: 'var(--faint)', opacity: 1 } }}
                          />
                          <IconButton
                            size="small"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={confirmAddCustom}
                            aria-label="Enregistrer le type de service"
                            sx={{ p: 0.25, color: catFg }}
                          >
                            <EnterKey size={14} strokeWidth={1.75} />
                          </IconButton>
                        </Box>
                      ) : (
                        <Chip
                          icon={<Add size={14} strokeWidth={1.75} />}
                          label="Autre"
                          onClick={disabled ? undefined : openAddCustom}
                          disabled={disabled}
                          size="small"
                          sx={{
                            height: 30,
                            fontSize: '11.5px',
                            fontWeight: 500,
                            border: '1px dashed var(--line-2)',
                            bgcolor: 'var(--card)',
                            color: 'var(--muted)',
                            '& .MuiChip-icon': { fontSize: 14, ml: 0.5, color: 'var(--muted)' },
                            '& .MuiChip-label': { px: 0.75 },
                            '&:hover': disabled ? {} : { borderColor: catFg, color: catFg, bgcolor: 'var(--hover)' },
                            cursor: disabled ? 'default' : 'pointer',
                            opacity: disabled ? 0.45 : 1,
                            transition: 'background-color .15s, border-color .15s, color .15s',
                          }}
                        />
                      )}
                    </>
                  );
                })()}
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

        {/* ─── Prestations à la carte (ménage uniquement) ─── */}
        {isCleaning && availablePrestations.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', mb: 1 }}>
              Prestations à la carte
            </Typography>

            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {availablePrestations.map((p) => {
                const isActive = activePrestations.has(p.key);
                const isIncluded = includedPrestationsSet.has(p.key);
                const isExtra = extraPrestationsSet.has(p.key);
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

        {/* Séparateur reliant la sélection du type au chiffrage (modale). */}
        {pricingSlot && <Box sx={{ order: 1, borderTop: '1px solid var(--line)', mt: 2 }} />}
      </Box>
    );
  }
);

ServiceRequestFormInfo.displayName = 'ServiceRequestFormInfo';

export default ServiceRequestFormInfo;
