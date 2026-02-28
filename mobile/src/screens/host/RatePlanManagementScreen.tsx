import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { Divider } from '@/components/ui/Divider';
import { useRatePlans, usePricingCalendar, useCreateRatePlan, useUpdateRatePlan, useDeleteRatePlan } from '@/hooks/useRatePlans';
import type { RatePlanDto, RatePlanType, CreateRatePlanRequest } from '@/api/endpoints/ratePlanApi';

type RouteParams = {
  RatePlanManagement: { propertyId: number; propertyName: string };
};

type IoniconsName = keyof typeof Ionicons.glyphMap;

/* ─── Constants ─── */

const PLAN_TYPE_OPTIONS = [
  { value: 'BASE', label: 'Tarif de base' },
  { value: 'SEASONAL', label: 'Saisonnier' },
  { value: 'PROMOTIONAL', label: 'Promotionnel' },
  { value: 'LAST_MINUTE', label: 'Derniere minute' },
];

const PLAN_TYPE_ICONS: Record<string, { icon: IoniconsName; color: string }> = {
  BASE: { icon: 'pricetag-outline', color: '#4A7C8E' },
  SEASONAL: { icon: 'leaf-outline', color: '#059669' },
  PROMOTIONAL: { icon: 'flash-outline', color: '#D97706' },
  LAST_MINUTE: { icon: 'time-outline', color: '#DC2626' },
};

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 7, label: 'Dim' },
];

/* ─── Rate Plan Card ─── */

function RatePlanCard({
  plan,
  onEdit,
  onDelete,
}: {
  plan: RatePlanDto;
  onEdit: (plan: RatePlanDto) => void;
  onDelete: (plan: RatePlanDto) => void;
}) {
  const theme = useTheme();
  const typeConfig = PLAN_TYPE_ICONS[plan.type] ?? PLAN_TYPE_ICONS.BASE;

  const dateRange = useMemo(() => {
    if (!plan.startDate && !plan.endDate) return null;
    const start = plan.startDate ? new Date(plan.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '...';
    const end = plan.endDate ? new Date(plan.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '...';
    return `${start} → ${end}`;
  }, [plan.startDate, plan.endDate]);

  const daysLabel = useMemo(() => {
    if (!plan.daysOfWeek?.length) return null;
    if (plan.daysOfWeek.length === 7) return 'Tous les jours';
    return plan.daysOfWeek.map((d) => DAYS_OF_WEEK.find((dw) => dw.value === d)?.label).filter(Boolean).join(', ');
  }, [plan.daysOfWeek]);

  return (
    <Card style={{ marginBottom: theme.SPACING.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Icon */}
        <View style={{
          width: 40, height: 40, borderRadius: theme.BORDER_RADIUS.md,
          backgroundColor: `${typeConfig.color}10`,
          alignItems: 'center', justifyContent: 'center',
          marginRight: theme.SPACING.md,
        }}>
          <Ionicons name={typeConfig.icon} size={20} color={typeConfig.color} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: 4 }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, flex: 1 }} numberOfLines={1}>
              {plan.name}
            </Text>
            <Badge
              label={plan.isActive ? 'Actif' : 'Inactif'}
              variant="subtle"
              color={plan.isActive ? 'success' : 'error'}
              size="small"
            />
          </View>

          <Text style={{ ...theme.typography.h4, color: theme.colors.primary.main, marginBottom: 4 }}>
            {plan.nightlyPrice.toFixed(2)} {plan.currency}/nuit
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.SPACING.sm, marginTop: 4 }}>
            <Badge
              label={PLAN_TYPE_OPTIONS.find((o) => o.value === plan.type)?.label ?? plan.type}
              variant="subtle"
              color="primary"
              size="small"
            />
            {dateRange && (
              <Badge label={dateRange} variant="subtle" color="info" size="small" />
            )}
            {daysLabel && (
              <Badge label={daysLabel} variant="subtle" color="warning" size="small" />
            )}
            {plan.minStayOverride != null && (
              <Badge label={`Min ${plan.minStayOverride} nuits`} variant="subtle" color="info" size="small" />
            )}
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginTop: theme.SPACING.md }}>
        <Pressable
          onPress={() => onEdit(plan)}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 6, paddingVertical: 10, borderRadius: theme.BORDER_RADIUS.sm,
            backgroundColor: pressed ? theme.colors.background.surface : `${theme.colors.primary.main}06`,
          })}
        >
          <Ionicons name="create-outline" size={16} color={theme.colors.primary.main} />
          <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '600' }}>
            Modifier
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onDelete(plan)}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 6, paddingVertical: 10, borderRadius: theme.BORDER_RADIUS.sm,
            backgroundColor: pressed ? `${theme.colors.error.main}12` : `${theme.colors.error.main}06`,
          })}
        >
          <Ionicons name="trash-outline" size={16} color={theme.colors.error.main} />
          <Text style={{ ...theme.typography.caption, color: theme.colors.error.main, fontWeight: '600' }}>
            Supprimer
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

