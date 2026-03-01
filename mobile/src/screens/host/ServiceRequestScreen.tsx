import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
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
import { useServiceRequests, useCreateServiceRequest } from '@/hooks/useServiceRequests';
import { useAuthStore } from '@/store/authStore';
import type { ServiceRequest } from '@/api/endpoints/serviceRequestsApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type TabKey = 'new' | 'history';
type CategoryKey = 'cleaning' | 'maintenance' | 'other';

/* ─── Constants ─── */

const SERVICE_CATEGORIES: Array<{
  key: CategoryKey;
  label: string;
  icon: IoniconsName;
  color: string;
  desc: string;
}> = [
  { key: 'cleaning', label: 'Menage', icon: 'sparkles-outline', color: '#0D9488', desc: 'Nettoyage, desinfection' },
  { key: 'maintenance', label: 'Travaux', icon: 'hammer-outline', color: '#D97706', desc: 'Reparations, maintenance' },
  { key: 'other', label: 'Autre', icon: 'ellipsis-horizontal-circle-outline', color: '#C8924A', desc: 'Jardinage, exterieur...' },
];

const SERVICE_TYPES: Record<CategoryKey, Array<{ value: string; label: string }>> = {
  cleaning: [
    { value: 'CLEANING', label: 'Menage standard' },
    { value: 'EXPRESS_CLEANING', label: 'Menage express' },
    { value: 'DEEP_CLEANING', label: 'Nettoyage en profondeur' },
    { value: 'WINDOW_CLEANING', label: 'Nettoyage vitres' },
    { value: 'FLOOR_CLEANING', label: 'Nettoyage sols' },
    { value: 'KITCHEN_CLEANING', label: 'Nettoyage cuisine' },
    { value: 'BATHROOM_CLEANING', label: 'Salle de bain' },
    { value: 'EXTERIOR_CLEANING', label: 'Nettoyage exterieur' },
    { value: 'DISINFECTION', label: 'Desinfection' },
  ],
  maintenance: [
    { value: 'PREVENTIVE_MAINTENANCE', label: 'Maintenance preventive' },
    { value: 'EMERGENCY_REPAIR', label: 'Reparation urgente' },
    { value: 'ELECTRICAL_REPAIR', label: 'Electricite' },
    { value: 'PLUMBING_REPAIR', label: 'Plomberie' },
    { value: 'HVAC_REPAIR', label: 'Climatisation / Chauffage' },
    { value: 'APPLIANCE_REPAIR', label: 'Electromenager' },
  ],
  other: [
    { value: 'GARDENING', label: 'Jardinage' },
    { value: 'PEST_CONTROL', label: 'Desinsectisation' },
    { value: 'RESTORATION', label: 'Restauration' },
    { value: 'OTHER', label: 'Autre' },
  ],
};

const TIME_SLOT_OPTIONS = [
  { label: 'Matin (8h-12h)', value: 'MORNING' },
  { label: 'Apres-midi (12h-17h)', value: 'AFTERNOON' },
  { label: 'Soiree (17h-21h)', value: 'EVENING' },
  { label: 'Flexible', value: 'FLEXIBLE' },
];

