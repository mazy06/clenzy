import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import {
  Spinner,
  Button,
  Checkbox,
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  NativeSelect,
  NativeSelectOption,
  Separator,
  Switch,
} from '../../components/ui';
import apiClient from '../../services/apiClient';
import { useNotification } from '../../hooks/useNotification';
import AiSettingsCard from './AiSettingsCard';

/**
 * Section "Briefings IA" du panneau /settings → onglet IA.
 *
 * Permet a l'user de configurer ses briefings proactifs :
 *  - on/off global
 *  - frequence : daily_morning / weekly_sunday / only_alerts
 *  - canaux : in_app / email / whatsapp (multi-select)
 *  - heure locale + timezone (auto-detectee au premier chargement si pas set)
 *
 * Backend : GET/PUT /api/assistant/briefings/prefs + POST /trigger pour test.
 */

type Frequency = 'daily_morning' | 'weekly_sunday' | 'only_alerts';

interface BriefingPrefs {
  enabled: boolean;
  frequency: Frequency;
  channels: string[];
  timeLocal: string; // HH:mm
  timezone: string;
}

const FREQUENCY_OPTIONS: Array<{ value: Frequency; label: string; description: string }> = [
  {
    value: 'daily_morning',
    label: 'Tous les matins',
    description: 'KPIs de la veille + journée du jour + recommandations.',
  },
  {
    value: 'weekly_sunday',
    label: 'Hebdomadaire (dimanche)',
    description: 'Revue de la semaine + priorités semaine prochaine.',
  },
  {
    value: 'only_alerts',
    label: 'Seulement les alertes',
    description: 'Quotidien, mais envoyé uniquement si une anomalie critique est détectée.',
  },
];

const CHANNEL_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  { value: 'in_app', label: 'In-app', description: 'Notification dans Baitly + lien direct vers la conversation.' },
  { value: 'email', label: 'Email', description: 'Briefing complet envoyé à ton adresse email.' },
  { value: 'whatsapp', label: 'WhatsApp', description: 'Court résumé via template approuvé.' },
];

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}

