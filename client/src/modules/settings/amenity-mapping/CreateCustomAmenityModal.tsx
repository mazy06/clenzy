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
// Le Dialog reste MUI : il heberge un Autocomplete MUI (son renderInput recoit
// des props internes). Sous un Dialog Radix, la liste de l'Autocomplete est
// portalisee HORS du contenu modal -> clic traite comme « interaction exterieure »
// (fermeture) et piege de focus casse. On garde donc les deux du meme cote.
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete } from '@mui/material';
import { X, Sparkles } from 'lucide-react';
import { Button } from '../../../components/ui';
import {
  Alert,
  AlertDescription,
  Checkbox,
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid', borderColor: 'divider', py: 1.5,
      }}>
        <div>
          <h6 className="cn-text-subtitle1 font-semibold">Nouvelle commodité</h6>
          <span className="cn-text-caption text-muted-foreground">
            Étend le référentiel Baitly pour votre organisation
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer">
          <X size={18} />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5 }}>
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
          <Autocomplete
            freeSolo
            size="small"
            fullWidth
            options={channexCatalog}
            getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.title}
            value={labelEn}
            onInputChange={(_e, v) => setLabelEn(v)}
            onChange={(_e, v) => {
              if (typeof v === 'string') {
                setLabelEn(v);
              } else if (v) {
                setLabelEn(v.title);
                // Si labelFr vide ou egal au prefill brut, suggere aussi le title
                if (!labelFr || labelFr === prefillRawName) setLabelFr(v.title);
              }
            }}
            groupBy={(opt) => opt.category}
            renderOption={(props, opt) => (
              <li {...props}>
                <Sparkles size={12} style={{ marginRight: 8, color: '#8B5CF6' }} />
                <div>
                  <p className="cn-text-body1 text-[0.85rem]">{opt.title}</p>
                  <span className="cn-text-caption text-muted-foreground opacity-60 block">
                    {opt.category}
                  </span>
                </div>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Label anglais"
                placeholder="ex : Smoke alarm — tape pour suggestions Channex"
                helperText={
                  loadingCatalog
                    ? 'Chargement du catalogue Channex…'
                    : channexCatalog.length > 0
                      ? `Autocomplete depuis ${channexCatalog.length} libellés Channex standardisés`
                      : 'Utilisé par la booking engine multilingue.'
                }
              />
            )}
          />
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
            <div
              onClick={() => setIconPickerOpen(true)}
              role="button"
              tabIndex={0}
              aria-label={t('settings.amenities.changeIcon', "Changer l'icône")}
              className="w-10 h-10 rounded-[8px] inline-flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] cursor-pointer border border-solid border-[color-mix(in_srgb,var(--accent)_20%,transparent)] transition-all duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] hover:border-[var(--accent)] focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] focus-visible:outline-none"
            >
              <PreviewIcon size={20} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="cn-text-body1 text-[0.78rem] font-semibold">
                {t('settings.amenities.iconLabel', 'Icône')}
              </p>
              <span className="cn-text-caption text-muted-foreground font-mono">
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
                <FieldLabel htmlFor="custom-amenity-auto-alias" className="cn-text-caption font-normal">
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
                  <FieldLabel htmlFor="custom-amenity-apply-now" className="cn-text-caption font-normal">
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
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
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
      </DialogActions>

      {/* Picker d'icone — meme composant que sur le tab Reference. Le choix est
          persiste localement apres creation reussie via setIconOverride. */}
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
