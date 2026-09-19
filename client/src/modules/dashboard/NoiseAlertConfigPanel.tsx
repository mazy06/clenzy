import React, { useMemo, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Button, Spinner } from '../../components/ui';
import { Field, FieldLabel, Input } from '../../components/ui';
import {
  Card,
  CardContent,
  NativeSelect,
  Separator,
  Slider,
  Switch,
} from '../../components/ui';
import {
  Settings,
  Add,
  Delete,
  NotificationsActive,
  Email,
  Chat,
} from '../../icons';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi } from '../../services/api/propertiesApi';
import { extractApiList } from '../../types';
import type { Property } from '../../services/api/propertiesApi';
import {
  useNoiseAlertConfig,
  useSaveNoiseAlertConfig,
  type SaveNoiseAlertConfigDto,
} from '../../hooks/useNoiseAlerts';
import type { TimeWindowDto } from '../../services/api/noiseAlertApi';
import { useTranslation } from 'react-i18next';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TimeWindowForm {
  label: string;
  startTime: string;
  endTime: string;
  warningThresholdDb: number;
  criticalThresholdDb: number;
}

interface ConfigForm {
  enabled: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyGuestMessage: boolean;
  notifyWhatsapp: boolean;
  notifySms: boolean;
  cooldownMinutes: number;
  emailRecipients: string;
  timeWindows: TimeWindowForm[];
}

// Le `label` d'un créneau est une donnée SAISISSABLE — l'utilisateur renomme
// ses plages. Seule sa valeur INITIALE se traduit, et elle se pose au montage :
// figée ici, elle resterait française.
const DEFAULT_TIME_WINDOWS: Omit<TimeWindowForm, 'label'>[] = [
  { startTime: '07:00', endTime: '22:00', warningThresholdDb: 70, criticalThresholdDb: 85 },
  { startTime: '22:00', endTime: '07:00', warningThresholdDb: 55, criticalThresholdDb: 70 },
];

const DEFAULT_WINDOW_KEYS = ['day', 'night'] as const;

const DEFAULT_CONFIG: ConfigForm = {
  enabled: true,
  notifyInApp: true,
  notifyEmail: true,
  notifyGuestMessage: false,
  notifyWhatsapp: false,
  notifySms: false,
  cooldownMinutes: 30,
  emailRecipients: '',
  timeWindows: [],
};

const COOLDOWN_VALUES = [15, 30, 60, 120] as const;

// ─── Component ───────────────────────────────────────────────────────────────

/** Seuil d'un créneau horaire avec ses bornes temporelles pour le graphique. */
export interface TimeWindowThreshold {
  label: string;
  startTime: string;
  endTime: string;
  warning: number;
  critical: number;
}

/** Tous les créneaux horaires avec leurs seuils, émis vers le graphique. */
export type ActiveThresholds = TimeWindowThreshold[];

/** Handle exposé via ref pour déclencher la sauvegarde depuis le parent. */
export interface NoiseAlertConfigHandle {
  save: () => void;
  isSaving: boolean;
  isSaved: boolean;
  hasError: boolean;
  canSave: boolean;
}

/**
 * Instantané de l'état de sauvegarde émis vers le parent via {@link NoiseAlertConfigPanelProps.onStatusChange}.
 * Permet à un bouton « Sauvegarder » externe de réagir de façon fiable (sans lire la ref en render).
 */
export interface NoiseAlertConfigStatus {
  canSave: boolean;
  isSaving: boolean;
  isSaved: boolean;
  hasError: boolean;
}

interface NoiseAlertConfigPanelProps {
  propertyIds: number[];
  /** Appelé à chaque changement de slider pour mettre à jour les lignes du graphique en temps réel. */
  onThresholdsChange?: (thresholds: ActiveThresholds) => void;
  /** Émis à chaque évolution de l'état de sauvegarde — pour piloter un bouton « Sauvegarder » externe. */
  onStatusChange?: (status: NoiseAlertConfigStatus) => void;
  /**
   * `embedded` : panneau intégré au détail d'un capteur (logement déjà fixé) →
   * masque le sélecteur de logement redondant.
   */
  embedded?: boolean;
}