const PRIORITY_OPTIONS = [
  { label: 'Basse', value: 'LOW' },
  { label: 'Normale', value: 'NORMAL' },
  { label: 'Haute', value: 'HIGH' },
  { label: 'Critique', value: 'CRITICAL' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#D97706',
  APPROVED: '#0D9488',
  DEVIS_ACCEPTED: '#C8924A',
  IN_PROGRESS: '#3B82F6',
  COMPLETED: '#059669',
  CANCELLED: '#EF4444',
  REJECTED: '#DC2626',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuvee',
  DEVIS_ACCEPTED: 'Devis accepte',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminee',
  CANCELLED: 'Annulee',
  REJECTED: 'Refusee',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#6B7280',
  NORMAL: '#3B82F6',
  HIGH: '#D97706',
  CRITICAL: '#EF4444',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Basse',
  NORMAL: 'Normale',
  HIGH: 'Haute',
  CRITICAL: 'Critique',
};

function getCategoryForType(serviceType: string): CategoryKey {
  if (SERVICE_TYPES.cleaning.some((t) => t.value === serviceType)) return 'cleaning';
  if (SERVICE_TYPES.maintenance.some((t) => t.value === serviceType)) return 'maintenance';
  return 'other';
}

function getTypeLabelFr(serviceType: string): string {
  for (const cat of Object.values(SERVICE_TYPES)) {
    const found = cat.find((t) => t.value === serviceType);
    if (found) return found.label;
  }
  return serviceType;
}

function getCategoryColor(serviceType: string): string {
  const cat = getCategoryForType(serviceType);
  return SERVICE_CATEGORIES.find((c) => c.key === cat)?.color ?? '#6B7280';
}

/* ─── Tab Bar ─── */

function TabBar({ activeTab, onTabChange, theme }: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const tabs: { key: TabKey; label: string; icon: IoniconsName }[] = [
    { key: 'new', label: 'Nouvelle demande', icon: 'add-circle-outline' },
    { key: 'history', label: 'Historique', icon: 'time-outline' },
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

/* ─── New Request Tab ─── */

function NewRequestTab({
  propertyId,
  theme,
}: {
  propertyId: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const user = useAuthStore((s) => s.user);
  const createRequest = useCreateServiceRequest();

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('FLEXIBLE');
  const [priority, setPriority] = useState('NORMAL');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Pre-fill title when type is selected
  const handleTypeSelect = useCallback((typeValue: string) => {
    setSelectedType(typeValue);
    const typeLabel = getTypeLabelFr(typeValue);
    setTitle(typeLabel);
  }, []);

  const resetForm = useCallback(() => {
    setSelectedCategory(null);
    setSelectedType(null);
    setTitle('');
    setDescription('');
    setDesiredDate('');
    setTimeSlot('FLEXIBLE');
    setPriority('NORMAL');
    setSpecialInstructions('');
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedType) {
      Alert.alert('Erreur', 'Veuillez selectionner un type de service');
      return;
    }
    if (!title.trim() || title.trim().length < 5) {
      Alert.alert('Erreur', 'Le titre doit comporter au moins 5 caracteres');
      return;
    }
    if (!desiredDate.trim()) {
      Alert.alert('Erreur', 'Veuillez indiquer une date souhaitee');
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(desiredDate.trim())) {
      Alert.alert('Erreur', 'La date doit etre au format YYYY-MM-DD');
      return;
    }

    createRequest.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        serviceType: selectedType,
        priority,
        propertyId,
        desiredDate: `${desiredDate.trim()}T09:00:00`,
        preferredTimeSlot: timeSlot,
        specialInstructions: specialInstructions.trim() || undefined,
      },
      {
        onSuccess: () => {
          Alert.alert('Demande envoyee', 'Votre demande de service a ete creee avec succes');
          resetForm();
        },
        onError: (err: any) => {
          Alert.alert('Erreur', err?.response?.data?.error ?? err?.message ?? 'Erreur inconnue');
        },
      },
    );
  }, [selectedType, title, description, desiredDate, timeSlot, priority, specialInstructions, propertyId, createRequest, resetForm]);

  const categoryColor = selectedCategory
    ? SERVICE_CATEGORIES.find((c) => c.key === selectedCategory)?.color ?? theme.colors.primary.main
    : theme.colors.primary.main;

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Step 1 — Category selection */}
      <SectionHeader title="Type d'intervention" iconName="layers-outline" />

      <View style={{
        flexDirection: 'row',
        gap: theme.SPACING.sm,
        marginBottom: theme.SPACING.lg,
      }}>
        {SERVICE_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.key;
          return (
            <Pressable
              key={cat.key}
              onPress={() => {
                setSelectedCategory(cat.key);
                setSelectedType(null);
                setTitle('');
              }}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: theme.SPACING.md,
                paddingHorizontal: theme.SPACING.xs ?? 4,
                borderRadius: theme.BORDER_RADIUS.lg,
                backgroundColor: isSelected ? `${cat.color}14` : theme.colors.background.paper,
                borderWidth: 2,
                borderColor: isSelected ? cat.color : theme.colors.border.light,
                opacity: pressed ? 0.85 : 1,
                ...theme.shadows.sm,
              })}
            >
              <View style={{
                width: 44,
                height: 44,
                borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: `${cat.color}14`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}>
                <Ionicons name={cat.icon} size={22} color={cat.color} />
              </View>
              <Text style={{
                ...theme.typography.body2,
                color: isSelected ? cat.color : theme.colors.text.primary,
                fontWeight: isSelected ? '700' : '600',
                textAlign: 'center',
                marginBottom: 2,
              }}>
                {cat.label}
              </Text>
              <Text style={{
                ...theme.typography.caption,
                color: theme.colors.text.disabled,
                textAlign: 'center',
                fontSize: 10,
              }}>
                {cat.desc}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Step 2 — Service type chips */}
      {selectedCategory && (
        <>
          <SectionHeader title="Service souhaite" iconName="checkmark-circle-outline" />

          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: theme.SPACING.lg,
          }}>
            {SERVICE_TYPES[selectedCategory].map((svcType) => {
              const isSelected = selectedType === svcType.value;
              return (
                <Pressable
                  key={svcType.value}
                  onPress={() => handleTypeSelect(svcType.value)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: theme.BORDER_RADIUS.full,
                    borderWidth: 1.5,
                    borderColor: isSelected ? categoryColor : theme.colors.border.light,
                    backgroundColor: isSelected ? `${categoryColor}14` : theme.colors.background.paper,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{
                    ...theme.typography.caption,
                    color: isSelected ? categoryColor : theme.colors.text.secondary,
                    fontWeight: isSelected ? '700' : '500',
                    fontSize: 13,
                  }}>
                    {svcType.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* Step 3 — Details form */}
      {selectedType && (
        <>
          <SectionHeader title="Details de la demande" iconName="document-text-outline" />

          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <Input
              label="Titre"
              placeholder="Ex: Menage standard avant arrivee"
              value={title}
              onChangeText={setTitle}
              containerStyle={{ marginBottom: theme.SPACING.md }}
            />

            <Input
              label="Description"
              placeholder="Decrivez le besoin en detail..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              containerStyle={{ marginBottom: theme.SPACING.md }}
            />

            <Input
              label="Date souhaitee"
              placeholder="YYYY-MM-DD"
              value={desiredDate}
              onChangeText={setDesiredDate}
              containerStyle={{ marginBottom: theme.SPACING.md }}
            />

            <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.md }}>
              <View style={{ flex: 1 }}>
                <Select
                  label="Creneau prefere"
                  options={TIME_SLOT_OPTIONS}
                  value={timeSlot}
                  onChange={setTimeSlot}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Select
                  label="Priorite"
                  options={PRIORITY_OPTIONS}
                  value={priority}
                  onChange={setPriority}
                />
              </View>
            </View>

            <Input
              label="Instructions speciales"
              placeholder="Acces, code porte, remarques..."
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              multiline
              numberOfLines={3}
              containerStyle={{ marginBottom: theme.SPACING.lg }}
            />

            <Button
              title="Envoyer la demande"
              onPress={handleSubmit}
              fullWidth
              loading={createRequest.isPending}
              disabled={createRequest.isPending}
              icon={<Ionicons name="send-outline" size={16} color="#fff" />}
            />
          </Card>
        </>
      )}

      {/* Hint when nothing selected */}
      {!selectedCategory && (
        <EmptyState
          iconName="hand-left-outline"
          title="Selectionnez une categorie"
          description="Choisissez le type d'intervention pour commencer"
          compact
        />
      )}

      {selectedCategory && !selectedType && (
        <EmptyState
          iconName="checkmark-circle-outline"
          title="Selectionnez un service"
          description="Choisissez le service specifique dont vous avez besoin"
          compact
        />
      )}
    </ScrollView>
  );
}

