import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme';
import { useNoiseChartData, useUnacknowledgedAlertCount } from '@/hooks/useNoiseMonitoring';

type IoniconsName = keyof typeof Ionicons.glyphMap;

export const NoiseTrackingCard = React.memo(function NoiseTrackingCard() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { data: chartData, isLoading: chartLoading } = useNoiseChartData();
  const { data: unackData, isLoading: unackLoading } = useUnacknowledgedAlertCount();

  const isLoading = chartLoading || unackLoading;
  const devices = chartData?.devices ?? [];
  const alertCount = unackData?.count ?? 0;

  // Compute aggregated values across all devices
  const activeDevices = devices.length;
  const avgLevel = activeDevices > 0
    ? Math.round(devices.reduce((sum, d) => sum + d.currentLevel, 0) / activeDevices)
    : 0;
  const maxLevel = activeDevices > 0
    ? Math.max(...devices.map((d) => d.maxLevel))
    : 0;

  // Status color based on alert count
  const statusColor = alertCount === 0
    ? theme.colors.success.main
    : alertCount <= 2
      ? theme.colors.warning.main
      : theme.colors.error.main;

  const statusIcon: IoniconsName = alertCount === 0
    ? 'checkmark-circle'
    : alertCount <= 2
      ? 'warning'
      : 'alert-circle';

  if (isLoading) {
    return (
      <Card style={{ flex: 1, minWidth: 140, justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
        <ActivityIndicator size="small" color={theme.colors.primary.main} />
      </Card>
    );
  }

  if (activeDevices === 0) {
    return (
      <Card
        onPress={() => navigation.navigate('NoiseMonitoring')}
        style={{ flex: 1, minWidth: 140 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.SPACING.sm }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }} numberOfLines={1}>
            Nuisance sonore
          </Text>
          <View style={{
            width: 32,
            height: 32,
            borderRadius: theme.BORDER_RADIUS.sm,
            backgroundColor: `${theme.colors.text.disabled}0C`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name="volume-mute-outline" size={16} color={theme.colors.text.disabled} />
          </View>
        </View>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: theme.SPACING.xs }}>
          Aucun capteur
        </Text>
      </Card>
    );
  }

  return (
    <Card
      onPress={() => navigation.navigate('NoiseMonitoring')}
      style={{ flex: 1, minWidth: 140 }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.SPACING.sm }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }} numberOfLines={1}>
          Nuisance sonore
        </Text>
        <View style={{
          width: 32,
          height: 32,
          borderRadius: theme.BORDER_RADIUS.sm,
          backgroundColor: `${statusColor}14`,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name="volume-high-outline" size={16} color={statusColor} />
        </View>
      </View>

      {/* Alert count */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ ...theme.typography.display, color: theme.colors.text.primary, fontSize: 26 }}>
          {alertCount}
        </Text>
        <Ionicons name={statusIcon} size={16} color={statusColor} />
      </View>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: theme.SPACING.sm }}>
        {alertCount === 0 ? 'Tout est calme' : alertCount === 1 ? 'alerte non acquittee' : 'alertes non acquittees'}
      </Text>

      {/* Device summary */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: theme.SPACING.xs,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border.light,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }} numberOfLines={1}>
            {activeDevices} capteur{activeDevices > 1 ? 's' : ''} · Moy {avgLevel} dB · Max {maxLevel} dB
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={theme.colors.text.disabled} />
      </View>
    </Card>
  );
});
