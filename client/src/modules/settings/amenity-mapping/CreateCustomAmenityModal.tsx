/**
 * Modal de creation d'une commodite Baitly custom.
 *
 * UX :
 *   - Pre-remplie avec le rawOtaName si on arrive depuis un item "a mapper"
 *   - Slugifie le label en code SCREAMING_SNAKE_CASE (preview live)
 *   - Cree optionnellement un alias auto rawName → code
 *   - Cochee par defaut : "Appliquer aux X propriete(s)"
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Button } from '../../../components/ui';
import {
  Alert,
  AlertDescription,
  Checkbox,
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
} from '../../../components/ui';

import {
  amenitiesManagementApi,
  type ChannexFacilityOption,
} from '../../../services/api/amenitiesManagementApi';
import AmenityIconPicker from './AmenityIconPicker';
import { ICON_REGISTRY } from './amenityIcons';
import { useAmenityIconOverrides } from './useAmenityIconOverrides';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';

const CATEGORY_OPTIONS = [
  { value: 'comfort',      label: 'Confort' },
  { value: 'kitchen',      label: 'Cuisine' },
  { value: 'appliances',   label: 'Électroménager' },
  { value: 'outdoor',      label: 'Extérieur' },
  { value: 'safetyFamily', label: 'Sécurité & famille' },
  { value: 'custom',       label: 'Custom' },
];

interface CreateCustomAmenityModalProps {
  open: boolean;
  /** Pre-fill avec le nom OTA brut + affected count si on arrive depuis "À mapper". */
  prefillRawName?: string | null;
  prefillAffectedCount?: number;
  onClose: () => void;
  onCreated: () => void;
}