/* ─── Pricing Calendar Preview ─── */

function PricingCalendarPreview({ propertyId }: { propertyId: number }) {
  const theme = useTheme();
  const today = new Date();
  const from = today.toISOString().split('T')[0];
  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 13); // Show 2 weeks
  const to = toDate.toISOString().split('T')[0];

  const { data: calendar, isLoading } = usePricingCalendar(propertyId, from, to);

  if (isLoading) {
    return (
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>
          Calendrier des prix
        </Text>
        <ActivityIndicator size="small" color={theme.colors.primary.main} />
      </Card>
    );
  }

  if (!calendar?.length) return null;

  return (
    <Card style={{ marginBottom: theme.SPACING.lg }}>
      <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.md }}>
        Calendrier des prix (14j)
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {calendar.map((day) => {
          const d = new Date(day.date);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const isReserved = day.status !== 'AVAILABLE';

          return (
            <View
              key={day.date}
              style={{
                width: '13%',
                aspectRatio: 1,
                borderRadius: theme.BORDER_RADIUS.sm,
                backgroundColor: isReserved
                  ? `${theme.colors.error.main}10`
                  : isWeekend
                    ? `${theme.colors.warning.main}08`
                    : theme.colors.background.surface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: isReserved ? `${theme.colors.error.main}30` : theme.colors.border.light,
              }}
            >
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 9 }}>
                {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </Text>
              {day.nightlyPrice != null && (
                <Text style={{
                  ...theme.typography.caption,
                  fontSize: 10,
                  fontWeight: '700',
                  color: isReserved ? theme.colors.text.disabled : theme.colors.text.primary,
                }}>
                  {Math.round(day.nightlyPrice)}€
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/* ─── Add/Edit Modal ─── */

function RatePlanFormModal({
  visible,
  onClose,
  propertyId,
  editPlan,
}: {
  visible: boolean;
  onClose: () => void;
  propertyId: number;
  editPlan?: RatePlanDto | null;
}) {
  const theme = useTheme();
  const createMutation = useCreateRatePlan();
  const updateMutation = useUpdateRatePlan();

  const [name, setName] = useState(editPlan?.name ?? '');
  const [type, setType] = useState<string>(editPlan?.type ?? 'BASE');
  const [price, setPrice] = useState(editPlan?.nightlyPrice?.toString() ?? '');
  const [currency, setCurrency] = useState(editPlan?.currency ?? 'EUR');
  const [startDate, setStartDate] = useState(editPlan?.startDate ?? '');
  const [endDate, setEndDate] = useState(editPlan?.endDate ?? '');
  const [minStay, setMinStay] = useState(editPlan?.minStayOverride?.toString() ?? '');
  const [isActive, setIsActive] = useState(editPlan?.isActive ?? true);
  const [selectedDays, setSelectedDays] = useState<number[]>(editPlan?.daysOfWeek ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when editPlan changes
  React.useEffect(() => {
    setName(editPlan?.name ?? '');
    setType(editPlan?.type ?? 'BASE');
    setPrice(editPlan?.nightlyPrice?.toString() ?? '');
    setCurrency(editPlan?.currency ?? 'EUR');
    setStartDate(editPlan?.startDate ?? '');
    setEndDate(editPlan?.endDate ?? '');
    setMinStay(editPlan?.minStayOverride?.toString() ?? '');
    setIsActive(editPlan?.isActive ?? true);
    setSelectedDays(editPlan?.daysOfWeek ?? []);
    setErrors({});
  }, [editPlan]);

  const toggleDay = useCallback((day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }, []);

  const handleSubmit = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Nom requis';
    if (!price || isNaN(parseFloat(price))) newErrors.price = 'Prix valide requis';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const data: CreateRatePlanRequest = {
      propertyId,
      name: name.trim(),
      type: type as RatePlanType,
      priority: editPlan?.priority ?? 0,
      nightlyPrice: parseFloat(price),
      currency,
      startDate: startDate || null,
      endDate: endDate || null,
      daysOfWeek: selectedDays.length > 0 ? selectedDays : null,
      minStayOverride: minStay ? parseInt(minStay, 10) : null,
      isActive,
    };

    if (editPlan) {
      updateMutation.mutate(
        { id: editPlan.id, data },
        { onSuccess: () => onClose() },
      );
    } else {
      createMutation.mutate(data, { onSuccess: () => onClose() });
    }
  }, [name, type, price, currency, startDate, endDate, selectedDays, minStay, isActive, propertyId, editPlan, createMutation, updateMutation, onClose]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: theme.colors.background.paper,
            borderTopLeftRadius: theme.BORDER_RADIUS.xl,
            borderTopRightRadius: theme.BORDER_RADIUS.xl,
            padding: theme.SPACING.lg,
            paddingBottom: theme.SPACING['4xl'],
            maxHeight: '85%',
          }}
          onPress={() => {}}
        >
          <View style={{
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: theme.colors.border.main,
            alignSelf: 'center', marginBottom: theme.SPACING.lg,
          }} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, marginBottom: theme.SPACING.lg }}>
              {editPlan ? 'Modifier le tarif' : 'Nouveau tarif'}
            </Text>

            <Input
              label="Nom du tarif"
              value={name}
              onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: '' })); }}
              placeholder="Ex: Tarif ete 2025"
              error={errors.name}
            />

            <View style={{ marginTop: theme.SPACING.md }}>
              <Select
                label="Type de tarif"
                options={PLAN_TYPE_OPTIONS}
                value={type}
                onChange={setType}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: theme.SPACING.md, marginTop: theme.SPACING.md }}>
              <View style={{ flex: 2 }}>
                <Input
                  label="Prix/nuit"
                  value={price}
                  onChangeText={(t) => { setPrice(t); setErrors((e) => ({ ...e, price: '' })); }}
                  keyboardType="numeric"
                  placeholder="0.00"
                  error={errors.price}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Select
                  label="Devise"
                  options={[{ value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' }, { value: 'GBP', label: 'GBP' }]}
                  value={currency}
                  onChange={setCurrency}
                />
              </View>
            </View>

            {/* Date range */}
            <View style={{ flexDirection: 'row', gap: theme.SPACING.md, marginTop: theme.SPACING.md }}>
              <View style={{ flex: 1 }}>
                <Input label="Date debut" value={startDate} onChangeText={setStartDate} placeholder="AAAA-MM-JJ" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Date fin" value={endDate} onChangeText={setEndDate} placeholder="AAAA-MM-JJ" />
              </View>
            </View>

            {/* Days of week */}
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontWeight: '500', marginTop: theme.SPACING.md, marginBottom: 8 }}>
              Jours applicables (optionnel)
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: theme.SPACING.md }}>
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day.value);
                return (
                  <Pressable
                    key={day.value}
                    onPress={() => toggleDay(day.value)}
                    style={{
                      flex: 1, alignItems: 'center', paddingVertical: 8,
                      borderRadius: theme.BORDER_RADIUS.sm,
                      backgroundColor: isSelected ? theme.colors.primary.main : theme.colors.background.surface,
                      borderWidth: 1,
                      borderColor: isSelected ? theme.colors.primary.main : theme.colors.border.light,
                    }}
                  >
                    <Text style={{
                      ...theme.typography.caption, fontWeight: '600',
                      color: isSelected ? '#fff' : theme.colors.text.secondary,
                    }}>
                      {day.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Min stay */}
            <Input
              label="Sejour minimum (nuits, optionnel)"
              value={minStay}
              onChangeText={setMinStay}
              keyboardType="numeric"
              placeholder="Ex: 2"
            />

            {/* Active toggle */}
            <View style={{ marginTop: theme.SPACING.sm }}>
              <ToggleRow label="Tarif actif" value={isActive} onValueChange={setIsActive} iconName="checkmark-circle-outline" />
            </View>

            <View style={{ marginTop: theme.SPACING['2xl'], gap: theme.SPACING.sm }}>
              <Button
                title={editPlan ? 'Enregistrer' : 'Creer le tarif'}
                onPress={handleSubmit}
                fullWidth
                loading={isPending}
              />
              <Button title="Annuler" variant="text" onPress={onClose} fullWidth />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── Main Screen ─── */

export function RatePlanManagementScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'RatePlanManagement'>>();
  const { propertyId, propertyName } = route.params;

  const { data: plans, isLoading } = useRatePlans(propertyId);
  const deleteMutation = useDeleteRatePlan();

  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState<RatePlanDto | null>(null);

  const handleEdit = useCallback((plan: RatePlanDto) => {
    setEditPlan(plan);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback((plan: RatePlanDto) => {
    Alert.alert(
      'Supprimer le tarif',
      `Supprimer "${plan.name}" ? Cette action est irreversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => deleteMutation.mutate({ id: plan.id, propertyId }),
        },
      ],
    );
  }, [deleteMutation, propertyId]);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditPlan(null);
  }, []);

  // Group plans by type
  const sortedPlans = useMemo(() => {
    if (!plans?.length) return [];
    const typeOrder: Record<string, number> = { BASE: 0, SEASONAL: 1, PROMOTIONAL: 2, LAST_MINUTE: 3 };
    return [...plans].sort((a, b) => (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99));
  }, [plans]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg, paddingVertical: theme.SPACING.md,
        backgroundColor: theme.colors.background.paper, gap: theme.SPACING.md,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>Tarifs</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>{propertyName}</Text>
        </View>
        <Pressable
          onPress={() => { setEditPlan(null); setShowForm(true); }}
          style={{
            width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.full,
            backgroundColor: theme.colors.primary.main,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}>
        {/* Pricing calendar preview */}
        <PricingCalendarPreview propertyId={propertyId} />

        {/* Rate plans list */}
        {sortedPlans.length === 0 ? (
          <EmptyState
            iconName="pricetag-outline"
            title="Aucun tarif"
            description="Creez votre premier tarif pour cette propriete"
            style={{ paddingVertical: theme.SPACING['3xl'] }}
          />
        ) : (
          sortedPlans.map((plan) => (
            <RatePlanCard key={plan.id} plan={plan} onEdit={handleEdit} onDelete={handleDelete} />
          ))
        )}
      </ScrollView>

      <RatePlanFormModal
        visible={showForm}
        onClose={handleCloseForm}
        propertyId={propertyId}
        editPlan={editPlan}
      />
    </SafeAreaView>
  );
}
