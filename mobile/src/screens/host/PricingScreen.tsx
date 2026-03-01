import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Divider } from '@/components/ui/Divider';
import { useProperties } from '@/hooks/useProperties';
import {
  useRatePlans,
  usePricingCalendar,
  useCreateRatePlan,
  useUpdateRatePlan,
  useDeleteRatePlan,
} from '@/hooks/useRatePlans';
import type { RatePlanDto, RatePlanType, PricingCalendarDay, CreateRatePlanRequest } from '@/api/endpoints/ratePlanApi';
import { useAiPricing } from '@/hooks/useAiPricing';
import type { PricePrediction } from '@/api/endpoints/aiPricingApi';
import { ProgressBar } from '@/components/ui/ProgressBar';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type TabKey = 'calendar' | 'plans' | 'ai';

/* ─── Constants ─── */

const PLAN_TYPE_OPTIONS = [
  { label: 'Base', value: 'BASE' },
  { label: 'Saisonnier', value: 'SEASONAL' },
  { label: 'Promotion', value: 'PROMOTIONAL' },
  { label: 'Derniere minute', value: 'LAST_MINUTE' },
];

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_NAMES = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

const SOURCE_COLORS: Record<string, string> = {
  BASE: '#4A7C8E',
  PROMOTIONAL: '#C8924A',
  SEASONAL: '#D97706',
  LAST_MINUTE: '#3B82F6',
  OVERRIDE: '#EF4444',
  PROPERTY_DEFAULT: '#6B7280',
};

const TYPE_COLORS: Record<string, string> = {
  BASE: '#4A7C8E',
  PROMOTIONAL: '#C8924A',
  SEASONAL: '#D97706',
  LAST_MINUTE: '#3B82F6',
};

const TYPE_LABELS: Record<string, string> = {
  BASE: 'Base',
  SEASONAL: 'Saisonnier',
  PROMOTIONAL: 'Promotion',
  LAST_MINUTE: 'Derniere min.',
};

const LEGEND_ITEMS = [
  { label: 'Base', color: SOURCE_COLORS.BASE },
  { label: 'Promotion', color: SOURCE_COLORS.PROMOTIONAL },
  { label: 'Saisonnier', color: SOURCE_COLORS.SEASONAL },
  { label: 'Dern. minute', color: SOURCE_COLORS.LAST_MINUTE },
  { label: 'Override', color: SOURCE_COLORS.OVERRIDE },
  { label: 'Defaut', color: SOURCE_COLORS.PROPERTY_DEFAULT },
];

/* ─── Helpers ─── */

function getMonthDays(year: number, month: number) {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Monday = 0, Sunday = 6 (ISO week)
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells: { day: number; inMonth: boolean; dateStr: string }[] = [];

  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({
      day: d,
      inMonth: false,
      dateStr: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      inMonth: true,
      dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }

  // Next month padding to complete last row
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      cells.push({
        day: d,
        inMonth: false,
        dateStr: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      });
    }
  }

  return cells;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Permanent';
  const fmt = (d: string) => {
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}`;
  };
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `A partir du ${fmt(start)}`;
  return `Jusqu'au ${fmt(end!)}`;
}

/* ─── Tab Bar ─── */

