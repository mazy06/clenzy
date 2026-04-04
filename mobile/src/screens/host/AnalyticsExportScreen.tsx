import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Divider } from '@/components/ui/Divider';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useProperties } from '@/hooks/useProperties';
import type { Property } from '@/api/endpoints/propertiesApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

const PERIOD_OPTIONS = [
  { label: 'Ce mois', value: 'month' },
  { label: 'Ce trimestre', value: 'quarter' },
  { label: 'Cette annee', value: 'year' },
  { label: 'Mois dernier', value: 'last_month' },
  { label: 'Trimestre dernier', value: 'last_quarter' },
  { label: 'Annee derniere', value: 'last_year' },
  { label: 'Personnalise', value: 'custom' },
];

const FORMAT_OPTIONS = [
  { label: 'PDF', value: 'pdf' },
  { label: 'CSV', value: 'csv' },
];

interface MetricOption {
  key: string;
  label: string;
  icon: IoniconsName;
  selected: boolean;
}

export function AnalyticsExportScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { data: propertiesData } = useProperties();

  const properties: Property[] = (propertiesData as any)?.content ?? (Array.isArray(propertiesData) ? propertiesData : []);

  const [period, setPeriod] = useState('month');
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [format, setFormat] = useState('pdf');
  const [metrics, setMetrics] = useState<MetricOption[]>([
    { key: 'revenue', label: 'Revenus', icon: 'cash-outline', selected: true },
    { key: 'occupancy', label: 'Taux d\'occupation', icon: 'pie-chart-outline', selected: true },
    { key: 'adr', label: 'ADR (Prix moyen)', icon: 'trending-up-outline', selected: true },
    { key: 'revpar', label: 'RevPAR', icon: 'analytics-outline', selected: false },
    { key: 'reservations', label: 'Reservations', icon: 'calendar-outline', selected: false },
    { key: 'cancellation_rate', label: 'Taux d\'annulation', icon: 'close-circle-outline', selected: false },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const propertyOptions = useMemo(() => [
    { label: 'Toutes les proprietes', value: 'all' },
    ...properties.map((p) => ({ label: p.name, value: String(p.id) })),
  ], [properties]);

  const toggleMetric = (key: string) => {
    setMetrics((prev) => prev.map((m) => m.key === key ? { ...m, selected: !m.selected } : m));
  };

  const selectedMetricCount = metrics.filter((m) => m.selected).length;

  const handleGenerate = async () => {
    if (selectedMetricCount === 0) {
      Alert.alert('Erreur', 'Veuillez selectionner au moins une metrique');
      return;
    }

    setIsGenerating(true);

    // Simulate generation delay
    setTimeout(async () => {
      setIsGenerating(false);
      try {
        const selectedMetricLabels = metrics.filter((m) => m.selected).map((m) => m.label).join(', ');
        const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? period;

        await Share.share({
          title: `Rapport Clenzy - ${periodLabel}`,
          message: `Rapport analytique Clenzy\nPeriode : ${periodLabel}\nMetriques : ${selectedMetricLabels}\nFormat : ${format.toUpperCase()}`,
        });
      } catch {
        // User cancelled share
      }
    }, 1500);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingTop: theme.SPACING.lg,
        paddingBottom: theme.SPACING.md,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: theme.SPACING.md,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
          Exporter les donnees
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Period */}
        <SectionHeader title="Periode" iconName="calendar-outline" />
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <Select
            label="Selectionner la periode"
            options={PERIOD_OPTIONS}
            value={period}
            onChange={setPeriod}
          />
        </Card>

        {/* Properties */}
        <SectionHeader title="Proprietes" iconName="home-outline" />
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <Select
            label="Selectionner les proprietes"
            options={propertyOptions}
            value={selectedProperties[0] || 'all'}
            onChange={(v) => setSelectedProperties(v === 'all' ? [] : [v])}
          />
        </Card>

        {/* Metrics */}
        <SectionHeader title={`Metriques (${selectedMetricCount} selectionnees)`} iconName="stats-chart-outline" />
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          {metrics.map((metric, idx) => (
            <React.Fragment key={metric.key}>
              <Pressable
                onPress={() => toggleMetric(metric.key)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  gap: theme.SPACING.md,
                  backgroundColor: pressed ? theme.colors.background.surface : 'transparent',
                })}
              >
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: theme.BORDER_RADIUS.sm,
                  backgroundColor: metric.selected ? `${theme.colors.primary.main}14` : `${theme.colors.text.disabled}08`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons
                    name={metric.icon}
                    size={16}
                    color={metric.selected ? theme.colors.primary.main : theme.colors.text.disabled}
                  />
                </View>
                <Text style={{
                  ...theme.typography.body2,
                  color: metric.selected ? theme.colors.text.primary : theme.colors.text.secondary,
                  flex: 1,
                  fontWeight: metric.selected ? '600' : '400',
                }}>
                  {metric.label}
                </Text>
                <Ionicons
                  name={metric.selected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={metric.selected ? theme.colors.primary.main : theme.colors.text.disabled}
                />
              </Pressable>
              {idx < metrics.length - 1 && <Divider style={{ marginVertical: 0 }} />}
            </React.Fragment>
          ))}
        </Card>

        {/* Format */}
        <SectionHeader title="Format" iconName="document-outline" />
        <Card style={{ marginBottom: theme.SPACING.xl }}>
          <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
            {FORMAT_OPTIONS.map((f) => (
              <Pressable
                key={f.value}
                onPress={() => setFormat(f.value)}
                style={{
                  flex: 1,
                  paddingVertical: theme.SPACING.md,
                  borderRadius: theme.BORDER_RADIUS.md,
                  borderWidth: 1.5,
                  borderColor: format === f.value ? theme.colors.primary.main : theme.colors.border.light,
                  backgroundColor: format === f.value ? `${theme.colors.primary.main}08` : 'transparent',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Ionicons
                  name={f.value === 'pdf' ? 'document-text-outline' : 'grid-outline'}
                  size={24}
                  color={format === f.value ? theme.colors.primary.main : theme.colors.text.disabled}
                />
                <Text style={{
                  ...theme.typography.body2,
                  fontWeight: format === f.value ? '700' : '500',
                  color: format === f.value ? theme.colors.primary.main : theme.colors.text.secondary,
                }}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Generate button */}
        <Button
          title="Generer le rapport"
          onPress={handleGenerate}
          loading={isGenerating}
          disabled={selectedMetricCount === 0}
          fullWidth
          icon={<Ionicons name="share-outline" size={18} color={theme.colors.primary.contrastText} />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
