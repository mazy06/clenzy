/**
 * Modal de creation d'une commodite Clenzy custom.
 *
 * UX :
 *   - Pre-remplie avec le rawOtaName si on arrive depuis un item "a mapper"
 *   - Slugifie le label en code SCREAMING_SNAKE_CASE (preview live)
 *   - Cree optionnellement un alias auto rawName → code
 *   - Cochee par defaut : "Appliquer aux X propriete(s)"
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Stack,
  IconButton,
  FormControlLabel,
  Checkbox,
  Alert,
  Autocomplete,
} from '@mui/material';
import { X, Sparkles } from 'lucide-react';

import {
  amenitiesManagementApi,
  type ChannexFacilityOption,
} from '../../../services/api/amenitiesManagementApi';
import AmenityIconPicker from './AmenityIconPicker';
import { ICON_REGISTRY } from './amenityIcons';
import { useAmenityIconOverrides } from './useAmenityIconOverrides';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';

const ACCENT = '#0F766E';

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
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>Nouvelle commodité</Typography>
          <Typography variant="caption" color="text.secondary">
            Étend le référentiel Clenzy pour votre organisation
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5 }}>
        {prefillRawName && (
          <Alert severity="info" variant="outlined"
                 sx={{ mb: 2, '& .MuiAlert-message': { fontSize: '0.8rem' } }}>
            Détectée sur <strong>{prefillAffectedCount}</strong> propriété
            {prefillAffectedCount > 1 ? 's' : ''} sous le nom OTA brut «&nbsp;
            <Box component="span" sx={{ fontFamily: 'monospace' }}>{prefillRawName}</Box>&nbsp;».
          </Alert>
        )}

        <Stack spacing={2}>
          <TextField
            label="Label français *"
            size="small"
            fullWidth
            value={labelFr}
            onChange={(e) => setLabelFr(e.target.value)}
            placeholder="ex : Détecteur de fumée"
          />
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
                <Box>
                  <Typography sx={{ fontSize: '0.85rem' }}>{opt.title}</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                    {opt.category}
                  </Typography>
                </Box>
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
          <FormControl size="small" fullWidth>
            <InputLabel>Catégorie *</InputLabel>
            <Select
              label="Catégorie *"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Code (auto si vide)"
            size="small"
            fullWidth
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={previewCode || 'AUTO_GENERATED'}
            helperText={
              code.trim()
                ? `Sera enregistré : ${previewCode}`
                : `Sera généré automatiquement : ${previewCode || '—'}`
            }
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
          />

          {/* Icone : preview cliquable + label + bouton "Choisir" */}
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              onClick={() => setIconPickerOpen(true)}
              role="button"
              tabIndex={0}
              aria-label={t('settings.amenities.changeIcon', "Changer l'icône")}
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: `${ACCENT}14`,
                color: ACCENT,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: `${ACCENT}33`,
                transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                '&:hover': { bgcolor: `${ACCENT}24`, borderColor: ACCENT },
                '&:focus-visible': { boxShadow: `0 0 0 3px ${ACCENT}33`, outline: 'none' },
              }}
            >
              <PreviewIcon size={20} strokeWidth={1.75} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>
                {t('settings.amenities.iconLabel', 'Icône')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                {selectedIconName}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setIconPickerOpen(true)}
              sx={{
                textTransform: 'none',
                fontSize: '0.78rem',
                borderColor: `${ACCENT}66`,
                color: ACCENT,
                '&:hover': { borderColor: ACCENT, backgroundColor: `${ACCENT}0A` },
              }}
            >
              {t('settings.amenities.changeIcon', "Changer l'icône")}
            </Button>
          </Stack>

          {prefillRawName && (
            <Stack spacing={0.5}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={autoAlias}
                    onChange={(e) => setAutoAlias(e.target.checked)}
                    sx={{ color: ACCENT, '&.Mui-checked': { color: ACCENT } }}
                  />
                }
                label={
                  <Typography variant="caption">
                    Créer aussi l'alias «&nbsp;<strong>{prefillRawName}</strong>&nbsp;» → <strong>{previewCode || '...'}</strong>
                  </Typography>
                }
              />
              {prefillAffectedCount > 0 && (
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={applyNow}
                      onChange={(e) => setApplyNow(e.target.checked)}
                      disabled={!autoAlias}
                      sx={{ color: ACCENT, '&.Mui-checked': { color: ACCENT } }}
                    />
                  }
                  label={
                    <Typography variant="caption">
                      Appliquer aux <strong>{prefillAffectedCount}</strong> propriété{prefillAffectedCount > 1 ? 's' : ''} maintenant
                    </Typography>
                  }
                />
              )}
            </Stack>
          )}

          {error && (
            <Alert severity="error" variant="outlined"
                   sx={{ '& .MuiAlert-message': { fontSize: '0.8rem' } }}>
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} size="small" sx={{ textTransform: 'none', color: 'text.secondary' }}>
          Annuler
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          sx={{
            backgroundColor: ACCENT,
            '&:hover': { backgroundColor: '#0d645e' },
            textTransform: 'none',
          }}
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
