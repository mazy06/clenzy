import React, { useCallback, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  useNoiseDevices,
  useNoiseChartData,
  useNoiseAlerts,
  useUnacknowledgedAlertCount,
  useAcknowledgeAlert,
} from '@/hooks/useNoiseMonitoring';
import type { NoiseDeviceDto, DeviceSummary, NoiseAlertDto } from '@/api/endpoints/noiseApi';

/* ─── Helpers ─── */

function formatRelativeDate(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "A l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getDbColor(level: number, theme: ReturnType<typeof useTheme>): string {
  if (level < 50) return theme.colors.success.main;
  if (level < 70) return theme.colors.warning.main;
  return theme.colors.error.main;
}

function getDeviceTypeLabel(type: string): string {
  switch (type) {
    case 'MINUT': return 'Minut';
    case 'TUYA': return 'Clenzy Hardware';
    default: return type;
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

function getStatusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'Actif';
    case 'INACTIVE': return 'Inactif';
    case 'PENDING': return 'En attente';
    default: return status;
  }
}

/* ─── Device Card (tappable) ─── */

function DeviceCard({
  device,
  liveData,
  theme,
  onPress,
}: {
  device: NoiseDeviceDto;
  liveData: DeviceSummary | undefined;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  const hasData = liveData && liveData.currentLevel >= 0;
  const statusColor = getStatusColor(device.status, theme);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ marginBottom: theme.SPACING.sm }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.SPACING.sm }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: hasData
              ? `${getDbColor(liveData!.currentLevel, theme)}14`
              : `${theme.colors.text.disabled}14`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons
              name="mic-outline"
              size={18}
              color={hasData ? getDbColor(liveData!.currentLevel, theme) : theme.colors.text.disabled}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }} numberOfLines={1}>
              {device.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
                {getDeviceTypeLabel(device.deviceType)}
              </Text>
              {device.propertyName && (
                <>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>·</Text>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }} numberOfLines={1}>
                    {device.propertyName}
                  </Text>
                </>
              )}
              {device.roomName && (
                <>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>·</Text>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
                    {device.roomName}
                  </Text>
                </>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.text.disabled} />
        </View>

        {/* Bottom row: status/data + badge */}
        {hasData ? (
          <>
            {/* Progress bar */}
            <View style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: theme.colors.background.surface,
              marginBottom: theme.SPACING.sm,
              overflow: 'hidden',
            }}>
              <View style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, liveData!.currentLevel))}%`,
                borderRadius: 3,
                backgroundColor: getDbColor(liveData!.currentLevel, theme),
              }} />
            </View>

            {/* Stats row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="analytics-outline" size={12} color={theme.colors.text.disabled} />
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                  Moy: {Math.round(liveData!.averageLevel)} dB
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="arrow-up-outline" size={12} color={theme.colors.text.disabled} />
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                  Max: {Math.round(liveData!.maxLevel)} dB
                </Text>
              </View>
              <View style={{ flex: 1 }} />
              <View style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: theme.BORDER_RADIUS.full,
                backgroundColor: `${getDbColor(liveData!.currentLevel, theme)}14`,
              }}>
                <Text style={{
                  ...theme.typography.caption,
                  color: getDbColor(liveData!.currentLevel, theme),
                  fontWeight: '700',
                }}>
                  {Math.round(liveData!.currentLevel)} dB
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
            <Ionicons name="information-circle-outline" size={14} color={theme.colors.text.disabled} />
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, flex: 1 }}>
              En attente de donnees...
            </Text>
            <View style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: theme.BORDER_RADIUS.full,
              backgroundColor: `${statusColor}14`,
            }}>
              <Text style={{ ...theme.typography.caption, color: statusColor, fontWeight: '600', fontSize: 10 }}>
                {getStatusLabel(device.status)}
              </Text>
            </View>
          </View>
        )}
      </Card>
    </Pressable>
  );
}

/* ─── Alert Item ─── */

function AlertItem({
  alert,
  theme,
  onAcknowledge,
}: {
  alert: NoiseAlertDto;
  theme: ReturnType<typeof useTheme>;
  onAcknowledge: (id: number) => void;
}) {
  const isCritical = alert.severity === 'CRITICAL';
  const severityColor = isCritical ? theme.colors.error.main : theme.colors.warning.main;
  const severityIcon = isCritical ? 'alert-circle' : 'warning';
  const severityLabel = isCritical ? 'Critique' : 'Attention';

  return (
    <Card style={{ marginBottom: theme.SPACING.sm }}>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        {/* Severity icon */}
        <View style={{
          width: 36,
          height: 36,
          borderRadius: theme.BORDER_RADIUS.md,
          backgroundColor: `${severityColor}14`,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        }}>
          <Ionicons name={severityIcon} size={18} color={severityColor} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <View style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: theme.BORDER_RADIUS.full,
              backgroundColor: `${severityColor}14`,
            }}>
              <Text style={{ ...theme.typography.caption, color: severityColor, fontWeight: '700', fontSize: 10 }}>
                {severityLabel}
              </Text>
            </View>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }}>
              {formatRelativeDate(alert.createdAt)}
            </Text>
          </View>

          {/* Property + Device */}
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, marginBottom: 2 }} numberOfLines={1}>
            {alert.propertyName ?? 'Propriete inconnue'}
            {alert.deviceName ? ` · ${alert.deviceName}` : ''}
          </Text>

          {/* dB info */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
              Mesure: <Text style={{ fontWeight: '700', color: severityColor }}>{alert.measuredDb} dB</Text>
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
              Seuil: {alert.thresholdDb} dB
            </Text>
          </View>

          {/* Time window */}
          {alert.timeWindowLabel && (
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10, marginBottom: 4 }}>
              Fenetre: {alert.timeWindowLabel}
            </Text>
          )}

          {/* Acknowledge button */}
          {!alert.acknowledged && (
            <Pressable
              onPress={() => onAcknowledge(alert.id)}
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: theme.colors.primary.main,
                opacity: pressed ? 0.85 : 1,
                marginTop: 4,
              })}
            >
              <Ionicons name="checkmark" size={14} color="#fff" />
              <Text style={{ ...theme.typography.caption, color: '#fff', fontWeight: '600' }}>
                Acquitter
              </Text>
            </Pressable>
          )}

          {alert.acknowledged && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.success.main} />
              <Text style={{ ...theme.typography.caption, color: theme.colors.success.main }}>
                Acquittee
              </Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

/* ─── Screen Skeleton ─── */

function ScreenSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <Skeleton width="50%" height={24} />
      <Skeleton height={100} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={100} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton width="40%" height={24} style={{ marginTop: theme.SPACING.md }} />
      <Skeleton height={120} borderRadius={theme.BORDER_RADIUS.lg} />
    </View>
  );
}

/* ─── Main Screen ─── */

export function NoiseMonitoringScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  // Real device list (org-scoped)
  const { data: devicesData, isLoading: devicesLoading, isRefetching: devicesRefetching, refetch: refetchDevices } = useNoiseDevices();
  // Live noise data (enrichment)
  const { data: chartData, refetch: refetchChart } = useNoiseChartData();
  // Alerts
  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useNoiseAlerts({ size: 20 });
  const { data: unackData } = useUnacknowledgedAlertCount();
  const acknowledgeAlert = useAcknowledgeAlert();

  const devices = devicesData ?? [];
  const liveSummaries = chartData?.devices ?? [];
  const alerts = alertsData?.content ?? [];
  const unackCount = unackData?.count ?? 0;

  // Build a lookup map: label → DeviceSummary for matching live data to devices
  const liveDataMap = useMemo(() => {
    const map = new Map<string, DeviceSummary>();
    for (const summary of liveSummaries) {
      map.set(summary.label, summary);
    }
    return map;
  }, [liveSummaries]);

  // Match device to its live data summary
  const getLiveData = useCallback((device: NoiseDeviceDto): DeviceSummary | undefined => {
    const base = device.propertyName || `Propriete #${device.propertyId}`;
    const label = device.roomName ? `${base} - ${device.roomName}` : base;
    return liveDataMap.get(label);
  }, [liveDataMap]);

  const handleRefresh = useCallback(() => {
    refetchDevices();
    refetchChart();
    refetchAlerts();
  }, [refetchDevices, refetchChart, refetchAlerts]);

  const handleAcknowledge = useCallback((id: number) => {
    acknowledgeAlert.mutate({ id });
  }, [acknowledgeAlert]);

  const handleDevicePress = useCallback((device: NoiseDeviceDto) => {
    (navigation as any).navigate('NoiseDeviceDetail', {
      deviceId: device.id,
      deviceName: device.name,
      deviceType: device.deviceType,
      deviceStatus: device.status,
      propertyId: device.propertyId,
      propertyName: device.propertyName || `Propriete #${device.propertyId}`,
      roomName: device.roomName,
    });
  }, [navigation]);

  const isLoading = devicesLoading && alertsLoading;

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
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
          Nuisance sonore
        </Text>
        {unackCount > 0 && (
          <View style={{
            minWidth: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: theme.colors.error.main,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 8,
          }}>
            <Text style={{ ...theme.typography.caption, color: '#fff', fontWeight: '700', fontSize: 11 }}>
              {unackCount}
            </Text>
          </View>
        )}
        <Pressable
          onPress={() => navigation.navigate('AddNoiseDevice' as never)}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.primary.main,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
            ...theme.shadows.sm,
          })}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      {isLoading ? (
        <ScreenSkeleton theme={theme} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={devicesRefetching} onRefresh={handleRefresh} tintColor={theme.colors.primary.main} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Devices section */}
          <View style={{ paddingHorizontal: theme.SPACING.lg }}>
            <SectionHeader title="Capteurs" iconName="mic-outline" />

            {devices.length === 0 ? (
              <EmptyState
                iconName="mic-off-outline"
                title="Aucun capteur"
                description="Aucun capteur de bruit n'est configure"
                compact
                style={{ marginBottom: theme.SPACING.lg }}
              />
            ) : (
              <View style={{ marginBottom: theme.SPACING.lg }}>
                {devices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    liveData={getLiveData(device)}
                    theme={theme}
                    onPress={() => handleDevicePress(device)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Alerts section */}
          <View style={{ paddingHorizontal: theme.SPACING.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionHeader title="Alertes recentes" iconName="notifications-outline" style={{ flex: 1, marginBottom: 0 }} />
              {unackCount > 0 && (
                <View style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: theme.BORDER_RADIUS.full,
                  backgroundColor: `${theme.colors.error.main}14`,
                  marginBottom: theme.SPACING.md,
                  marginTop: theme.SPACING.sm,
                }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.error.main, fontWeight: '700', fontSize: 10 }}>
                    {unackCount} non acquittee{unackCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>

            {alerts.length === 0 ? (
              <EmptyState
                iconName="shield-checkmark-outline"
                title="Aucune alerte"
                description="Aucune alerte de bruit recente"
                compact
                style={{ marginBottom: theme.SPACING.lg }}
              />
            ) : (
              <View style={{ marginBottom: theme.SPACING.lg }}>
                {alerts.map((alert) => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    theme={theme}
                    onAcknowledge={handleAcknowledge}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
