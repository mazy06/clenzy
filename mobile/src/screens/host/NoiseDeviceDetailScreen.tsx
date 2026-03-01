import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Divider } from '@/components/ui/Divider';
import { Skeleton } from '@/components/ui/Skeleton';
import { NoiseChart } from '@/components/domain/NoiseChart';
import { useNoiseChartData } from '@/hooks/useNoiseMonitoring';
import { useNoiseAlertConfig, useNoiseAlertConfigs, useSaveNoiseAlertConfig } from '@/hooks/useNoiseAlertConfig';
import type { DashboardStackParamList } from '@/navigation/HostNavigator';

type IoniconsName = keyof typeof Ionicons.glyphMap;

/* ─── Types ─── */

type TabKey = 'chart' | 'config';

interface TimeWindowForm {
  label: string;
  startTime: string;
  endTime: string;
  warningThresholdDb: string;
  criticalThresholdDb: string;
}

const DEFAULT_WINDOWS: TimeWindowForm[] = [
  { label: 'Nuit', startTime: '22:00', endTime: '07:00', warningThresholdDb: '65', criticalThresholdDb: '80' },
  { label: 'Jour', startTime: '07:00', endTime: '22:00', warningThresholdDb: '75', criticalThresholdDb: '90' },
];

/* ─── Helpers ─── */

function getDbColor(level: number, theme: ReturnType<typeof useTheme>): string {
  if (level < 50) return theme.colors.success.main;
  if (level < 70) return theme.colors.warning.main;
  return theme.colors.error.main;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'Actif';
    case 'INACTIVE': return 'Inactif';
    case 'PENDING': return 'En attente';
    default: return status;
  }
}

function getStatusColor(status: string, theme: ReturnType<typeof useTheme>): string {
  switch (status) {
    case 'ACTIVE': return theme.colors.success.main;
    case 'INACTIVE': return theme.colors.text.disabled;
    case 'PENDING': return theme.colors.warning.main;
    default: return theme.colors.text.disabled;
  }
}

function getDeviceTypeLabel(type: string): string {
  switch (type) {
    case 'MINUT': return 'Minut';
    case 'TUYA': return 'Clenzy Hardware';
    default: return type;
  }
}

/** Find the active time window thresholds based on current time */
function getActiveThresholds(configs: { timeWindows: { startTime: string; endTime: string; warningThresholdDb: number; criticalThresholdDb: number }[] }[]): { warning: number; critical: number } {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const config of configs) {
    for (const tw of config.timeWindows) {
      const [sh, sm] = tw.startTime.split(':').map(Number);
      const [eh, em] = tw.endTime.split(':').map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;

      const isInWindow = start > end
        ? currentMinutes >= start || currentMinutes < end
        : currentMinutes >= start && currentMinutes < end;

      if (isInWindow) {
        return { warning: tw.warningThresholdDb, critical: tw.criticalThresholdDb };
      }
    }
  }

  return { warning: 70, critical: 85 };
}

/* ─── Tab Bar ─── */