/* ─── History Tab ─── */

function HistoryTab({
  propertyId,
  theme,
}: {
  propertyId: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const { data, isLoading, isRefetching, refetch } = useServiceRequests(
    { propertyId: String(propertyId) },
  );
  const requests = data?.content ?? [];

  if (isLoading) {
    return (
      <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
        <Skeleton height={90} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={90} borderRadius={theme.BORDER_RADIUS.lg} />
        <Skeleton height={90} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={theme.colors.primary.main}
        />
      }
    >
      <SectionHeader title="Demandes recentes" iconName="list-outline" />

      {requests.length === 0 ? (
        <EmptyState
          iconName="document-outline"
          title="Aucune demande"
          description="Vous n'avez pas encore de demande de service pour cette propriete"
          compact
          style={{ marginTop: theme.SPACING.md }}
        />
      ) : (
        <View style={{ gap: theme.SPACING.sm }}>
          {requests.map((req: ServiceRequest) => {
            const statusColor = STATUS_COLORS[req.status] ?? '#6B7280';
            const statusLabel = STATUS_LABELS[req.status] ?? req.status;
            const typeColor = getCategoryColor(req.serviceType);
            const typeLabel = getTypeLabelFr(req.serviceType);
            const priorityColor = PRIORITY_COLORS[req.priority] ?? '#6B7280';
            const priorityLabel = PRIORITY_LABELS[req.priority] ?? req.priority;

            const formattedDate = req.desiredDate
              ? (() => {
                  const d = req.desiredDate.split('T')[0].split('-');
                  return `${d[2]}/${d[1]}/${d[0]}`;
                })()
              : null;

            return (
              <Card key={req.id}>
                {/* Header: type badge + title + status badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.SPACING.sm }}>
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: theme.BORDER_RADIUS.full,
                    backgroundColor: `${typeColor}18`,
                  }}>
                    <Text style={{
                      ...theme.typography.caption,
                      color: typeColor,
                      fontWeight: '700',
                      fontSize: 10,
                    }}>
                      {typeLabel}
                    </Text>
                  </View>
                  <Text
                    style={{ ...theme.typography.h5, color: theme.colors.text.primary, flex: 1 }}
                    numberOfLines={1}
                  >
                    {req.title}
                  </Text>
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: theme.BORDER_RADIUS.full,
                    backgroundColor: `${statusColor}18`,
                  }}>
                    <Text style={{
                      ...theme.typography.caption,
                      color: statusColor,
                      fontWeight: '700',
                      fontSize: 10,
                    }}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                {req.description ? (
                  <Text
                    style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginBottom: theme.SPACING.sm }}
                    numberOfLines={1}
                  >
                    {req.description}
                  </Text>
                ) : null}

                <Divider />

                {/* Footer: date + priority */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.SPACING.md,
                  marginTop: theme.SPACING.sm,
                }}>
                  {formattedDate && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="calendar-outline" size={12} color={theme.colors.text.disabled} />
                      <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                        {formattedDate}
                      </Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="flag-outline" size={12} color={priorityColor} />
                    <Text style={{ ...theme.typography.caption, color: priorityColor, fontWeight: '600' }}>
                      {priorityLabel}
                    </Text>
                  </View>
                  {req.propertyName && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                      <Ionicons name="home-outline" size={12} color={theme.colors.text.disabled} />
                      <Text
                        style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}
                        numberOfLines={1}
                      >
                        {req.propertyName}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

/* ─── Main Screen ─── */

export function ServiceRequestScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const { data: propertiesData, isLoading: propertiesLoading } = useProperties();
  const properties = propertiesData?.content ?? [];

  const [selectedPropertyId, setSelectedPropertyId] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<TabKey>('new');

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
          Demandes de service
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
          activeTab === 'new' ? (
            <NewRequestTab propertyId={selectedPropertyId} theme={theme} />
          ) : (
            <HistoryTab propertyId={selectedPropertyId} theme={theme} />
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