function TabBar({ activeTab, onTabChange, theme }: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const tabs: { key: TabKey; label: string; icon: IoniconsName }[] = [
    { key: 'calendar', label: 'Calendrier', icon: 'calendar-outline' },
    { key: 'plans', label: 'Plans', icon: 'pricetags-outline' },
    { key: 'ai', label: 'IA', icon: 'sparkles-outline' },
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

/* ─── Calendar Tab ─── */

function CalendarTab({
  propertyId,
  theme,
}: {
  propertyId: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: calendarData, isLoading } = usePricingCalendar(propertyId, from, to);

  // Build a lookup map: date → PricingCalendarDay
  const priceMap = useMemo(() => {
    const map = new Map<string, PricingCalendarDay>();
    if (calendarData) {
      for (const day of calendarData) {
        map.set(day.date, day);
      }
    }
    return map;
  }, [calendarData]);

  const cells = useMemo(() => getMonthDays(year, month), [year, month]);
  const rowCount = cells.length / 7;

  const goToPrevMonth = useCallback(() => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const goToNextMonth = useCallback(() => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Build rows for flex layout
  const rows = useMemo(() => {
    const result: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [cells]);

  return (
    <View style={{ flex: 1, paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING.sm }}>
      <Card style={{ flex: 1, justifyContent: 'space-between' }}>
        {/* Month navigation */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.SPACING.md,
        }}>
          <Pressable
            onPress={goToPrevMonth}
            hitSlop={12}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: theme.BORDER_RADIUS.sm,
              backgroundColor: theme.colors.background.surface,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={18} color={theme.colors.text.secondary} />
          </Pressable>
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>
            {MONTH_NAMES[month]} {year}
          </Text>
          <Pressable
            onPress={goToNextMonth}
            hitSlop={12}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: theme.BORDER_RADIUS.sm,
              backgroundColor: theme.colors.background.surface,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="chevron-forward" size={18} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        {/* Day headers */}
        <View style={{ flexDirection: 'row', marginBottom: theme.SPACING.xs ?? 4 }}>
          {DAY_LABELS.map((label) => (
            <View key={label} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{
                ...theme.typography.caption,
                color: theme.colors.text.disabled,
                fontWeight: '700',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar grid — rows fill remaining space */}
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Skeleton height={40} borderRadius={theme.BORDER_RADIUS.sm} style={{ width: '100%', marginBottom: 8 }} />
            <Skeleton height={40} borderRadius={theme.BORDER_RADIUS.sm} style={{ width: '100%', marginBottom: 8 }} />
            <Skeleton height={40} borderRadius={theme.BORDER_RADIUS.sm} style={{ width: '100%', marginBottom: 8 }} />
            <Skeleton height={40} borderRadius={theme.BORDER_RADIUS.sm} style={{ width: '100%', marginBottom: 8 }} />
            <Skeleton height={40} borderRadius={theme.BORDER_RADIUS.sm} style={{ width: '100%' }} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {rows.map((row, rowIdx) => (
              <View key={rowIdx} style={{ flex: 1, flexDirection: 'row' }}>
                {row.map((cell, colIdx) => {
                  const pricing = priceMap.get(cell.dateStr);
                  const price = pricing?.nightlyPrice;
                  const source = pricing?.priceSource ?? 'PROPERTY_DEFAULT';
                  const sourceColor = SOURCE_COLORS[source] ?? SOURCE_COLORS.PROPERTY_DEFAULT;
                  const isToday = cell.dateStr === todayStr;

                  return (
                    <View
                      key={colIdx}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: cell.inMonth ? 1 : 0.25,
                        borderTopWidth: rowIdx > 0 ? 0.5 : 0,
                        borderTopColor: theme.colors.border.light,
                      }}
                    >
                      <Text style={{
                        color: isToday ? theme.colors.primary.main : theme.colors.text.secondary,
                        fontWeight: isToday ? '800' : '500',
                        fontSize: 12,
                        marginBottom: 3,
                      }}>
                        {cell.day}
                      </Text>
                      {price != null && price > 0 ? (
                        <>
                          <Text style={{
                            color: sourceColor,
                            fontWeight: '800',
                            fontSize: 14,
                          }}>
                            {Math.round(price)}
                          </Text>
                          <View style={{
                            width: 22,
                            height: 3,
                            borderRadius: 1.5,
                            backgroundColor: sourceColor,
                            marginTop: 3,
                          }} />
                        </>
                      ) : (
                        <Text style={{
                          color: theme.colors.text.disabled,
                          fontSize: 12,
                        }}>
                          —
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {/* Legend */}
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center',
          paddingTop: theme.SPACING.sm,
          borderTopWidth: 0.5,
          borderTopColor: theme.colors.border.light,
          marginTop: theme.SPACING.sm,
        }}>
          {LEGEND_ITEMS.map((item) => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

/* ─── Rate Plan Form ─── */

interface PlanFormData {
  name: string;
  type: RatePlanType;
  priority: string;
  nightlyPrice: string;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  isActive: boolean;
}

const EMPTY_FORM: PlanFormData = {
  name: '',
  type: 'BASE',
  priority: '1',
  nightlyPrice: '',
  startDate: '',
  endDate: '',
  daysOfWeek: [],
  isActive: true,
};

function RatePlanForm({
  initialData,
  onSave,
  onCancel,
  isSaving,
  theme,
}: {
  initialData?: PlanFormData;
  onSave: (data: PlanFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const [form, setForm] = useState<PlanFormData>(initialData ?? EMPTY_FORM);

  const updateField = useCallback(<K extends keyof PlanFormData>(key: K, value: PlanFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleDay = useCallback((day: number) => {
    setForm((prev) => {
      const days = prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort();
      return { ...prev, daysOfWeek: days };
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.name.trim()) {
      Alert.alert('Erreur', 'Le nom du plan est requis');
      return;
    }
    const price = Number(form.nightlyPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Erreur', 'Le prix par nuit doit etre superieur a 0');
      return;
    }
    const prio = Number(form.priority);
    if (isNaN(prio) || prio < 1) {
      Alert.alert('Erreur', 'La priorite doit etre superieure ou egale a 1');
      return;
    }
    onSave(form);
  }, [form, onSave]);

  return (
    <Card style={{ marginBottom: theme.SPACING.md }}>
      <Input
        label="Nom du plan"
        placeholder="Ex: Haute saison, Promo Noel..."
        value={form.name}
        onChangeText={(v) => updateField('name', v)}
        containerStyle={{ marginBottom: theme.SPACING.md }}
      />

      <Select
        label="Type"
        options={PLAN_TYPE_OPTIONS}
        value={form.type}
        onChange={(v) => updateField('type', v as RatePlanType)}
        containerStyle={{ marginBottom: theme.SPACING.md }}
      />

      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.md }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Prix par nuit (EUR)"
            placeholder="100"
            value={form.nightlyPrice}
            onChangeText={(v) => updateField('nightlyPrice', v)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Priorite"
            placeholder="1"
            value={form.priority}
            onChangeText={(v) => updateField('priority', v)}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '500', marginBottom: 6 }}>
        Periode d'application
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.md }}>
        <View style={{ flex: 1 }}>
          <Input
            placeholder="YYYY-MM-DD"
            value={form.startDate}
            onChangeText={(v) => updateField('startDate', v)}
            helperText="Debut"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            placeholder="YYYY-MM-DD"
            value={form.endDate}
            onChangeText={(v) => updateField('endDate', v)}
            helperText="Fin"
          />
        </View>
      </View>

      {/* Days of week */}
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '500', marginBottom: 6 }}>
        Jours de la semaine
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: theme.SPACING.md, flexWrap: 'wrap' }}>
        {DAY_LABELS.map((label, idx) => {
          const dayNum = idx + 1; // 1=Mon, 7=Sun
          const isSelected = form.daysOfWeek.includes(dayNum);
          return (
            <Pressable
              key={dayNum}
              onPress={() => toggleDay(dayNum)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: theme.BORDER_RADIUS.md,
                borderWidth: 1.5,
                borderColor: isSelected ? theme.colors.primary.main : theme.colors.border.light,
                backgroundColor: isSelected ? `${theme.colors.primary.main}14` : 'transparent',
              }}
            >
              <Text style={{
                ...theme.typography.caption,
                color: isSelected ? theme.colors.primary.main : theme.colors.text.secondary,
                fontWeight: isSelected ? '700' : '500',
              }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10, marginBottom: theme.SPACING.md }}>
        Vide = tous les jours
      </Text>

      {/* Active toggle */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.SPACING.lg,
      }}>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary }}>
          Actif
        </Text>
        <Switch
          value={form.isActive}
          onValueChange={(v) => updateField('isActive', v)}
          trackColor={{ false: theme.colors.border.light, true: `${theme.colors.primary.main}60` }}
          thumbColor={form.isActive ? theme.colors.primary.main : theme.colors.text.disabled}
        />
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Annuler"
            onPress={onCancel}
            fullWidth
            variant="outlined"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Enregistrer"
            onPress={handleSubmit}
            fullWidth
            loading={isSaving}
            disabled={isSaving}
            icon={<Ionicons name="checkmark-circle-outline" size={16} color="#fff" />}
          />
        </View>
      </View>
    </Card>
  );
}

/* ─── Plans Tab ─── */

function PlansTab({
  propertyId,
  theme,
}: {
  propertyId: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const { data: plans, isLoading } = useRatePlans(propertyId);
  const createPlan = useCreateRatePlan();
  const updatePlan = useUpdateRatePlan();
  const deletePlan = useDeleteRatePlan();

  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RatePlanDto | null>(null);

  const handleCreate = useCallback((data: PlanFormData) => {
    createPlan.mutate(
      {
        propertyId,
        name: data.name.trim(),
        type: data.type,
        priority: Number(data.priority),
        nightlyPrice: Number(data.nightlyPrice),
        currency: 'EUR',
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        daysOfWeek: data.daysOfWeek.length > 0 ? data.daysOfWeek : null,
        minStayOverride: null,
        isActive: data.isActive,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          Alert.alert('Plan cree', 'Le plan tarifaire a ete cree avec succes');
        },
        onError: (err: any) => {
          Alert.alert('Erreur', err?.response?.data?.error ?? err?.message ?? 'Erreur inconnue');
        },
      },
    );
  }, [propertyId, createPlan]);

  const handleUpdate = useCallback((data: PlanFormData) => {
    if (!editingPlan) return;
    updatePlan.mutate(
      {
        id: editingPlan.id,
        data: {
          propertyId,
          name: data.name.trim(),
          type: data.type,
          priority: Number(data.priority),
          nightlyPrice: Number(data.nightlyPrice),
          currency: 'EUR',
          startDate: data.startDate || null,
          endDate: data.endDate || null,
          daysOfWeek: data.daysOfWeek.length > 0 ? data.daysOfWeek : null,
          minStayOverride: null,
          isActive: data.isActive,
        },
      },
      {
        onSuccess: () => {
          setEditingPlan(null);
          Alert.alert('Plan modifie', 'Le plan tarifaire a ete mis a jour');
        },
        onError: (err: any) => {
          Alert.alert('Erreur', err?.response?.data?.error ?? err?.message ?? 'Erreur inconnue');
        },
      },
    );
  }, [propertyId, editingPlan, updatePlan]);

  const handleDelete = useCallback((plan: RatePlanDto) => {
    Alert.alert(
      'Supprimer le plan',
      `Voulez-vous vraiment supprimer "${plan.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deletePlan.mutate(
              { id: plan.id, propertyId },
              {
                onError: (err: any) => {
                  Alert.alert('Erreur', err?.response?.data?.error ?? err?.message ?? 'Erreur inconnue');
                },
              },
            );
          },
        },
      ],
    );
  }, [propertyId, deletePlan]);

  const handleToggleActive = useCallback((plan: RatePlanDto) => {
    updatePlan.mutate({
      id: plan.id,
      data: {
        ...plan,
        isActive: !plan.isActive,
      },
    });
  }, [updatePlan]);

  const startEdit = useCallback((plan: RatePlanDto) => {
    setEditingPlan(plan);
    setShowForm(false);
  }, []);

  if (isLoading) {
    return (
      <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
        <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Existing plans */}
      <SectionHeader title="Plans existants" iconName="list-outline" />

      {(!plans || plans.length === 0) ? (
        <EmptyState
          iconName="pricetag-outline"
          title="Aucun plan tarifaire"
          description="Creez votre premier plan tarifaire pour cette propriete"
          compact
          style={{ marginBottom: theme.SPACING.lg }}
        />
      ) : (
        <View style={{ marginBottom: theme.SPACING.lg }}>
          {plans.map((plan) => {
            const typeColor = TYPE_COLORS[plan.type] ?? theme.colors.text.secondary;
            const isEditing = editingPlan?.id === plan.id;

            if (isEditing) {
              return (
                <RatePlanForm
                  key={plan.id}
                  initialData={{
                    name: plan.name,
                    type: plan.type,
                    priority: String(plan.priority),
                    nightlyPrice: String(plan.nightlyPrice),
                    startDate: plan.startDate ?? '',
                    endDate: plan.endDate ?? '',
                    daysOfWeek: plan.daysOfWeek ?? [],
                    isActive: plan.isActive,
                  }}
                  onSave={handleUpdate}
                  onCancel={() => setEditingPlan(null)}
                  isSaving={updatePlan.isPending}
                  theme={theme}
                />
              );
            }

            return (
              <Card key={plan.id} style={{ marginBottom: theme.SPACING.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.SPACING.sm }}>
                  {/* Type badge */}
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: theme.BORDER_RADIUS.full,
                    backgroundColor: `${typeColor}18`,
                  }}>
                    <Text style={{ ...theme.typography.caption, color: typeColor, fontWeight: '700', fontSize: 10 }}>
                      {TYPE_LABELS[plan.type] ?? plan.type}
                    </Text>
                  </View>
                  <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, flex: 1 }} numberOfLines={1}>
                    {plan.name}
                  </Text>
                  <Text style={{ ...theme.typography.h4, color: typeColor, fontWeight: '800' }}>
                    {Math.round(plan.nightlyPrice)}€
                  </Text>
                </View>

                {/* Date range */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="calendar-outline" size={12} color={theme.colors.text.disabled} />
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                    {formatDateRange(plan.startDate, plan.endDate)}
                  </Text>
                </View>

                {/* Days of week */}
                {plan.daysOfWeek && plan.daysOfWeek.length > 0 && plan.daysOfWeek.length < 7 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="repeat-outline" size={12} color={theme.colors.text.disabled} />
                    <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                      {plan.daysOfWeek.map((d) => DAY_LABELS[d - 1]).join(', ')}
                    </Text>
                  </View>
                )}

                {/* Priority */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.SPACING.sm }}>
                  <Ionicons name="flag-outline" size={12} color={theme.colors.text.disabled} />
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                    Priorite: {plan.priority}
                  </Text>
                </View>

                <Divider />

                {/* Actions row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.SPACING.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Switch
                      value={plan.isActive}
                      onValueChange={() => handleToggleActive(plan)}
                      trackColor={{ false: theme.colors.border.light, true: `${theme.colors.success.main}60` }}
                      thumbColor={plan.isActive ? theme.colors.success.main : theme.colors.text.disabled}
                      style={{ transform: [{ scale: 0.8 }] }}
                    />
                    <Text style={{
                      ...theme.typography.caption,
                      color: plan.isActive ? theme.colors.success.main : theme.colors.text.disabled,
                      fontWeight: '600',
                    }}>
                      {plan.isActive ? 'Actif' : 'Inactif'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
                    <Pressable
                      onPress={() => startEdit(plan)}
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: 32,
                        height: 32,
                        borderRadius: theme.BORDER_RADIUS.sm,
                        backgroundColor: `${theme.colors.primary.main}10`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Ionicons name="pencil-outline" size={16} color={theme.colors.primary.main} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(plan)}
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: 32,
                        height: 32,
                        borderRadius: theme.BORDER_RADIUS.sm,
                        backgroundColor: `${theme.colors.error.main}10`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.colors.error.main} />
                    </Pressable>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* New plan form or button */}
      {showForm ? (
        <>
          <SectionHeader title="Nouveau plan" iconName="add-circle-outline" />
          <RatePlanForm
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
            isSaving={createPlan.isPending}
            theme={theme}
          />
        </>
      ) : !editingPlan && (
        <Pressable
          onPress={() => setShowForm(true)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: theme.SPACING.md,
            borderRadius: theme.BORDER_RADIUS.md,
            borderWidth: 1.5,
            borderColor: theme.colors.primary.main,
            borderStyle: 'dashed',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary.main} />
          <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '600' }}>
            Nouveau plan tarifaire
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

/* ─── AI Pricing Tab ─── */

function AiPricingTab({
  propertyId,
  theme,
}: {
  propertyId: number;
  theme: ReturnType<typeof useTheme>;
}) {
  // Next 30 days
  const from = useMemo(() => new Date().toISOString().split('T')[0], []);
  const to = useMemo(() => new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0], []);

  const { data: predictions, isLoading } = useAiPricing(propertyId, from, to);

  if (isLoading) {
    return (
      <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
        <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={60} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={60} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={60} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
    );
  }

  if (!predictions || predictions.length === 0) {
    return (
      <EmptyState
        iconName="sparkles-outline"
        title="Aucune suggestion"
        description="Les suggestions de prix IA seront bientot disponibles pour cette propriete"
        compact
        style={{ marginTop: theme.SPACING.xl }}
      />
    );
  }

  // Summary stats
  const avgPrice = predictions.reduce((s, p) => s + p.suggestedPrice, 0) / predictions.length;
  const maxPrice = Math.max(...predictions.map((p) => p.suggestedPrice));
  const minPrice = Math.min(...predictions.map((p) => p.suggestedPrice));
  const avgConfidence = predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length;
  const highDemandDays = predictions.filter((p) => p.demandScore >= 0.7).length;

  function getDemandColor(score: number): string {
    if (score >= 0.7) return theme.colors.success.main;
    if (score >= 0.4) return theme.colors.warning.main;
    return theme.colors.error.main;
  }

  function getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.8) return 'Haute';
    if (confidence >= 0.5) return 'Moyenne';
    return 'Faible';
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Summary */}
      <SectionHeader title="Recommandations IA" iconName="sparkles-outline" />

      <View style={{
        padding: theme.SPACING.lg,
        backgroundColor: theme.colors.background.paper,
        borderRadius: theme.BORDER_RADIUS.lg,
        marginBottom: theme.SPACING.lg,
        ...theme.shadows.sm,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.SPACING.md }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginBottom: 4 }}>
              Prix moy.
            </Text>
            <Text style={{ ...theme.typography.h3, color: theme.colors.primary.main, fontWeight: '800' }}>
              {Math.round(avgPrice)}€
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: theme.colors.border.light }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginBottom: 4 }}>
              Min / Max
            </Text>
            <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary, fontWeight: '700' }}>
              {Math.round(minPrice)}€ – {Math.round(maxPrice)}€
            </Text>
          </View>
        </View>

        <Divider style={{ marginBottom: theme.SPACING.md }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.info.main} />
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
              Confiance: {getConfidenceLabel(avgConfidence)} ({Math.round(avgConfidence * 100)}%)
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="trending-up" size={16} color={theme.colors.success.main} />
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
              {highDemandDays} jours forte demande
            </Text>
          </View>
        </View>
      </View>

      {/* Day-by-day predictions */}
      <SectionHeader title="Detail par jour" iconName="list-outline" />

      {predictions.map((pred) => {
        const d = new Date(pred.date);
        const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short' });
        const dayNum = d.getDate();
        const monthName = d.toLocaleDateString('fr-FR', { month: 'short' });
        const demandColor = getDemandColor(pred.demandScore);

        return (
          <View
            key={pred.date}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.SPACING.sm,
              padding: theme.SPACING.md,
              marginBottom: theme.SPACING.xs,
              backgroundColor: theme.colors.background.paper,
              borderRadius: theme.BORDER_RADIUS.lg,
              ...theme.shadows.sm,
              borderLeftWidth: 3,
              borderLeftColor: demandColor,
            }}
          >
            {/* Date */}
            <View style={{ alignItems: 'center', width: 44 }}>
              <Text style={{ fontSize: 10, color: theme.colors.text.disabled, fontWeight: '600' }}>
                {dayName}
              </Text>
              <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary, fontWeight: '800' }}>
                {dayNum}
              </Text>
              <Text style={{ fontSize: 10, color: theme.colors.text.disabled }}>
                {monthName}
              </Text>
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
              {/* Demand bar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 10, color: theme.colors.text.disabled, width: 55 }}>
                  Demande
                </Text>
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: `${demandColor}20` }}>
                  <View style={{
                    width: `${Math.round(pred.demandScore * 100)}%`,
                    height: '100%',
                    borderRadius: 3,
                    backgroundColor: demandColor,
                  }} />
                </View>
                <Text style={{ fontSize: 10, color: demandColor, fontWeight: '700', width: 32, textAlign: 'right' }}>
                  {Math.round(pred.demandScore * 100)}%
                </Text>
              </View>

              {/* Confidence bar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 10, color: theme.colors.text.disabled, width: 55 }}>
                  Confiance
                </Text>
                <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: `${theme.colors.info.main}20` }}>
                  <View style={{
                    width: `${Math.round(pred.confidence * 100)}%`,
                    height: '100%',
                    borderRadius: 2,
                    backgroundColor: theme.colors.info.main,
                  }} />
                </View>
                <Text style={{ fontSize: 10, color: theme.colors.info.main, fontWeight: '600', width: 32, textAlign: 'right' }}>
                  {Math.round(pred.confidence * 100)}%
                </Text>
              </View>

              {/* Reason */}
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 10 }} numberOfLines={1}>
                {pred.reason}
              </Text>
            </View>

            {/* Suggested price */}
            <View style={{ alignItems: 'center' }}>
              <Text style={{
                ...theme.typography.h3,
                color: theme.colors.primary.main,
                fontWeight: '800',
              }}>
                {Math.round(pred.suggestedPrice)}€
              </Text>
              <Text style={{ fontSize: 9, color: theme.colors.text.disabled }}>
                / nuit
              </Text>
            </View>
          </View>
        );
      })}

      {/* Legend */}
      <View style={{
        flexDirection: 'row',
        gap: theme.SPACING.md,
        paddingVertical: theme.SPACING.md,
        justifyContent: 'center',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: theme.colors.success.main }} />
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Forte demande</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: theme.colors.warning.main }} />
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Moyenne</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: theme.colors.error.main }} />
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Faible</Text>
        </View>
      </View>
    </ScrollView>
  );
}

/* ─── Main Screen ─── */

export function PricingScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const { data: propertiesData, isLoading: propertiesLoading } = useProperties();
  const properties = propertiesData?.content ?? [];

  const [selectedPropertyId, setSelectedPropertyId] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<TabKey>('calendar');

  // Auto-select first property
  useEffect(() => {
    if (properties.length > 0 && selectedPropertyId === 0) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  const propertyOptions = useMemo(() =>
    properties.map((p) => ({ label: p.name, value: String(p.id) })),
    [properties],
  );

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
          Prix dynamiques
        </Text>
      </View>

      {/* Property selector */}
      {propertiesLoading ? (
        <View style={{ paddingHorizontal: theme.SPACING.lg, marginBottom: theme.SPACING.sm }}>
          <Skeleton height={48} borderRadius={theme.BORDER_RADIUS.sm} />
        </View>
      ) : properties.length > 1 ? (
        <View style={{ paddingHorizontal: theme.SPACING.lg, marginBottom: theme.SPACING.sm }}>
          <Select
            placeholder="Selectionner une propriete"
            options={propertyOptions}
            value={String(selectedPropertyId)}
            onChange={(v) => setSelectedPropertyId(Number(v))}
          />
        </View>
      ) : null}

      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} theme={theme} />

      {/* Tab content */}
      <View style={{ flex: 1, marginTop: theme.SPACING.sm }}>
        {selectedPropertyId > 0 ? (
          activeTab === 'calendar' ? (
            <CalendarTab propertyId={selectedPropertyId} theme={theme} />
          ) : activeTab === 'plans' ? (
            <PlansTab propertyId={selectedPropertyId} theme={theme} />
          ) : (
            <AiPricingTab propertyId={selectedPropertyId} theme={theme} />
          )
        ) : (
          <EmptyState
            iconName="home-outline"
            title="Aucune propriete"
            description="Aucune propriete disponible"
            compact
          />
        )}
      </View>
    </SafeAreaView>
  );
}