function TabBar({ activeTab, onTabChange, theme }: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const tabs: { key: TabKey; label: string; icon: IoniconsName }[] = [
    { key: 'chart', label: 'Graphique', icon: 'analytics-outline' },
    { key: 'config', label: 'Configuration', icon: 'settings-outline' },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      marginHorizontal: theme.SPACING.lg,
      marginTop: theme.SPACING.sm,
      backgroundColor: theme.colors.background.surface,
      borderRadius: theme.BORDER_RADIUS.lg,
      padding: 3,
    }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: theme.BORDER_RADIUS.md,
              backgroundColor: isActive ? theme.colors.background.paper : 'transparent',
              ...(isActive ? theme.shadows.sm : {}),
            }}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={isActive ? theme.colors.primary.main : theme.colors.text.disabled}
            />
            <Text style={{
              ...theme.typography.body2,
              fontWeight: isActive ? '700' : '500',
              color: isActive ? theme.colors.primary.main : theme.colors.text.disabled,
            }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Chart Tab Content ─── */

function ChartTab({
  deviceName,
  deviceType,
  deviceStatus,
  propertyName,
  roomName,
  theme,
}: {
  deviceName: string;
  deviceType: string;
  deviceStatus: string;
  propertyName: string;
  roomName: string | null;
  theme: ReturnType<typeof useTheme>;
}) {
  const { data: chartData, isLoading: chartLoading, refetch: refetchChart } = useNoiseChartData();
  const { data: alertConfigs } = useNoiseAlertConfigs();

  const liveSummaries = chartData?.devices ?? [];
  const rawChartPoints = chartData?.chartData ?? [];

  // Find live data for this device
  const liveData = useMemo(() => {
    const base = propertyName;
    const label = roomName ? `${base} - ${roomName}` : base;
    return liveSummaries.find((s) => s.label === label);
  }, [liveSummaries, propertyName, roomName]);

  const hasData = liveData && liveData.currentLevel >= 0;
  const statusColor = getStatusColor(deviceStatus, theme);

  // Get active threshold values from configs
  const thresholds = useMemo(() => {
    return getActiveThresholds(alertConfigs ?? []);
  }, [alertConfigs]);

  // Transform chart data into NoiseChart format
  const noiseChartData = useMemo(() => {
    if (rawChartPoints.length === 0) return [];

    return rawChartPoints.map((point) => {
      const time = String(point.time ?? '');
      const values = Object.entries(point)
        .filter(([key]) => key !== 'time')
        .map(([, val]) => Number(val))
        .filter((v) => !isNaN(v) && v > 0);

      const avgValue = values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 0;

      return { time, value: avgValue };
    });
  }, [rawChartPoints]);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetchChart} tintColor={theme.colors.primary.main} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Device Info Card */}
      <View style={{ paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.md }}>
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          {/* Device header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: theme.SPACING.md }}>
            <View style={{
              width: 44,
              height: 44,
              borderRadius: theme.BORDER_RADIUS.lg,
              backgroundColor: hasData
                ? `${getDbColor(liveData!.currentLevel, theme)}14`
                : `${theme.colors.primary.main}14`,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons
                name="mic-outline"
                size={22}
                color={hasData ? getDbColor(liveData!.currentLevel, theme) : theme.colors.primary.main}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>
                {deviceName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                  {getDeviceTypeLabel(deviceType)}
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>·</Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                  {propertyName}
                </Text>
                {roomName && (
                  <>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>·</Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                      {roomName}
                    </Text>
                  </>
                )}
              </View>
            </View>
            <View style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: theme.BORDER_RADIUS.full,
              backgroundColor: `${statusColor}14`,
            }}>
              <Text style={{ ...theme.typography.caption, color: statusColor, fontWeight: '600', fontSize: 10 }}>
                {getStatusLabel(deviceStatus)}
              </Text>
            </View>
          </View>

          {/* Live stats */}
          {hasData ? (
            <>
              {/* Current level */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: theme.SPACING.md,
                marginBottom: theme.SPACING.sm,
                borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: `${getDbColor(liveData!.currentLevel, theme)}08`,
              }}>
                <Ionicons name="volume-high-outline" size={20} color={getDbColor(liveData!.currentLevel, theme)} />
                <Text style={{
                  ...theme.typography.h2,
                  color: getDbColor(liveData!.currentLevel, theme),
                  fontWeight: '800',
                }}>
                  {Math.round(liveData!.currentLevel)} dB
                </Text>
              </View>

              {/* Stats row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginBottom: 2 }}>
                    Moyenne
                  </Text>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '700' }}>
                    {Math.round(liveData!.averageLevel)} dB
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: theme.colors.border.light }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginBottom: 2 }}>
                    Maximum
                  </Text>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '700' }}>
                    {Math.round(liveData!.maxLevel)} dB
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: theme.colors.border.light }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginBottom: 2 }}>
                    Seuil att.
                  </Text>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.warning.main, fontWeight: '700' }}>
                    {thresholds.warning} dB
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: theme.colors.border.light }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginBottom: 2 }}>
                    Seuil crit.
                  </Text>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.error.main, fontWeight: '700' }}>
                    {thresholds.critical} dB
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
              <Ionicons name="information-circle-outline" size={14} color={theme.colors.text.disabled} />
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                En attente de donnees...
              </Text>
            </View>
          )}
        </Card>
      </View>

      {/* Chart section */}
      <View style={{ paddingHorizontal: theme.SPACING.lg }}>
        <SectionHeader title="Niveaux sonores" iconName="analytics-outline" />
        <NoiseChart
          data={noiseChartData}
          warningThreshold={thresholds.warning}
          criticalThreshold={thresholds.critical}
          isLoading={chartLoading}
        />
      </View>
    </ScrollView>
  );
}

