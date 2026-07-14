import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme';
import {
  housekeeperRatesApi,
  type HousekeeperRates,
  type HousekeeperPropertyRate,
} from '@/api/endpoints/housekeeperRatesApi';

// ─── « Mes tarifs » mobile (Moteur Ménage 4B) — HOUSEKEEPER / TECHNICIAN ─────
// Miroir de client/src/modules/settings/MyRatesSettings.tsx : score qualité en
// tête, taux horaire général, forfaits par logement avec nudge fourchette
// (ancre = médiane conseil, jamais bloquant).

const RATES_KEY = ['housekeeper-rates', 'me'];

/** Badge nudge : « dans le marché » (vert doux) ou écart % neutre. */
function RateNudge({ amount, rate }: { amount: number | null; rate: HousekeeperPropertyRate }) {
  const theme = useTheme();
  const { t } = useTranslation();
  if (amount == null || amount <= 0) return null;
  const inMarket = amount >= rate.advisoryMin && amount <= rate.advisoryMax;
  const deltaPct = rate.advisoryRecommended > 0
    ? Math.round(((amount - rate.advisoryRecommended) / rate.advisoryRecommended) * 100)
    : 0;
  return (
    <View style={{
      borderRadius: 7,
      paddingHorizontal: 7,
      paddingVertical: 2,
      backgroundColor: inMarket ? `${theme.colors.success.main}1F` : theme.colors.background.default,
    }}>
      <Text style={{
        fontSize: 10.5,
        fontWeight: '700',
        color: inMarket ? theme.colors.success.main : theme.colors.text.secondary,
      }}>
        {inMarket
          ? t('myRates.inMarket')
          : `${deltaPct > 0 ? '+' : ''}${deltaPct} %`}
      </Text>
    </View>
  );
}

export function MyRatesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [hourly, setHourly] = useState('');
  const [flats, setFlats] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);

  const ratesQuery = useQuery({ queryKey: RATES_KEY, queryFn: () => housekeeperRatesApi.getMy() });

  useEffect(() => {
    const data = ratesQuery.data;
    if (!data) return;
    setHourly(data.hourlyAmount != null ? String(data.hourlyAmount) : '');
    const next: Record<number, string> = {};
    for (const p of data.properties) {
      if (p.flatAmount != null) next[p.propertyId] = String(p.flatAmount);
    }
    setFlats(next);
  }, [ratesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const flatRates = Object.entries(flats)
        .map(([propertyId, raw]) => ({ propertyId: Number(propertyId), amount: parseFloat(raw) }))
        .filter((f) => !isNaN(f.amount) && f.amount > 0);
      return housekeeperRatesApi.updateMy({
        hourlyAmount: hourly.trim() !== '' && !isNaN(parseFloat(hourly)) ? parseFloat(hourly) : null,
        flatRates,
      });
    },
    onSuccess: (data: HousekeeperRates) => {
      queryClient.setQueryData(RATES_KEY, data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const data = ratesQuery.data;
  const score = data?.score;

  const sectionTitle = (label: string) => (
    <Text style={{
      fontSize: 10.5,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: theme.colors.text.disabled,
      marginBottom: theme.SPACING.sm,
    }}>
      {label}
    </Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md, marginBottom: theme.SPACING.lg }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>{t('myRates.title')}</Text>
        </View>

        {ratesQuery.isLoading && (
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>{t('common.loading')}</Text>
        )}
        {ratesQuery.isError && (
          <Card style={{ marginBottom: theme.SPACING.md }}>
            <Text style={{ ...theme.typography.body2, color: theme.colors.error.main }}>{t('myRates.loadError')}</Text>
          </Card>
        )}

        {data && (
          <>
            {/* ── Score qualité 30 j ── */}
            {score != null && (
              <Card style={{ marginBottom: theme.SPACING.md }}>
                {sectionTitle(t('myRates.scoreSection'))}
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.SPACING.md }}>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.primary.main }}>
                    {score.score}
                    <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.text.secondary }}>/100</Text>
                  </Text>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, flex: 1 }}>
                    {t('myRates.scoreDetail', {
                      count: score.completedCount,
                      proof: Math.round(score.proofRate * 100),
                    })}
                  </Text>
                </View>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: theme.SPACING.sm }}>
                  {t('myRates.scoreHint')}
                </Text>
              </Card>
            )}

            {/* ── Taux horaire ── */}
            <Card style={{ marginBottom: theme.SPACING.md }}>
              {sectionTitle(t('myRates.hourlySection'))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md }}>
                <TextInput
                  value={hourly}
                  onChangeText={setHourly}
                  keyboardType="decimal-pad"
                  placeholder={String(data.referenceHourlyRate)}
                  placeholderTextColor={theme.colors.text.disabled}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.colors.border.light,
                    borderRadius: theme.BORDER_RADIUS.md,
                    paddingHorizontal: theme.SPACING.md,
                    paddingVertical: theme.SPACING.sm,
                    minWidth: 110,
                    color: theme.colors.text.primary,
                    fontVariant: ['tabular-nums'],
                  }}
                />
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>€/h</Text>
              </View>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: theme.SPACING.sm }}>
                {t('myRates.referenceRate', { rate: data.referenceHourlyRate })}
              </Text>
            </Card>

            {/* ── Forfaits par logement ── */}
            <Card style={{ marginBottom: theme.SPACING.md }}>
              {sectionTitle(t('myRates.flatSection'))}
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: theme.SPACING.md }}>
                {t('myRates.flatHint')}
              </Text>
              {data.properties.length === 0 ? (
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, fontStyle: 'italic' }}>
                  {t('myRates.noProperties')}
                </Text>
              ) : (
                data.properties.map((property, index) => {
                  const raw = flats[property.propertyId] ?? '';
                  const amount = raw.trim() !== '' && !isNaN(parseFloat(raw)) ? parseFloat(raw) : null;
                  return (
                    <View
                      key={property.propertyId}
                      style={{
                        paddingVertical: theme.SPACING.sm,
                        borderTopWidth: index > 0 ? 1 : 0,
                        borderTopColor: theme.colors.border.light,
                      }}
                    >
                      <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary, marginBottom: 4 }}>
                        {property.propertyName}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm }}>
                        <TextInput
                          value={raw}
                          onChangeText={(v) => setFlats((prev) => ({ ...prev, [property.propertyId]: v }))}
                          keyboardType="decimal-pad"
                          placeholder={String(property.advisoryRecommended)}
                          placeholderTextColor={theme.colors.text.disabled}
                          style={{
                            borderWidth: 1,
                            borderColor: theme.colors.border.light,
                            borderRadius: theme.BORDER_RADIUS.md,
                            paddingHorizontal: theme.SPACING.md,
                            paddingVertical: 6,
                            width: 90,
                            color: theme.colors.text.primary,
                            fontVariant: ['tabular-nums'],
                          }}
                        />
                        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                          {property.advisoryMin}–{property.advisoryMax} €
                        </Text>
                        <RateNudge amount={amount} rate={property} />
                      </View>
                    </View>
                  );
                })
              )}
            </Card>

            {saveMutation.isError && (
              <Text style={{ ...theme.typography.caption, color: theme.colors.error.main, marginBottom: theme.SPACING.sm }}>
                {t('myRates.saveError')}
              </Text>
            )}
            {saved && (
              <Text style={{ ...theme.typography.caption, color: theme.colors.success.main, marginBottom: theme.SPACING.sm }}>
                {t('myRates.saved')}
              </Text>
            )}
            <Button
              title={t('common.save')}
              onPress={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              fullWidth
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