const NoiseAlertConfigPanel = forwardRef<NoiseAlertConfigHandle, NoiseAlertConfigPanelProps>(({ propertyIds, onThresholdsChange, onStatusChange, embedded = false }, ref) => {
  const { t } = useTranslation();
  /** Créneaux par défaut, libellés dans la langue active. */
  const defaultWindows = useMemo<TimeWindowForm[]>(
    () => DEFAULT_TIME_WINDOWS.map((w, i) => ({
      ...w,
      label: t(`noiseConfig.defaultWindows.${DEFAULT_WINDOW_KEYS[i]}`),
    })),
    [t],
  );
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(
    propertyIds.length > 0 ? propertyIds[0] : null,
  );
  const [form, setForm] = useState<ConfigForm>(() => ({ ...DEFAULT_CONFIG, timeWindows: defaultWindows }));
  const [saved, setSaved] = useState(false);
  // Prefixe d'id propre a cette instance : le panneau peut etre monte plusieurs
  // fois (vue globale + detail capteur), les ids de creneau doivent rester uniques.
  const fieldIdBase = React.useId();

  // Index du créneau horaire actuellement édité (pour synchroniser le graphique).
  // Par défaut : créneau actif basé sur l'heure courante.
  const [activeTimeWindowIdx, setActiveTimeWindowIdx] = useState<number>(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < DEFAULT_TIME_WINDOWS.length; i++) {
      const tw = DEFAULT_TIME_WINDOWS[i];
      const [startH, startM] = tw.startTime.split(':').map(Number);
      const [endH, endM] = tw.endTime.split(':').map(Number);
      const start = startH * 60 + startM;
      const end = endH * 60 + endM;
      if (end > start) {
        if (currentMinutes >= start && currentMinutes < end) return i;
      } else {
        if (currentMinutes >= start || currentMinutes < end) return i;
      }
    }
    return 0;
  });

  const propertiesQuery = useQuery({
    queryKey: ['properties-for-noise-alert-config'],
    queryFn: () => propertiesApi.getAll({ size: 1000 }),
    staleTime: 60_000,
  });
  const properties = React.useMemo(
    () => {
      const propertyIdSet = new Set(propertyIds);
      return extractApiList<Property>(propertiesQuery.data).filter(p => propertyIdSet.has(p.id));
    },
    [propertiesQuery.data, propertyIds],
  );

  const configQuery = useNoiseAlertConfig(selectedPropertyId);
  const saveMutation = useSaveNoiseAlertConfig();

  // Émettre les seuils de TOUS les créneaux pour affichage multi-segments sur le graphique.
  useEffect(() => {
    if (!onThresholdsChange) return;
    const thresholds: ActiveThresholds = form.timeWindows.map(tw => ({
      label: tw.label,
      startTime: tw.startTime,
      endTime: tw.endTime,
      warning: tw.warningThresholdDb,
      critical: tw.criticalThresholdDb,
    }));
    onThresholdsChange(thresholds);
  }, [form.timeWindows, onThresholdsChange]);

  // Sync form from server config
  useEffect(() => {
    if (configQuery.data) {
      const cfg = configQuery.data;
      setForm({
        enabled: cfg.enabled,
        notifyInApp: cfg.notifyInApp,
        notifyEmail: cfg.notifyEmail,
        notifyGuestMessage: cfg.notifyGuestMessage,
        notifyWhatsapp: cfg.notifyWhatsapp,
        notifySms: cfg.notifySms,
        cooldownMinutes: cfg.cooldownMinutes,
        emailRecipients: cfg.emailRecipients || '',
        timeWindows: cfg.timeWindows.map((tw: TimeWindowDto) => ({
          label: tw.label,
          startTime: tw.startTime,
          endTime: tw.endTime,
          warningThresholdDb: tw.warningThresholdDb,
          criticalThresholdDb: tw.criticalThresholdDb,
        })),
      });
    } else if (!configQuery.isLoading) {
      setForm({ ...DEFAULT_CONFIG, timeWindows: defaultWindows });
    }
  }, [configQuery.data, configQuery.isLoading, defaultWindows]);

  const updateField = useCallback(<K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const updateTimeWindow = useCallback((idx: number, field: keyof TimeWindowForm, value: string | number) => {
    setForm(prev => ({
      ...prev,
      timeWindows: prev.timeWindows.map((tw, i) =>
        i === idx ? { ...tw, [field]: value } : tw,
      ),
    }));
    // Mettre à jour l'index actif pour que le graphique reflète le créneau en cours d'édition.
    if (field === 'warningThresholdDb' || field === 'criticalThresholdDb') {
      setActiveTimeWindowIdx(idx);
    }
    setSaved(false);
  }, []);

  const addTimeWindow = useCallback(() => {
    setForm(prev => ({
      ...prev,
      timeWindows: [
        ...prev.timeWindows,
        { label: '', startTime: '00:00', endTime: '06:00', warningThresholdDb: 60, criticalThresholdDb: 80 },
      ],
    }));
    setSaved(false);
  }, []);

  const removeTimeWindow = useCallback((idx: number) => {
    setForm(prev => ({
      ...prev,
      timeWindows: prev.timeWindows.filter((_, i) => i !== idx),
    }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedPropertyId || form.timeWindows.length === 0) return;

    const dto: SaveNoiseAlertConfigDto = {
      enabled: form.enabled,
      notifyInApp: form.notifyInApp,
      notifyEmail: form.notifyEmail,
      notifyGuestMessage: form.notifyGuestMessage,
      notifyWhatsapp: form.notifyWhatsapp,
      notifySms: form.notifySms,
      cooldownMinutes: form.cooldownMinutes,
      emailRecipients: form.emailRecipients || null,
      timeWindows: form.timeWindows,
    };

    saveMutation.mutate(
      { propertyId: selectedPropertyId, data: dto },
      { onSuccess: () => setSaved(true) },
    );
  }, [selectedPropertyId, form, saveMutation]);

  const canSave = form.enabled && form.timeWindows.length > 0;

  // Exposer save() au parent via ref (déclenchement impératif).
  useImperativeHandle(ref, () => ({
    save: handleSave,
    isSaving: saveMutation.isPending,
    isSaved: saved,
    hasError: saveMutation.isError,
    canSave,
  }), [handleSave, saveMutation.isPending, saved, saveMutation.isError, canSave]);

  // Émettre l'état de sauvegarde vers le parent (bouton « Sauvegarder » externe fiable,
  // sans lire la ref pendant le render — cf. règles des hooks React).
  useEffect(() => {
    onStatusChange?.({ canSave, isSaving: saveMutation.isPending, isSaved: saved, hasError: saveMutation.isError });
  }, [onStatusChange, canSave, saveMutation.isPending, saved, saveMutation.isError]);

  if (propertyIds.length === 0) return null;

  return (
    <Card className="[--card-spacing:12px]">
      <CardContent>
        {/* Header : titre + sélecteur propriété + toggle — sur une seule ligne */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="inline-flex text-primary"><Settings size={18} strokeWidth={1.75} /></span>
            <h6 className="text-sm font-semibold whitespace-nowrap text-foreground">
              {t('noiseConfig.title')}
            </h6>
          </div>

          {!embedded && (
            <NativeSelect
              aria-label="Logement"
              className="min-w-[180px] [&_select]:text-[0.8125rem]"
              value={selectedPropertyId ?? ''}
              onChange={(e) => setSelectedPropertyId(Number(e.target.value))}
            >
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          )}

          {!configQuery.isLoading && (
            <Field orientation="horizontal" className="ms-auto w-auto gap-1.5">
              <Switch
                id={`${fieldIdBase}-enabled`}
                size="sm"
                checked={form.enabled}
                onCheckedChange={(checked) => updateField('enabled', checked)}
              />
              <FieldLabel htmlFor={`${fieldIdBase}-enabled`} className="text-[0.8125rem] font-semibold">
                {t('noiseConfig.enabled')}
              </FieldLabel>
            </Field>
          )}
        </div>

        {configQuery.isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner className="size-6" />
          </div>
        ) : (
          <>

            {form.enabled && (
              <>
                <Separator className="my-[9px]" />

                <div className="grid grid-cols-12 gap-[18px]">
                  {/* ── Colonne gauche : Créneaux horaires ── */}
                  <div className="col-span-12 min-[900px]:col-span-7">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('noiseConfig.windows')}
                      </p>
                      {/* Action d'en-tete de section, discrete face au contenu edite. */}
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={addTimeWindow}
                      >
                        <Add size={14} strokeWidth={1.75} />
                        {t('noiseConfig.add')}
                      </Button>
                    </div>

                    {form.timeWindows.map((tw, idx) => (
                      <div className="p-2 mb-1.5 rounded-lg bg-card border border-border" key={idx}>
                        {/* items-end : le libelle passe AU-DESSUS du champ, la corbeille
                            doit s'aligner sur la ligne de saisie et non sur l'ensemble. */}
                        <div className="flex items-end gap-1.5 mb-1.5">
                          <Field className="flex-1">
                            <FieldLabel htmlFor={`${fieldIdBase}-tw-${idx}-label`}>{t('noiseConfig.windowLabel')}</FieldLabel>
                            <Input
                              id={`${fieldIdBase}-tw-${idx}-label`}
                              className="w-full text-[0.8125rem]"
                              value={tw.label}
                              onChange={(e) => updateTimeWindow(idx, 'label', e.target.value)}
                            />
                          </Field>
                          <Field className="w-[120px]">
                            <FieldLabel htmlFor={`${fieldIdBase}-tw-${idx}-start`}>{t('noiseConfig.start')}</FieldLabel>
                            <Input
                              id={`${fieldIdBase}-tw-${idx}-start`}
                              className="w-full text-[0.8125rem]"
                              type="time"
                              value={tw.startTime}
                              onChange={(e) => updateTimeWindow(idx, 'startTime', e.target.value)}
                            />
                          </Field>
                          <Field className="w-[120px]">
                            <FieldLabel htmlFor={`${fieldIdBase}-tw-${idx}-end`}>{t('noiseConfig.end')}</FieldLabel>
                            <Input
                              id={`${fieldIdBase}-tw-${idx}-end`}
                              className="w-full text-[0.8125rem]"
                              type="time"
                              value={tw.endTime}
                              onChange={(e) => updateTimeWindow(idx, 'endTime', e.target.value)}
                            />
                          </Field>
                          {form.timeWindows.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Supprimer le creneau ${tw.label || idx + 1}`}
                              className="text-destructive"
                              onClick={() => removeTimeWindow(idx)}
                            >
                              <Delete size={16} strokeWidth={1.75} />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-6">
                            {/* La valeur porte l'encre `-ink` (lisible AA), la piste du
                                curseur la teinte vive — cf. §2.4 du contrat Baitly UI. */}
                            <p className="text-xs text-foreground mb-0.5">
                              {t('noiseConfig.warningThreshold')} : <b className="text-warning-ink tabular-nums">{tw.warningThresholdDb} dB</b>
                            </p>
                            <Slider
                              aria-label={t('noiseConfig.warningThreshold')}
                              value={[tw.warningThresholdDb]}
                              onValueChange={([val]) => updateTimeWindow(idx, 'warningThresholdDb', val)}
                              min={30}
                              max={100}
                              className="[&_[data-slot=slider-range]]:bg-warning [&_[data-slot=slider-thumb]]:border-warning"
                            />
                          </div>
                          <div className="col-span-6">
                            <p className="text-xs text-foreground mb-0.5">
                              {t('noiseConfig.criticalThreshold')} : <b className="text-destructive-ink tabular-nums">{tw.criticalThresholdDb} dB</b>
                            </p>
                            <Slider
                              aria-label={t('noiseConfig.criticalThreshold')}
                              value={[tw.criticalThresholdDb]}
                              onValueChange={([val]) => updateTimeWindow(idx, 'criticalThresholdDb', val)}
                              min={30}
                              max={120}
                              className="[&_[data-slot=slider-range]]:bg-destructive [&_[data-slot=slider-thumb]]:border-destructive"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Colonne droite : Canaux de notification ── */}
                  <div className="col-span-12 min-[900px]:col-span-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      {t('noiseConfig.channels')}
                    </p>

                    <div className="flex flex-col gap-0.5 mb-2">
                      <Field orientation="horizontal" className="w-auto gap-1.5">
                        <Switch
                          id={`${fieldIdBase}-notify-in-app`}
                          size="sm"
                          checked={form.notifyInApp}
                          onCheckedChange={(checked) => updateField('notifyInApp', checked)}
                        />
                        <FieldLabel htmlFor={`${fieldIdBase}-notify-in-app`} className="items-center gap-0.5 text-xs font-normal">
                          <NotificationsActive size={14} strokeWidth={1.75} />
                          {t('noiseConfig.inApp')}
                        </FieldLabel>
                      </Field>
                      <Field orientation="horizontal" className="w-auto gap-1.5">
                        <Switch
                          id={`${fieldIdBase}-notify-email`}
                          size="sm"
                          checked={form.notifyEmail}
                          onCheckedChange={(checked) => updateField('notifyEmail', checked)}
                        />
                        <FieldLabel htmlFor={`${fieldIdBase}-notify-email`} className="items-center gap-0.5 text-xs font-normal">
                          <Email size={14} strokeWidth={1.75} />
                          {t('noiseConfig.email')}
                        </FieldLabel>
                      </Field>
                      <Field orientation="horizontal" className="w-auto gap-1.5">
                        <Switch
                          id={`${fieldIdBase}-notify-guest`}
                          size="sm"
                          checked={form.notifyGuestMessage}
                          onCheckedChange={(checked) => updateField('notifyGuestMessage', checked)}
                        />
                        <FieldLabel htmlFor={`${fieldIdBase}-notify-guest`} className="items-center gap-0.5 text-xs font-normal">
                          <Chat size={14} strokeWidth={1.75} />
                          {t('noiseConfig.guestMessage')}
                        </FieldLabel>
                      </Field>
                    </div>

                    {form.notifyEmail && (
                      <Field className="mb-[9px]">
                        <FieldLabel htmlFor={`${fieldIdBase}-email-recipients`}>
                          {t('noiseConfig.recipients')}
                        </FieldLabel>
                        <Input
                          id={`${fieldIdBase}-email-recipients`}
                          className="w-full text-[0.8125rem]"
                          value={form.emailRecipients}
                          onChange={(e) => updateField('emailRecipients', e.target.value)}
                          placeholder="email1@example.com, email2@example.com"
                        />
                      </Field>
                    )}

                    {/* Cooldown */}
                    <div className="flex items-center gap-1.5">
                      <label htmlFor={`${fieldIdBase}-cooldown`} className="text-xs text-muted-foreground">
                        {t('noiseConfig.cooldown')}
                      </label>
                      <NativeSelect
                        id={`${fieldIdBase}-cooldown`}
                        size="sm"
                        className="min-w-[100px] [&_select]:text-[0.75rem]"
                        value={form.cooldownMinutes}
                        onChange={(e) => updateField('cooldownMinutes', Number(e.target.value))}
                      >
                        {COOLDOWN_VALUES.map(value => (
                          <option key={value} value={value}>
                            {t(`noiseConfig.cooldownOptions.${value}`)}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                </div>

              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
});

NoiseAlertConfigPanel.displayName = 'NoiseAlertConfigPanel';

export default NoiseAlertConfigPanel;