export const AssistantBriefingPrefs: React.FC = () => {
  const { notify } = useNotification();
  const [prefs, setPrefs] = useState<BriefingPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chargement initial
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<BriefingPrefs>('/assistant/briefings/prefs')
      .then((data) => {
        if (cancelled) return;
        // Auto-detect timezone si la valeur retournee est generique et que le browser
        // peut faire mieux.
        const tz = data.timezone || detectTimezone();
        setPrefs({ ...data, timezone: tz });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Chargement impossible');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const update = useCallback(<K extends keyof BriefingPrefs>(key: K, value: BriefingPrefs[K]) => {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const toggleChannel = useCallback((channel: string) => {
    setPrefs((prev) => {
      if (!prev) return prev;
      const has = prev.channels.includes(channel);
      const next = has ? prev.channels.filter((c) => c !== channel) : [...prev.channels, channel];
      // On garantit au moins 1 canal — sinon les briefings ne servent a rien.
      return { ...prev, channels: next.length > 0 ? next : prev.channels };
    });
  }, []);

  const save = useCallback(async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      const updated = await apiClient.put<BriefingPrefs>('/assistant/briefings/prefs', prefs);
      setPrefs(updated);
      notify.success('Préférences de briefing enregistrées.');
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Sauvegarde impossible.');
    } finally {
      setSaving(false);
    }
  }, [prefs, notify]);

  const triggerTest = useCallback(async () => {
    setTriggering(true);
    try {
      const result = await apiClient.post<{ delivered: string[]; conversationId?: number }>(
        '/assistant/briefings/trigger',
        {},
      );
      const channels = result.delivered.length > 0
        ? result.delivered.join(', ')
        : 'aucun (vérifie tes canaux)';
      notify.success(`Briefing test envoyé via : ${channels}`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Trigger test échoué.');
    } finally {
      setTriggering(false);
    }
  }, [notify]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (error || !prefs) {
    return <Alert variant="destructive">
      <TriangleAlert />
      <AlertDescription>{error ?? 'Données indisponibles.'}</AlertDescription>
    </Alert>;
  }

  return (
    <AiSettingsCard
      title="Briefings IA"
      subtitle="Reçois automatiquement un résumé proactif de ton activité aux horaires choisis. Sans configuration, l'assistant reste réactif uniquement."
      action={
        <Field orientation="horizontal" className="w-auto gap-1">
          <Switch
            id="briefing-enabled"
            size="sm"
            checked={prefs.enabled}
            onCheckedChange={(checked) => update('enabled', checked)}
          />
          <FieldLabel htmlFor="briefing-enabled" className="cn-text-body2 font-semibold">
            {prefs.enabled ? 'Activé' : 'Désactivé'}
          </FieldLabel>
        </Field>
      }
    >
      <div className={cn(prefs.enabled ? 'opacity-100' : 'opacity-50', prefs.enabled ? 'pointer-events-auto' : 'pointer-events-none')} style={{ transition: 'opacity 150ms ease' }}>
        {/* ── Ligne 1 : Frequence + Heure + Fuseau ─────────────────────── */}
        <div className="mb-[18px] grid grid-cols-[1fr] items-start gap-3 min-[600px]:grid-cols-[1fr_1fr] min-[900px]:grid-cols-[minmax(240px,_2fr)_140px_minmax(220px,_1fr)]">
          <Field>
            <FieldLabel
              htmlFor="briefing-frequency"
              className="cn-text-overline font-bold text-[var(--muted)] tracking-[0.6px] text-[0.7rem]"
            >
              Fréquence
            </FieldLabel>
            <NativeSelect
              id="briefing-frequency"
              className="w-full"
              value={prefs.frequency}
              onChange={(e) => update('frequency', e.target.value as Frequency)}
            >
              {FREQUENCY_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription className="leading-[1.4]">
              {FREQUENCY_OPTIONS.find((o) => o.value === prefs.frequency)?.description}
            </FieldDescription>
          </Field>

          <Field>
            {/* La typo overline est celle de toute la ligne (Frequence / Heure / Fuseau). */}
            <FieldLabel
              htmlFor="briefing-time-local"
              className="cn-text-overline font-bold text-[var(--muted)] tracking-[0.6px] text-[0.7rem]"
            >
              Heure d'envoi
            </FieldLabel>
            <Input
              id="briefing-time-local"
              type="time"
              value={prefs.timeLocal}
              onChange={(e) => update('timeLocal', e.target.value)}
              step={300}
              className="w-full"
            />
          </Field>

          <Field>
            <FieldLabel
              htmlFor="briefing-timezone"
              className="cn-text-overline font-bold text-[var(--muted)] tracking-[0.6px] text-[0.7rem]"
            >
              Fuseau horaire
            </FieldLabel>
            <Input
              id="briefing-timezone"
              value={prefs.timezone}
              onChange={(e) => update('timezone', e.target.value)}
              className="w-full"
            />
            <FieldDescription className="text-[0.7rem]">{`Détecté : ${detectTimezone()}`}</FieldDescription>
          </Field>
        </div>

        {/* ── Ligne 2 : Canaux en grille 3 colonnes ───────────────────── */}
        <div>
          <span className="cn-text-overline font-bold text-[var(--muted)] tracking-[0.6px] text-[0.7rem]">
            Canaux
          </span>
          <div className="mt-[4.5px] grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] min-[900px]:grid-cols-[repeat(3,_1fr)] gap-[9px]">
            {CHANNEL_OPTIONS.map((opt) => {
              const checked = prefs.channels.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => toggleChannel(opt.value)}
                  className={cn(
                    'flex items-start gap-1.5 p-[7.5px] rounded-[12px] border border-solid cursor-pointer',
                    'transition-[border-color,background-color] duration-150 ease-out motion-reduce:transition-none',
                    'hover:border-[color-mix(in_srgb,var(--mui-primary)_50%,transparent)]',
                    checked
                      ? 'border-[var(--mui-primary)] bg-[color-mix(in_srgb,var(--mui-primary)_4%,transparent)]'
                      : 'border-[var(--line)] bg-transparent',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleChannel(opt.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-[1.5px]"
                  />
                  <div className="min-w-0">
                    <p className="cn-text-body2 font-semibold leading-[1.3]">
                      {opt.label}
                    </p>
                    <span className="cn-text-caption text-muted-foreground block leading-[1.4]">
                      {opt.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <Separator className="my-[18px]" />
      <div className="flex gap-1.5 justify-end flex-wrap">
        <Button
          variant="outline"
          onClick={triggerTest}
          disabled={triggering || !prefs.enabled}
        >
          {triggering ? 'Envoi en cours...' : 'Envoyer un test'}
        </Button>
        <Button
          onClick={save}
          disabled={saving || loading}
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </AiSettingsCard>
  );
};

export default AssistantBriefingPrefs;