/** Slugify : "Détecteur de fumée" → "DETECTEUR_DE_FUMEE". */
function slugifyCode(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function CreateCustomAmenityModal({
  open, prefillRawName, prefillAffectedCount = 0, onClose, onCreated,
}: CreateCustomAmenityModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { setIcon: setIconOverride } = useAmenityIconOverrides(
    user?.organizationId ?? null,
  );

  const [labelFr, setLabelFr] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [category, setCategory] = useState('custom');
  const [code, setCode] = useState('');
  const [autoAlias, setAutoAlias] = useState(true);
  const [applyNow, setApplyNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Icone choisie par l'utilisateur pour la commodite (Sparkles par defaut).
  // Persiste apres creation reussie via useAmenityIconOverrides (cle = code).
  const [selectedIconName, setSelectedIconName] = useState<string>('Sparkles');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // Catalogue Channex pour autocomplete labelEn (suggestions standardisees)
  const [channexCatalog, setChannexCatalog] = useState<ChannexFacilityOption[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Reset + prefill quand on ouvre
  useEffect(() => {
    if (open) {
      setLabelFr(prefillRawName ?? '');
      setLabelEn(prefillRawName ?? '');
      setCategory('custom');
      setCode('');
      setAutoAlias(!!prefillRawName);
      setApplyNow(prefillAffectedCount > 0);
      setSelectedIconName('Sparkles');
      setError(null);
    }
  }, [open, prefillRawName, prefillAffectedCount]);

  // Charge le catalogue Channex au premier ouverture (cache backend 1h)
  useEffect(() => {
    if (!open || channexCatalog.length > 0 || loadingCatalog) return;
    setLoadingCatalog(true);
    amenitiesManagementApi.listChannexFacilityCatalog()
      .then(setChannexCatalog)
      .catch(() => { /* silencieux — pas critique */ })
      .finally(() => setLoadingCatalog(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Le Combobox groupe attend des paquets { value, items } ; le catalogue
  // Channex arrive a plat, on le regroupe par categorie (ex-`groupBy` MUI).
  const groupedCatalog = useMemo(() => {
    const byCategory = new Map<string, ChannexFacilityOption[]>();
    for (const option of channexCatalog) {
      const bucket = byCategory.get(option.category);
      if (bucket) bucket.push(option);
      else byCategory.set(option.category, [option]);
    }
    return Array.from(byCategory, ([value, items]) => ({ value, items }));
  }, [channexCatalog]);

  // Code preview : auto-slug si user n'a pas saisi manuellement
  const previewCode = useMemo(
    () => code.trim() !== '' ? slugifyCode(code) : slugifyCode(labelFr),
    [code, labelFr],
  );

  const canSubmit = labelFr.trim().length >= 2 && previewCode.length >= 2;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await amenitiesManagementApi.createCustom({
        labelFr: labelFr.trim(),
        labelEn: labelEn.trim() || undefined,
        category,
        code: code.trim() || undefined,
        createAliasForRaw: autoAlias && prefillRawName ? prefillRawName : undefined,
        applyToProperties: applyNow,
      });
      // Persiste le choix d'icone si != defaut (Sparkles). La cle est le code
      // resolu (previewCode) — meme cle utilisee par AmenityMappingPage pour
      // resoudre l'icone via resolveAmenityIcon.
      if (selectedIconName !== 'Sparkles' && previewCode) {
        setIconOverride(previewCode, selectedIconName);
      }
      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création.');
    } finally {
      setSubmitting(false);
    }
  };

  // Composant icone preview pour le bouton "Choisir une icône"
  const PreviewIcon = ICON_REGISTRY[selectedIconName] ?? Sparkles;

  // Le Combobox du kit est bati sur Base UI : sa liste est portalisee dans le
  // body, donc HORS de la coque Radix de ce Dialog. Deux consequences a
  // neutraliser, sans quoi le champ « Label anglais » serait mort en silence :
  // (1) Radix pose `pointer-events: none` sur le body tant que la modale est
  // ouverte — la liste le recupere via `pointer-events-auto` ;
  // (2) un clic dans la liste compte comme « interaction exterieure » et
  // fermerait le Dialog — onInteractOutside l'ignore.
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="sm:max-w-[600px]"
        onInteractOutside={(event) => {
          const target = event.target as Element | null;
          if (target?.closest('[data-slot="combobox-content"]')) event.preventDefault();
        }}
      >
        {/* Les marges negatives annulent le padding de la coque pour un en-tete
            pleine largeur, comme le pied du kit le fait deja. */}
        <DialogHeader className="-mx-4 -mt-4 flex-row items-center justify-between border-b border-solid border-border px-4 py-2">
          <div>
            <DialogTitle className="text-sm font-semibold">Nouvelle commodité</DialogTitle>
            <span className="text-xs text-muted-foreground">
              Étend le référentiel Baitly pour votre organisation
            </span>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </Button>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto">
        {prefillRawName && (
          <Alert variant="info" className="mb-3 text-[0.8rem]">
            <AlertDescription>
              Détectée sur <strong>{prefillAffectedCount}</strong> propriété
              {prefillAffectedCount > 1 ? 's' : ''} sous le nom OTA brut «&nbsp;
              <span className="font-mono">{prefillRawName}</span>&nbsp;».
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="custom-amenity-label-fr">Label français *</FieldLabel>
            <Input
              id="custom-amenity-label-fr"
              value={labelFr}
              onChange={(e) => setLabelFr(e.target.value)}
              placeholder="ex : Détecteur de fumée"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="custom-amenity-label-en">Label anglais</FieldLabel>
            {/* Champ libre avec suggestions (ex-`freeSolo`) : la saisie est
                controlee, la selection d'une suggestion est consommee dans
                onValueChange. */}
            <Combobox<ChannexFacilityOption>
              items={groupedCatalog}
              itemToStringLabel={(option) => option.title}
              isItemEqualToValue={(option, other) => option.id === other.id}
              inputValue={labelEn}
              onInputValueChange={(next) => setLabelEn(next)}
              onValueChange={(next) => {
                if (!next) return;
                setLabelEn(next.title);
                // Si labelFr vide ou egal au prefill brut, suggere aussi le title
                if (!labelFr || labelFr === prefillRawName) setLabelFr(next.title);
              }}
            >
              <ComboboxInput
                id="custom-amenity-label-en"
                placeholder="ex : Smoke alarm — tape pour suggestions Channex"
              />
              <ComboboxContent className="pointer-events-auto">
                <ComboboxEmpty>Aucune suggestion Channex.</ComboboxEmpty>
                <ComboboxList>
                  {(group: { value: string; items: ChannexFacilityOption[] }) => (
                    <ComboboxGroup key={group.value} items={group.items}>
                      <ComboboxLabel>{group.value}</ComboboxLabel>
                      <ComboboxCollection>
                        {(option: ChannexFacilityOption) => (
                          <ComboboxItem key={option.id} value={option}>
                            <Sparkles size={12} className="me-2 text-[#8B5CF6]" />
                            <div>
                              <p className="text-sm">{option.title}</p>
                              <span className="block text-xs text-faint">
                                {option.category}
                              </span>
                            </div>
                          </ComboboxItem>
                        )}
                      </ComboboxCollection>
                    </ComboboxGroup>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <FieldDescription>
              {loadingCatalog
                ? 'Chargement du catalogue Channex…'
                : channexCatalog.length > 0
                  ? `Autocomplete depuis ${channexCatalog.length} libellés Channex standardisés`
                  : 'Utilisé par la booking engine multilingue.'}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="custom-amenity-category">Catégorie *</FieldLabel>
            <NativeSelect
              id="custom-amenity-category"
              className="w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <NativeSelectOption key={opt.value} value={opt.value}>{opt.label}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="custom-amenity-code">Code (auto si vide)</FieldLabel>
            <Input
              id="custom-amenity-code"
              className="font-mono text-[0.85rem]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={previewCode || 'AUTO_GENERATED'}
            />
            <FieldDescription>
              {code.trim()
                ? `Sera enregistré : ${previewCode}`
                : `Sera généré automatiquement : ${previewCode || '—'}`}
            </FieldDescription>
          </Field>

          {/* Icone : preview cliquable + label + bouton "Choisir" */}
          <div className="flex flex-row items-center gap-[9px]">
            {/* Vrai <button> et non un div `role="button"` : sans lui la preview
                sort de l'ordre de tabulation et ne repond ni a Entree ni a Espace. */}
            <button
              type="button"
              onClick={() => setIconPickerOpen(true)}
              aria-label={t('settings.amenities.changeIcon', "Changer l'icône")}
              className="size-10 rounded-md inline-flex items-center justify-center bg-primary-soft text-primary cursor-pointer border border-solid border-primary/20 transition-colors duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:bg-primary/15 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none"
            >
              <PreviewIcon size={20} strokeWidth={1.75} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[0.78rem] font-semibold">
                {t('settings.amenities.iconLabel', 'Icône')}
              </p>
              <span className="text-xs text-muted-foreground font-mono">
                {selectedIconName}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIconPickerOpen(true)}
            >
              {t('settings.amenities.changeIcon', "Changer l'icône")}
            </Button>
          </div>

          {prefillRawName && (
            <div className="flex flex-col gap-[3px]">
              <Field orientation="horizontal" className="gap-1.5">
                <Checkbox
                  id="custom-amenity-auto-alias"
                  checked={autoAlias}
                  onCheckedChange={(checked) => setAutoAlias(checked === true)}
                />
                <FieldLabel htmlFor="custom-amenity-auto-alias" className="text-xs font-normal text-muted-foreground">
                  Créer aussi l'alias «&nbsp;<strong>{prefillRawName}</strong>&nbsp;» → <strong>{previewCode || '...'}</strong>
                </FieldLabel>
              </Field>
              {prefillAffectedCount > 0 && (
                <Field orientation="horizontal" className="gap-1.5">
                  <Checkbox
                    id="custom-amenity-apply-now"
                    checked={applyNow}
                    onCheckedChange={(checked) => setApplyNow(checked === true)}
                    disabled={!autoAlias}
                  />
                  <FieldLabel htmlFor="custom-amenity-apply-now" className="text-xs font-normal text-muted-foreground">
                    Appliquer aux <strong>{prefillAffectedCount}</strong> propriété{prefillAffectedCount > 1 ? 's' : ''} maintenant
                  </FieldLabel>
                </Field>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="text-[0.8rem]">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        </div>

        <DialogFooter className="border-t border-solid border-border pt-[9px]">
          <Button onClick={onClose} variant="outline" size="sm">
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? 'Création…' : 'Créer la commodité'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Picker d'icone — meme composant que sur le tab Reference. Le choix est
          persiste localement apres creation reussie via setIconOverride.
          Il vit HORS du DialogContent : deux Dialog Radix imbriques s'empilent
          proprement (le plus recent reprend la main sur Echap et le clic). */}
      <AmenityIconPicker
        open={iconPickerOpen}
        amenityLabel={labelFr || t('settings.amenities.iconPicker.title', 'Choisir une icône')}
        amenityCode={previewCode || '—'}
        currentIcon={selectedIconName}
        isOverridden={selectedIconName !== 'Sparkles'}
        onClose={() => setIconPickerOpen(false)}
        onSelect={(name) => setSelectedIconName(name)}
        onReset={() => setSelectedIconName('Sparkles')}
      />
    </Dialog>
  );
}