/* ─── Time Window Card (Config Tab) ─── */

function TimeWindowCard({
  window,
  index,
  onChange,
  onRemove,
  theme,
}: {
  window: TimeWindowForm;
  index: number;
  onChange: (index: number, field: keyof TimeWindowForm, value: string) => void;
  onRemove: (index: number) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Card style={{ marginBottom: theme.SPACING.sm }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.SPACING.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{
            width: 28,
            height: 28,
            borderRadius: theme.BORDER_RADIUS.sm,
            backgroundColor: `${theme.colors.primary.main}14`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name="time-outline" size={14} color={theme.colors.primary.main} />
          </View>
          <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary }}>
            Creneau {index + 1}
          </Text>
        </View>
        <Pressable
          onPress={() => onRemove(index)}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Ionicons name="trash-outline" size={18} color={theme.colors.error.main} />
        </Pressable>
      </View>

      {/* Label */}
      <Input
        label="Nom"
        placeholder="Ex: Nuit, Jour, Week-end..."
        value={window.label}
        onChangeText={(v) => onChange(index, 'label', v)}
        containerStyle={{ marginBottom: theme.SPACING.md }}
      />

      {/* Time range */}
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.md }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Debut"
            placeholder="22:00"
            value={window.startTime}
            onChangeText={(v) => onChange(index, 'startTime', v)}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Fin"
            placeholder="07:00"
            value={window.endTime}
            onChangeText={(v) => onChange(index, 'endTime', v)}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      {/* Thresholds */}
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.warning.main, fontWeight: '600', marginBottom: 4 }}>
            Seuil attention (dB)
          </Text>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: theme.colors.warning.main,
            borderRadius: theme.BORDER_RADIUS.sm,
            paddingHorizontal: 12,
            backgroundColor: `${theme.colors.warning.main}08`,
          }}>
            <Ionicons name="warning-outline" size={14} color={theme.colors.warning.main} />
            <TextInput
              value={window.warningThresholdDb}
              onChangeText={(v) => onChange(index, 'warningThresholdDb', v)}
              keyboardType="number-pad"
              style={{
                flex: 1,
                ...theme.typography.body2,
                color: theme.colors.text.primary,
                fontWeight: '700',
                paddingVertical: 10,
                paddingHorizontal: 8,
              }}
              placeholder="70"
              placeholderTextColor={theme.colors.text.disabled}
            />
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>dB</Text>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.error.main, fontWeight: '600', marginBottom: 4 }}>
            Seuil critique (dB)
          </Text>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: theme.colors.error.main,
            borderRadius: theme.BORDER_RADIUS.sm,
            paddingHorizontal: 12,
            backgroundColor: `${theme.colors.error.main}08`,
          }}>
            <Ionicons name="alert-circle-outline" size={14} color={theme.colors.error.main} />
            <TextInput
              value={window.criticalThresholdDb}
              onChangeText={(v) => onChange(index, 'criticalThresholdDb', v)}
              keyboardType="number-pad"
              style={{
                flex: 1,
                ...theme.typography.body2,
                color: theme.colors.text.primary,
                fontWeight: '700',
                paddingVertical: 10,
                paddingHorizontal: 8,
              }}
              placeholder="85"
              placeholderTextColor={theme.colors.text.disabled}
            />
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>dB</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

/* ─── Config Tab Content ─── */

function ConfigTab({
  propertyId,
  propertyName,
  theme,
}: {
  propertyId: number;
  propertyName: string;
  theme: ReturnType<typeof useTheme>;
}) {
  const { data: config, isLoading } = useNoiseAlertConfig(propertyId);
  const saveConfig = useSaveNoiseAlertConfig();

  // Form state
  const [enabled, setEnabled] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyGuestMessage, setNotifyGuestMessage] = useState(false);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [notifySms, setNotifySms] = useState(false);
  const [cooldownMinutes, setCooldownMinutes] = useState('30');
  const [emailRecipients, setEmailRecipients] = useState('');
  const [timeWindows, setTimeWindows] = useState<TimeWindowForm[]>(DEFAULT_WINDOWS);

  // Populate form from existing config
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setNotifyInApp(config.notifyInApp);
      setNotifyEmail(config.notifyEmail);
      setNotifyGuestMessage(config.notifyGuestMessage);
      setNotifyWhatsapp(config.notifyWhatsapp);
      setNotifySms(config.notifySms);
      setCooldownMinutes(String(config.cooldownMinutes));
      setEmailRecipients(config.emailRecipients ?? '');
      if (config.timeWindows.length > 0) {
        setTimeWindows(
          config.timeWindows.map((tw) => ({
            label: tw.label,
            startTime: tw.startTime,
            endTime: tw.endTime,
            warningThresholdDb: String(tw.warningThresholdDb),
            criticalThresholdDb: String(tw.criticalThresholdDb),
          })),
        );
      }
    }
  }, [config]);

  const handleWindowChange = useCallback((index: number, field: keyof TimeWindowForm, value: string) => {
    setTimeWindows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const handleRemoveWindow = useCallback((index: number) => {
    setTimeWindows((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddWindow = useCallback(() => {
    setTimeWindows((prev) => [
      ...prev,
      { label: '', startTime: '', endTime: '', warningThresholdDb: '70', criticalThresholdDb: '85' },
    ]);
  }, []);

  const handleSave = useCallback(() => {
    // Validate
    if (timeWindows.length === 0) {
      Alert.alert('Erreur', 'Au moins un creneau horaire est requis');
      return;
    }

    for (const tw of timeWindows) {
      if (!tw.label.trim()) {
        Alert.alert('Erreur', 'Chaque creneau doit avoir un nom');
        return;
      }
      if (!tw.startTime || !tw.endTime) {
        Alert.alert('Erreur', 'Les heures de debut et fin sont requises');
        return;
      }
      const warning = Number(tw.warningThresholdDb);
      const critical = Number(tw.criticalThresholdDb);
      if (isNaN(warning) || warning < 30 || warning > 120) {
        Alert.alert('Erreur', `Seuil attention invalide pour "${tw.label}" (30-120 dB)`);
        return;
      }
      if (isNaN(critical) || critical < 30 || critical > 120) {
        Alert.alert('Erreur', `Seuil critique invalide pour "${tw.label}" (30-120 dB)`);
        return;
      }
      if (critical <= warning) {
        Alert.alert('Erreur', `Le seuil critique doit etre superieur au seuil attention pour "${tw.label}"`);
        return;
      }
    }

    const cooldown = Number(cooldownMinutes);
    if (isNaN(cooldown) || cooldown < 5 || cooldown > 1440) {
      Alert.alert('Erreur', 'Le delai de cooldown doit etre entre 5 et 1440 minutes');
      return;
    }

    saveConfig.mutate(
      {
        propertyId,
        data: {
          enabled,
          notifyInApp,
          notifyEmail,
          notifyGuestMessage,
          notifyWhatsapp,
          notifySms,
          cooldownMinutes: cooldown,
          emailRecipients: emailRecipients.trim() || undefined,
          timeWindows: timeWindows.map((tw) => ({
            label: tw.label.trim(),
            startTime: tw.startTime.trim(),
            endTime: tw.endTime.trim(),
            warningThresholdDb: Number(tw.warningThresholdDb),
            criticalThresholdDb: Number(tw.criticalThresholdDb),
          })),
        },
      },
      {
        onSuccess: () => {
          Alert.alert('Configuration enregistree', 'Les seuils et notifications ont ete mis a jour');
        },
        onError: (error: any) => {
          const message = error?.response?.data?.error ?? error?.message ?? 'Erreur inconnue';
          Alert.alert('Erreur', message);
        },
      },
    );
  }, [enabled, notifyInApp, notifyEmail, notifyGuestMessage, notifyWhatsapp, notifySms, cooldownMinutes, emailRecipients, timeWindows, propertyId, saveConfig]);

  if (isLoading) {
    return (
      <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
        <Skeleton width="60%" height={24} />
        <Skeleton height={100} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={200} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={150} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Section: Activation */}
      <SectionHeader title="Alertes" iconName="notifications-outline" />
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        <ToggleRow
          label="Alertes activees"
          description="Surveiller les niveaux de bruit et envoyer des alertes"
          value={enabled}
          onValueChange={setEnabled}
          iconName="shield-checkmark-outline"
          iconColor={theme.colors.success.main}
        />
      </Card>

      {/* Section: Time Windows & Thresholds */}
      <SectionHeader title="Creneaux horaires & seuils" iconName="time-outline" />

      {timeWindows.map((tw, idx) => (
        <TimeWindowCard
          key={idx}
          window={tw}
          index={idx}
          onChange={handleWindowChange}
          onRemove={handleRemoveWindow}
          theme={theme}
        />
      ))}

      <Pressable
        onPress={handleAddWindow}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: theme.SPACING.md,
          marginBottom: theme.SPACING.lg,
          borderRadius: theme.BORDER_RADIUS.md,
          borderWidth: 1.5,
          borderColor: theme.colors.primary.main,
          borderStyle: 'dashed',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary.main} />
        <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '600' }}>
          Ajouter un creneau
        </Text>
      </Pressable>

      {/* Section: Cooldown */}
      <SectionHeader title="Cooldown" iconName="timer-outline" />
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        <Input
          label="Delai entre alertes (minutes)"
          placeholder="30"
          value={cooldownMinutes}
          onChangeText={setCooldownMinutes}
          keyboardType="number-pad"
          helperText="Empeche les alertes repetees trop rapprochees (5-1440 min)"
        />
      </Card>

      {/* Section: Notification Channels */}
      <SectionHeader title="Canaux de notification" iconName="megaphone-outline" />
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        <ToggleRow
          label="Notification in-app"
          description="Recevoir une notification dans l'application"
          value={notifyInApp}
          onValueChange={setNotifyInApp}
          iconName="notifications-outline"
          iconColor={theme.colors.primary.main}
        />
        <Divider />
        <ToggleRow
          label="Email"
          description="Envoyer un email au proprietaire ou aux destinataires"
          value={notifyEmail}
          onValueChange={setNotifyEmail}
          iconName="mail-outline"
          iconColor={theme.colors.info.main}
        />
        {notifyEmail && (
          <Input
            placeholder="email1@example.com, email2@example.com"
            value={emailRecipients}
            onChangeText={setEmailRecipients}
            helperText="Laissez vide pour utiliser l'email du proprietaire"
            containerStyle={{ marginTop: theme.SPACING.sm, marginBottom: theme.SPACING.sm }}
          />
        )}
        <Divider />
        <ToggleRow
          label="Message au voyageur"
          description="Envoyer un message de courtoisie au voyageur actif"
          value={notifyGuestMessage}
          onValueChange={setNotifyGuestMessage}
          iconName="person-outline"
          iconColor={theme.colors.secondary.main}
        />
        <Divider />
        <ToggleRow
          label="WhatsApp"
          description="Bientot disponible"
          value={notifyWhatsapp}
          onValueChange={setNotifyWhatsapp}
          iconName="logo-whatsapp"
          iconColor="#25D366"
          disabled
        />
        <Divider />
        <ToggleRow
          label="SMS"
          description="Bientot disponible"
          value={notifySms}
          onValueChange={setNotifySms}
          iconName="chatbox-outline"
          iconColor={theme.colors.warning.main}
          disabled
        />
      </Card>

      {/* Save button */}
      <Button
        title="Enregistrer la configuration"
        onPress={handleSave}
        fullWidth
        loading={saveConfig.isPending}
        disabled={saveConfig.isPending}
        icon={<Ionicons name="checkmark-circle-outline" size={18} color="#fff" />}
      />
    </ScrollView>
  );
}

/* ─── Main Screen ─── */

export function NoiseDeviceDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<DashboardStackParamList, 'NoiseDeviceDetail'>>();
  const { deviceId, deviceName, deviceType, deviceStatus, propertyId, propertyName, roomName } = route.params;

  const [activeTab, setActiveTab] = useState<TabKey>('chart');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingVertical: theme.SPACING.md,
        gap: theme.SPACING.sm,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
            ...theme.shadows.sm,
          })}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }} numberOfLines={1}>
            {deviceName}
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }} numberOfLines={1}>
            {propertyName}{roomName ? ` · ${roomName}` : ''}
          </Text>
        </View>
      </View>

      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} theme={theme} />

      {/* Tab content */}
      <View style={{ flex: 1, marginTop: theme.SPACING.sm }}>
        {activeTab === 'chart' ? (
          <ChartTab
            deviceName={deviceName}
            deviceType={deviceType}
            deviceStatus={deviceStatus}
            propertyName={propertyName}
            roomName={roomName}
            theme={theme}
          />
        ) : (
          <ConfigTab
            propertyId={propertyId}
            propertyName={propertyName}
            theme={theme}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
